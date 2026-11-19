import {
  pgTable,
  pgSequence,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  bigserial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// IDs are 24-char hex strings (same format as the old MongoDB ObjectIds) so that
// migrated records keep their IDs and the mobile app keeps working unchanged.
const id = () => text("id").primaryKey();
const ts = (name) => timestamp(name, { withTimezone: true, mode: "date" });

export const ROLES = ["admin", "owner", "customer"];

// OCPP 1.6 transactionId must be an integer that is unique per charge point.
export const ocppTransactionSeq = pgSequence("ocpp_transaction_id_seq", { startWith: 1, maxValue: 2147483647 });

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password"), // bcrypt hash of the 6-digit PIN
    mobile: text("mobile"),
    googleId: text("google_id"),
    authProvider: text("auth_provider").notNull().default("local"),
    // admin = platform admin (sees everything), owner = charging-centre owner (sees own stations),
    // customer = mobile-app user
    role: text("role").notNull().default("customer"),
    status: text("status").notNull().default("active"), // active | blocked
    vehicleType: text("vehicle_type"),
    sessionTimeout: integer("session_timeout").notNull().default(30),
    operatorId: text("operator_id"),
    fcmToken: text("fcm_token").default(""),
    notificationPreferences: jsonb("notification_preferences").notNull().default({
      emailAlerts: true,
      smsAlerts: false,
      pushAlerts: true,
      faultAlerts: true,
      paymentAlerts: true,
    }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_mobile_uq").on(t.mobile),
    uniqueIndex("users_google_id_uq").on(t.googleId),
    index("users_role_idx").on(t.role),
  ]
);

