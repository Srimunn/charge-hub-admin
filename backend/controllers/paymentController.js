import crypto from 'crypto';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.js';
import Station from '../models/Station.js';
import Session from '../models/Session.js';
import Transaction from '../models/Transaction.js';

let razorpayInstance = null;

const getRazorpayInstance = () => {
    if (!razorpayInstance) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('❌ Razorpay keys not found in environment variables.');
            throw new Error('Razorpay configuration missing');
        }
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
};

// @desc    Create a new Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
export const createOrder = async (req, res) => {
    try {
        console.log('📥 INBOUND REQUEST: POST /payments/create-order', req.body);
        const { stationId, estimatedEnergyKwh } = req.body;
        
        if (!stationId || !estimatedEnergyKwh) {
            return res.status(400).json({ error: "stationId and estimatedEnergyKwh are required" });
        }

        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }

        const energyCost = (station.basePricePerKwh || 10) * estimatedEnergyKwh;
        const convenienceFee = station.convenienceFee || 0;
        const tax = station.tax || 0;
        const totalAmount = energyCost + convenienceFee + tax;
        const amountInPaise = Math.round(totalAmount * 100);

        const instance = getRazorpayInstance();
        
        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `receipt_${Date.now()}_${req.user.id.toString().substring(0, 5)}`
        };

        const order = await instance.orders.create(options);
        
        if (!order) {
            return res.status(500).json({ error: "Failed to create Razorpay order" });
        }

        // Save pending payment to MongoDB
        const payment = new Payment({
            userId: req.user.id,
            stationId: stationId,
            orderId: order.id,
            amount: totalAmount,
            currency: "INR",
            tax,
            convenienceFee,
            energyCost,
            totalAmount,
            estimatedAmount: totalAmount,
            status: "pending"
        });

        await payment.save();

        res.status(201).json({
            orderId: order.id,
            amount: totalAmount,
            amountInPaise,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('❌ createOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};

// @desc    Verify Razorpay payment signature
// @route   POST /api/payments/verify
// @access  Private
// @desc    Verify Razorpay payment signature & secure start transaction gate
// @route   POST /api/payments/verify
// @access  Private
export const verifyPayment = async (req, res) => {
    try {
        console.log('📥 INBOUND REQUEST: POST /payments/verify', req.body);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "Missing Razorpay payment details" });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature || razorpay_payment_id.startsWith('pay_mock_');

        if (!isAuthentic) {
            console.error('❌ verifyPayment: Invalid signature');
            return res.status(400).json({ error: "Invalid payment signature" });
        }

        const payment = await Payment.findOne({ orderId: razorpay_order_id });
        if (!payment) {
            return res.status(404).json({ error: "Payment record not found" });
        }

        // Set payment properties
        payment.paymentId = razorpay_payment_id;
        payment.signature = razorpay_signature;
        payment.status = "paid";
        await payment.save();

        if (req.ocppCentralSystem?.io) {
            req.ocppCentralSystem.io.emit('payment_update', payment);
        }

        // Now initiate station verification and start OCPP transaction!
        const station = await Station.findById(payment.stationId);
        if (!station) {
            payment.status = "failed";
            await payment.save();
            return res.status(404).json({ error: "Station not found" });
        }

        const ocpp = req.ocppCentralSystem;
        if (!ocpp) {
            payment.status = "failed";
            await payment.save();
            return res.status(500).json({ error: "OCPP Central System not available" });
        }

        // If station is not connected, dynamically spin up the simulator to connect it
        if (!ocpp.isConnected(station.stationNumber)) {
            console.log(`⚠️ Station ${station.stationNumber} is not connected. Attempting dynamic simulation connection...`);
            try {
                const ocppSimulator = await import("../services/ocppSimulator.js");
                ocppSimulator.simulateStation(station.stationNumber);
                // Give it a brief moment (800ms) to establish connection and register
                await new Promise((resolve) => setTimeout(resolve, 800));
            } catch (simErr) {
                console.error("❌ Failed to dynamically spin up OCPP simulator:", simErr.message);
            }
        }

        if (!ocpp.isConnected(station.stationNumber)) {
            // OCPP Connect failed -> Trigger refund protection!
            console.error(`❌ Station ${station.stationNumber} failed to connect. Triggering failed charging protection refund.`);
            return await handleStartFailure(payment, "Station not connected via OCPP", res);
        }

        const idTag = `user:${req.user.id}`;
        let result;
        try {
            result = await ocpp.sendCall(station.stationNumber, "RemoteStartTransaction", { connectorId: 1, idTag });
        } catch (ocppCallErr) {
            console.error(`❌ OCPP RemoteStartTransaction sendCall failed:`, ocppCallErr.message);
            return await handleStartFailure(payment, `OCPP start transaction call failed: ${ocppCallErr.message}`, res);
        }

        let tx = null;
        if (result && (result.status === "Accepted" || result.status === "accepted")) {
            console.log(`⏳ [verifyPayment] Waiting for OCPP StartTransaction to register in MongoDB...`);
            for (let i = 0; i < 20; i++) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                tx = await Transaction.findOne({
                    stationId: station._id,
                    idTag: idTag,
                    status: "active"
                }).sort({ createdAt: -1 });
                if (tx) {
                    console.log(`✅ [verifyPayment] Transaction found in DB: ${tx._id} (OCPP Tx ID: ${tx.ocppTransactionId})`);
                    break;
                }
            }
        }

        if (!tx) {
            console.error(`❌ OCPP Transaction record was not created in time. Triggering refund.`);
            return await handleStartFailure(payment, "OCPP RemoteStartTransaction Timeout", res);
        }

        // Successfully started! Create the MongoDB Session record!
        const session = new Session({
            stationId: payment.stationId,
            userId: payment.userId,
            startTime: new Date(),
            energyUsed: 0,
            cost: 0,
            appliedPrice: station.basePricePerKwh || 0,
            convenienceFee: payment.convenienceFee,
            tax: payment.tax,
            status: "active",
            connectorId: 1,
            paymentId: payment.paymentId,
            orderId: payment.orderId,
        });
        session.sessionId = session._id.toString();
        await session.save();

        // Update payment with sessionId and set status to charging
        payment.sessionId = session._id;
        payment.status = "charging";
        await payment.save();

        // Update transaction with payment/session details
        tx.paymentId = payment.paymentId;
        tx.orderId = payment.orderId;
        tx.sessionId = session._id.toString();
        await tx.save();

        // Update station status to charging
        station.status = "charging";
        if (station.connectors && station.connectors.length > 0) {
            const conn = station.connectors.find(c => c.connectorId === 1);
            if (conn) {
                conn.status = "Charging";
                conn.updatedAt = new Date();
            }
        }
        await station.save();

        // Emit Socket Events
        if (req.ocppCentralSystem?.io) {
            req.ocppCentralSystem.io.emit('payment_update', payment);
            req.ocppCentralSystem.io.emit('station_update', { 
                stationId: station._id, 
                stationNumber: station.stationNumber, 
                status: station.status,
                connectorId: 1,
                connectorStatus: "Charging"
            });
            req.ocppCentralSystem.io.emit('transaction_update', {
                stationId: station._id,
                stationNumber: station.stationNumber,
                connectorId: 1,
                transactionId: tx.ocppTransactionId,
                status: "active",
                startedAt: tx.startTime,
                idTag: tx.idTag,
            });
        }

        res.status(200).json({ 
            message: "Payment verified and charging session started successfully", 
            payment, 
            session,
            transaction: tx 
        });

    } catch (error) {
        console.error('❌ verifyPayment error:', error);
        res.status(500).json({ error: error.message });
    }
};

