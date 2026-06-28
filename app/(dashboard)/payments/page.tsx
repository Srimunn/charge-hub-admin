"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, IndianRupee, CheckCircle2, XCircle, Clock, Calendar, RefreshCw, Search } from "lucide-react";
import { getPayments } from "@/services/api";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

interface Payment {
    _id: string;
    userId?: { name: string; email: string };
    stationId?: { name: string; stationNumber: string };
    sessionId?: string | { _id: string };
    orderId: string;
    paymentId?: string;
    amount: number;
    tax: number;
    convenienceFee: number;
    totalAmount: number;
    estimatedAmount?: number;
    actualAmount?: number;
    refundAmount?: number;
    extraAmount?: number;
    status: string;
    createdAt: string;
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setIsRefreshing(true);
        try {
            const data = await getPayments();
            setPayments(data);
        } catch (error) {
            console.error("Failed to fetch payments:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Filter payments based on Today, Week, Month + Search Query
    const filteredPayments = payments.filter((payment) => {
        let passDate = true;
        const date = new Date(payment.createdAt);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === 'today') {
            passDate = date >= startOfToday;
        } else if (dateFilter === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            passDate = date >= oneWeekAgo;
        } else if (dateFilter === 'month') {
            const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            passDate = date >= oneMonthAgo;
        }

        if (!passDate) return false;

        const q = searchQuery.toLowerCase();
        if (!q) return true;

        const customerName = (payment.userId?.name || '').toLowerCase();
        const customerEmail = (payment.userId?.email || '').toLowerCase();
        const stationName = (payment.stationId?.name || '').toLowerCase();
        const stationNum = (payment.stationId?.stationNumber || '').toLowerCase();
        const orderId = (payment.orderId || '').toLowerCase();
        const paymentId = (payment.paymentId || '').toLowerCase();
        const status = (payment.status || '').toLowerCase();
        const sessId = typeof payment.sessionId === 'object' && payment.sessionId !== null
            ? String(payment.sessionId._id || '')
            : String(payment.sessionId || '');
        const cleanSessId = sessId.toLowerCase();

        return customerName.includes(q) ||
            customerEmail.includes(q) ||
            stationName.includes(q) ||
            stationNum.includes(q) ||
            orderId.includes(q) ||
            paymentId.includes(q) ||
            status.includes(q) ||
            cleanSessId.includes(q);
    });

    // Statistics based on filtered dataset
    const totalRevenue = filteredPayments
        .filter(p => ['paid', 'charging', 'completed', 'refunded'].includes(p.status.toLowerCase()))
        .reduce((acc, curr) => acc + (curr.actualAmount ?? curr.totalAmount ?? 0), 0);

    const totalRefunded = filteredPayments
        .reduce((acc, curr) => acc + (curr.refundAmount || 0), 0);

    const activeSessions = filteredPayments.filter(p => p.status.toLowerCase() === 'charging').length;
    const completedSessions = filteredPayments.filter(p => p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'refunded').length;

    const getStatusBadge = (status: string) => {
        const s = String(status || '').toLowerCase();
        switch (s) {
            case 'completed':
                return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-semibold"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
            case 'refunded':
                return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 font-semibold"><IndianRupee className="w-3 h-3 mr-1" /> Refunded</Badge>;
            case 'pending_refund':
                return <Badge className="bg-purple-50 text-purple-600 hover:bg-purple-50 font-semibold"><Clock className="w-3 h-3 mr-1" /> Ref. Pending</Badge>;
            case 'paid':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-semibold"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
            case 'charging':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 animate-pulse font-semibold"><Clock className="w-3 h-3 mr-1" /> Charging</Badge>;
            case 'failed':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-semibold"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 font-semibold"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            default:
                return <Badge variant="outline" className="font-semibold">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <DashboardHeader 
                title="Payments & Refunds" 
                subtitle="Monitor Razorpay pre-authorizations, live charging consumption, dynamic settles, and differences."
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search transactions..."
            />
            <div className="flex-1 p-6 space-y-6">
                <div className="flex justify-end">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchPayments} 
                        disabled={isRefreshing}
                        className="bg-white hover:bg-slate-50 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg w-fit shadow-inner">
                    <Button 
                        variant={dateFilter === 'all' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('all')}
                        className="h-8 text-xs font-semibold px-4 rounded-md"
                    >
                        All Time
                    </Button>
                    <Button 
                        variant={dateFilter === 'today' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('today')}
                        className="h-8 text-xs font-semibold px-4 rounded-md"
                    >
                        Today
                    </Button>
                    <Button 
                        variant={dateFilter === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('week')}
                        className="h-8 text-xs font-semibold px-4 rounded-md"
                    >
                        This Week
                    </Button>
                    <Button 
                        variant={dateFilter === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setDateFilter('month')}
                        className="h-8 text-xs font-semibold px-4 rounded-md"
                    >
                        This Month
                    </Button>
                </div>
            </div>

            {/* Statistics Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Settled Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-900">₹{totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-slate-400 mt-1">Based on actual consumption</p>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auto-Refunded</CardTitle>
                        <IndianRupee className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-900">₹{totalRefunded.toFixed(2)}</div>
                        <p className="text-xs text-slate-400 mt-1">Returned differences</p>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Charging</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-900">{activeSessions}</div>
                        <p className="text-xs text-slate-400 mt-1">Sessions active right now</p>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Sessions</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-900">{completedSessions}</div>
                        <p className="text-xs text-slate-400 mt-1">Fully settled transactions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Payments Table Card */}
            <Card className="border border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-4">
                    <CardTitle className="text-base font-bold text-slate-800 flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-slate-500" />
                        Transactions List ({filteredPayments.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="space-y-4">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="border-b border-slate-200">
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">Date</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">User</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">Station</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">Session ID</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">Order ID</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600">Payment ID</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600 text-right">Est. Paid</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600 text-right">Actual Cost</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600 text-right">Refunded</TableHead>
                                        <TableHead className="py-3.5 text-xs font-bold text-slate-600 text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPayments.map((payment) => {
                                        const sessId = typeof payment.sessionId === 'object' && payment.sessionId !== null
                                            ? payment.sessionId._id 
                                            : (payment.sessionId || 'N/A');
                                        
                                        const estAmount = payment.estimatedAmount ?? payment.totalAmount ?? 0;
                                        const actAmount = payment.actualAmount ?? (payment.status.toLowerCase() === 'completed' ? payment.totalAmount : 0);
                                        const refAmount = payment.refundAmount ?? 0;

                                        return (
                                            <TableRow key={payment._id} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors">
                                                <TableCell className="py-3 text-xs text-slate-700 font-medium whitespace-nowrap">
                                                    {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                                                </TableCell>
                                                <TableCell className="py-3 text-xs text-slate-700">
                                                    <div className="font-semibold">{payment.userId?.name || 'Unknown'}</div>
                                                    <div className="text-[10px] text-slate-400">{payment.userId?.email || ''}</div>
                                                </TableCell>
                                                <TableCell className="py-3 text-xs text-slate-700">
                                                    <div className="font-semibold">{payment.stationId?.name || 'Unknown'}</div>
                                                    <div className="text-[10px] text-slate-400">#{payment.stationId?.stationNumber || ''}</div>
                                                </TableCell>
                                                <TableCell className="py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                                                    {sessId.slice(-8)}
                                                </TableCell>
                                                <TableCell className="py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                                                    {payment.orderId}
                                                </TableCell>
                                                <TableCell className="py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                                                    {payment.paymentId || '--'}
                                                </TableCell>
                                                <TableCell className="py-3 text-xs font-bold text-slate-700 text-right">
                                                    ₹{estAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="py-3 text-xs font-bold text-slate-900 text-right">
                                                    ₹{actAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="py-3 text-xs font-bold text-emerald-600 text-right">
                                                    {refAmount > 0 ? `₹${refAmount.toFixed(2)}` : '--'}
                                                </TableCell>
                                                <TableCell className="py-3 text-xs text-center">
                                                    {getStatusBadge(payment.status)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {filteredPayments.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-sm text-slate-400 font-medium">
                                                No payment transactions found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden p-4">
                            {filteredPayments.map((payment) => {
                                const sessId = typeof payment.sessionId === 'object' && payment.sessionId !== null
                                    ? payment.sessionId._id 
                                    : (payment.sessionId || 'N/A');
                                
                                const estAmount = payment.estimatedAmount ?? payment.totalAmount ?? 0;
                                const actAmount = payment.actualAmount ?? (payment.status.toLowerCase() === 'completed' ? payment.totalAmount : 0);
                                const refAmount = payment.refundAmount ?? 0;

                                return (
                                    <div key={payment._id} className="p-4 bg-secondary/30 rounded-2xl border border-border/40 space-y-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-foreground">{payment.userId?.name || 'Unknown'}</span>
                                                <span className="text-[10px] text-muted-foreground mt-0.5">{payment.userId?.email || ''}</span>
                                            </div>
                                            {getStatusBadge(payment.status)}
                                        </div>

                                        <div className="space-y-2 text-xs bg-background/50 p-3 rounded-xl border border-border/20">
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Date:</span>
                                                <span className="font-medium text-foreground">{format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Station:</span>
                                                <span className="font-semibold text-foreground">{payment.stationId?.name || 'Unknown'} (#{payment.stationId?.stationNumber || ''})</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Session ID:</span>
                                                <span className="font-mono text-muted-foreground">{sessId.slice(-8)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Order ID:</span>
                                                <span className="font-mono text-muted-foreground">{payment.orderId}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Payment ID:</span>
                                                <span className="font-mono text-muted-foreground">{payment.paymentId || '--'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-background/30 p-2.5 rounded-xl border border-border/10">
                                            <div>
                                                <span className="text-muted-foreground block mb-0.5">Est. Paid</span>
                                                <span className="font-bold text-foreground">₹{estAmount.toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block mb-0.5">Actual Cost</span>
                                                <span className="font-bold text-foreground">₹{actAmount.toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block mb-0.5">Refunded</span>
                                                <span className="font-bold text-emerald-600">{refAmount > 0 ? `₹${refAmount.toFixed(2)}` : '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredPayments.length === 0 && (
                                <div className="text-center py-8 text-sm text-slate-400 font-medium">
                                    No payment transactions found.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
    );
}