export const stations = pgTable(
  "stations",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    stationNumber: text("station_number").notNull(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    district: text("district"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: text("status").notNull().default("offline"),
    ports: integer("ports").notNull().default(1),
    slots: integer("slots"),
    powerOutput: doublePrecision("power_output"),
    connectorType: text("connector_type").notNull().default("Type 2"),
    image: text("image"),
    basePricePerKwh: doublePrecision("base_price_per_kwh").notNull().default(0),
    // [{ startTime: "HH:MM", endTime: "HH:MM", pricePerKwh: number }] in IST
    dynamicPricing: jsonb("dynamic_pricing").notNull().default([]),
    convenienceFee: doublePrecision("convenience_fee").notNull().default(0),
    // GST percentage applied on (energy cost + convenience fee)
    tax: doublePrecision("tax").notNull().default(18),
    lastSeen: ts("last_seen"),
    ocppConnected: boolean("ocpp_connected").notNull().default(false),
    ocpp: jsonb("ocpp").notNull().default({}),
    // [{ connectorId, status, errorCode, updatedAt }]
    connectors: jsonb("connectors").notNull().default([]),
    faultStatus: text("fault_status").notNull().default("none"),
    totalEnergyConsumed: doublePrecision("total_energy_consumed").notNull().default(0),
    health: text("health").notNull().default("NORMAL"),
    lastResolvedAt: ts("last_resolved_at"),
    // Demo stations are driven by the built-in OCPP simulator; real chargers never are.
    simulated: boolean("simulated").notNull().default(false),
    // Optional bcrypt hash for OCPP Basic Auth (Security Profile 1). Null = no password.
    ocppPasswordHash: text("ocpp_password_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stations_number_uq").on(t.stationNumber),
    index("stations_user_idx").on(t.userId),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    stationId: text("station_id").notNull().references(() => stations.id),
    sessionId: text("session_id"),
    orderId: text("order_id").notNull(),
    paymentId: text("payment_id"),
    signature: text("signature"),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    tax: doublePrecision("tax").notNull().default(0),
    convenienceFee: doublePrecision("convenience_fee").notNull().default(0),
    energyCost: doublePrecision("energy_cost").notNull(),
    totalAmount: doublePrecision("total_amount").notNull(),
    estimatedAmount: doublePrecision("estimated_amount"),
    estimatedEnergyKwh: doublePrecision("estimated_energy_kwh"),
    pricePerKwh: doublePrecision("price_per_kwh"),
    taxPercent: doublePrecision("tax_percent"),
    actualAmount: doublePrecision("actual_amount"),
    refundAmount: doublePrecision("refund_amount"),
    extraAmount: doublePrecision("extra_amount"),
    refundId: text("refund_id"),
    refundTimestamp: ts("refund_timestamp"),
    refundError: text("refund_error"),
    // pending | paid | charging | completed | pending_refund | refunded | refund_failed | failed
    status: text("status").notNull().default("pending"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_order_uq").on(t.orderId),
    index("payments_user_idx").on(t.userId),
    index("payments_station_idx").on(t.stationId),
    index("payments_session_idx").on(t.sessionId),
  ]
);

// One row per charging session. Replaces the old separate Mongo "transactions" (OCPP) and
// "sessions" (payment) collections, which described the same thing twice.
export const chargingSessions = pgTable(
  "charging_sessions",
  {
    id: id(),
    stationId: text("station_id").notNull().references(() => stations.id),
    stationNumber: text("station_number").notNull(),
    userId: text("user_id"),
    connectorId: integer("connector_id").notNull().default(1),
    ocppTransactionId: integer("ocpp_transaction_id"),
    idTag: text("id_tag").notNull().default("unknown"),
    meterStart: doublePrecision("meter_start").notNull().default(0),
    meterStop: doublePrecision("meter_stop"),
    startTime: ts("start_time").notNull(),
    endTime: ts("end_time"),
    status: text("status").notNull().default("active"), // active | completed | FAULT_PAUSED
    stopRequestedAt: ts("stop_requested_at"),
    stopReason: text("stop_reason"),
    energyUsed: doublePrecision("energy_used").notNull().default(0),
    cost: doublePrecision("cost").notNull().default(0),
    appliedPrice: doublePrecision("applied_price").notNull().default(0),
    convenienceFee: doublePrecision("convenience_fee").notNull().default(0),
    tax: doublePrecision("tax").notNull().default(0),
    taxPercent: doublePrecision("tax_percent"),
    // Prepaid limit in ₹ (incl. GST). Charging is stopped automatically when reached.
    prepaidAmount: doublePrecision("prepaid_amount"),
    paymentId: text("payment_id"),
    orderId: text("order_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_station_tx_uq").on(t.stationId, t.ocppTransactionId),
    index("sessions_station_status_idx").on(t.stationId, t.status),
    index("sessions_user_idx").on(t.userId),
    index("sessions_start_idx").on(t.startTime),
    index("sessions_order_idx").on(t.orderId),
  ]
);

export const faults = pgTable(
  "faults",
  {
    id: id(),
    stationId: text("station_id").notNull().references(() => stations.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    sessionId: text("session_id"),
    type: text("type").notNull(),
    faultCode: text("fault_code"),
    faultName: text("fault_name"),
    source: text("source").notNull().default("SIMULATION"), // SIMULATION | HARDWARE
    severity: text("severity").notNull().default("low"),
    message: text("message"),
    status: text("status").notNull().default("active"), // active | resolved
    raw: jsonb("raw"),
    createdAt: ts("created_at").notNull().defaultNow(),
    timestamp: ts("timestamp").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: text("resolved_by"),
  },
  (t) => [index("faults_station_status_idx").on(t.stationId, t.status), index("faults_created_idx").on(t.createdAt)]
);

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    type: text("type").notNull().default("FAULT"),
    title: text("title").notNull(),
    stationId: text("station_id").notNull().references(() => stations.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().default("HIGH"),
    source: text("source").notNull().default("SIMULATION"),
    timestamp: ts("timestamp").notNull().defaultNow(),
    status: text("status").notNull().default("ACTIVE"),
  },
  (t) => [index("alerts_station_status_idx").on(t.stationId, t.status)]
);

export const telemetry = pgTable(
  "telemetry",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    stationId: text("station_id").notNull(), // station number (OCPP charge point id)
    stationObjectId: text("station_object_id"),
    sessionId: text("session_id"),
    connectorId: integer("connector_id"),
    transactionId: integer("transaction_id"),
    voltage: doublePrecision("voltage"),
    current: doublePrecision("current"),
    power: doublePrecision("power"),
    temperature: doublePrecision("temperature"),
    energyConsumed: doublePrecision("energy_consumed"),
    timestamp: ts("timestamp").notNull().defaultNow(),
  },
  (t) => [index("telemetry_station_time_idx").on(t.stationId, t.timestamp), index("telemetry_time_idx").on(t.timestamp)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("general"),
    read: boolean("read").notNull().default(false),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)]
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceToken: text("device_token").notNull(),
    platform: text("platform").notNull().default("android"),
    appVersion: text("app_version").notNull().default("1.0.0"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_tokens_token_uq").on(t.deviceToken), index("device_tokens_user_idx").on(t.userId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    ipAddress: text("ip_address").notNull(),
    timestamp: ts("timestamp").notNull().defaultNow(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId)]
);

// OTPs live in the database (not memory) so they survive deploys/restarts.
export const otpCodes = pgTable("otp_codes", {
  key: text("key").primaryKey(), // `${purpose}:${email}`
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(), // register | change-password
  codeHash: text("code_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  lastSentAt: ts("last_sent_at").notNull().defaultNow(),
});