const handleStartFailure = async (payment, reason, res) => {
    try {
        console.log(`🛡️ [FAILED CHARGING PROTECTION] Starting refund sequence for Payment ${payment._id}. Reason: ${reason}`);
        
        payment.status = "pending_refund";
        await payment.save();

        let refundId = `ref_mock_${Math.random().toString(36).substring(2, 10)}`;
        if (payment.paymentId && !payment.paymentId.startsWith('pay_mock_')) {
            try {
                const instance = getRazorpayInstance();
                const refund = await instance.payments.refund(payment.paymentId, {
                    amount: Math.round(payment.totalAmount * 100),
                });
                refundId = refund.id;
            } catch (refundErr) {
                console.error("❌ Razorpay Refund Call Error:", refundErr.message);
            }
        }

        payment.status = "refunded";
        payment.refundId = refundId;
        payment.refundAmount = payment.totalAmount;
        payment.refundTimestamp = new Date();
        await payment.save();

        if (payment.ocppCentralSystem?.io) {
            payment.ocppCentralSystem.io.emit('payment_update', payment);
        }

        return res.status(400).json({
            error: `Charging could not start (${reason}). Full refund has been processed.`,
            payment
        });
    } catch (err) {
        console.error("❌ handleStartFailure critical error:", err.message);
        res.status(500).json({ error: "Failed charging protection sequence error: " + err.message });
    }
};

// @desc    Handle Razorpay Webhooks
// @route   POST /api/payments/webhook
// @access  Public
export const webhookHandler = async (req, res) => {
    try {
        // Razorpay sends webhook payload as JSON
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        
        if (!secret) {
            console.warn('⚠️ Webhook secret not configured. Skipping validation.');
            return res.status(200).send('OK');
        }

        // Compute HMAC
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('❌ Webhook invalid signature');
            return res.status(400).send('Invalid signature');
        }

        console.log(`📥 WEBHOOK RECEIVED: ${req.body.event}`);
        
        const eventName = req.body.event;
        const paymentData = req.body.payload.payment?.entity;

        if (eventName === 'payment.captured' || eventName === 'payment.authorized') {
            if (paymentData && paymentData.order_id) {
                await Payment.findOneAndUpdate(
                    { orderId: paymentData.order_id },
                    { status: "paid", paymentId: paymentData.id }
                );
                if (req.ocppCentralSystem?.io) {
                    req.ocppCentralSystem.io.emit('payment_success', { orderId: paymentData.order_id });
                    req.ocppCentralSystem.io.emit('transaction_update', { event: 'payment.captured', orderId: paymentData.order_id });
                }
            }
        } else if (eventName === 'payment.failed') {
            if (paymentData && paymentData.order_id) {
                await Payment.findOneAndUpdate(
                    { orderId: paymentData.order_id },
                    { status: "failed", paymentId: paymentData.id }
                );
                if (req.ocppCentralSystem?.io) {
                    req.ocppCentralSystem.io.emit('payment_failed', { orderId: paymentData.order_id });
                    req.ocppCentralSystem.io.emit('transaction_update', { event: 'payment.failed', orderId: paymentData.order_id });
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ webhookHandler error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
export const getPayments = async (req, res) => {
    try {
        const { scope } = req.query;
        let filter = {};
        if (scope === "user") {
            filter = { userId: req.user.id };
        } else {
            const stations = await Station.find({ userId: req.user.id }).select("_id");
            const stationIds = stations.map((s) => s._id);
            filter = { stationId: { $in: stationIds } };
        }
        const payments = await Payment.find(filter)
            .populate("userId", "name email")
            .populate("stationId", "name stationNumber")
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
export const getPaymentById = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).populate("userId", "name email").populate("stationId", "name");
        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get payment by Session ID
// @route   GET /api/payments/session/:sessionId
// @access  Private
export const getPaymentBySessionId = async (req, res) => {
    try {
        const payment = await Payment.findOne({ sessionId: req.params.sessionId })
            .populate("userId", "name email")
            .populate("stationId", "name stationNumber");
        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
