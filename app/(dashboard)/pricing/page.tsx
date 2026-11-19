"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, Save, Clock, Zap, Plus, Trash2, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDashboardKPIs, getStations, updateStation } from '@/services/api';
import { isAdmin } from '@/lib/auth';

type Rule = { startTime: string; endTime: string; pricePerKwh: number | string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const inWindow = (now: number, r: Rule) => {
  const s = toMinutes(r.startTime);
  const e = toMinutes(r.endTime);
  return s <= e ? now >= s && now < e : now >= s || now < e; // window may cross midnight
};
const istNowMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return toMinutes(parts.replace('24:', '00:'));
};
const inr = (v: number) => `₹${(Math.round(v * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PricingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const admin = isAdmin();
  const { data: stations = [] } = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const { data: kpis } = useQuery({ queryKey: ['dashboardKPIs'], queryFn: getDashboardKPIs });

  const [stationId, setStationId] = useState<string>('');
  const station = useMemo(() => (stations as any[]).find((s) => s._id === stationId), [stations, stationId]);

  const [basePrice, setBasePrice] = useState<string>('0');
  const [fee, setFee] = useState<string>('0');
  const [gst, setGst] = useState<string>('18');
  const [rules, setRules] = useState<Rule[]>([]);
  const [previewKwh, setPreviewKwh] = useState<string>('10');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!stationId && (stations as any[]).length) setStationId((stations as any[])[0]._id);
  }, [stations, stationId]);

  useEffect(() => {
    if (!station) return;
    setBasePrice(String(station.basePricePerKwh ?? 0));
    setFee(String(station.convenienceFee ?? 0));
    setGst(String(station.tax ?? 18));
    setRules((station.dynamicPricing || []).map((r: any) => ({ ...r })));
  }, [station]);

  const errors = useMemo(() => {
    const list: string[] = [];
    const feeNum = Number(fee);
    if (!(Number(basePrice) >= 0)) list.push('Base price must be 0 or more.');
    if (!(feeNum === 0 || (feeNum >= 2 && feeNum <= 5))) list.push('Convenience fee must be ₹0 or between ₹2 and ₹5.');
    if (!(Number(gst) >= 0 && Number(gst) <= 28)) list.push('GST must be between 0 and 28%.');
    rules.forEach((r, i) => {
      if (!HHMM.test(r.startTime) || !HHMM.test(r.endTime)) list.push(`Time window ${i + 1}: use HH:MM times.`);
      if (!(Number(r.pricePerKwh) >= 0) || r.pricePerKwh === '') list.push(`Time window ${i + 1}: enter a price.`);
    });
    return list;
  }, [basePrice, fee, gst, rules]);

  const nowMinutes = istNowMinutes();
  const activeRule = rules.find((r) => HHMM.test(r.startTime) && HHMM.test(r.endTime) && inWindow(nowMinutes, r));
  const currentPrice = activeRule ? Number(activeRule.pricePerKwh) : Number(basePrice);
  const kwh = Math.max(0, Number(previewKwh) || 0);
  const energyCost = kwh * (currentPrice || 0);
  const tax = ((energyCost + Number(fee || 0)) * Number(gst || 0)) / 100;
  const total = energyCost + Number(fee || 0) + tax;

  const handleSave = async () => {
    if (!station || errors.length) return;
    setSaving(true);
    try {
      await updateStation(station._id, {
        basePricePerKwh: Number(basePrice),
        convenienceFee: Number(fee),
        ...(admin ? { tax: Number(gst) } : {}),
        dynamicPricing: rules.map((r) => ({ ...r, pricePerKwh: Number(r.pricePerKwh) })),
      });
      await queryClient.invalidateQueries({ queryKey: ['stations'] });
      toast({ title: 'Pricing saved', description: `New rates apply to the next payment at ${station.name}.` });
    } catch (err: any) {
      toast({ title: 'Could not save pricing', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalSessions = Number((kpis as any)?.totalSessions || 0);
  const avgRevenue = totalSessions ? Number((kpis as any)?.totalRevenue || 0) / totalSessions : 0;
  const avgEnergy = totalSessions ? Number((kpis as any)?.totalEnergy || 0) / totalSessions : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Pricing & Tariffs" subtitle="Per-station energy price, convenience fee and time-of-day rates" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {(stations as any[]).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No stations yet. Add a station first, then set its pricing here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" /> Station pricing
                </CardTitle>
                <CardDescription>Prices are locked when the customer pays. Changes apply to new payments only.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Station</Label>
                  <Select value={stationId} onValueChange={setStationId}>
                    <SelectTrigger><SelectValue placeholder="Choose a station" /></SelectTrigger>
                    <SelectContent>
                      {(stations as any[]).map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name} · {s.stationNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base">Base price (₹/kWh)</Label>
                    <Input id="base" type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee">Convenience fee (₹/session)</Label>
                    <Input id="fee" type="number" min="0" max="5" step="0.5" value={fee} onChange={(e) => setFee(e.target.value)} />
                    <p className="text-xs text-muted-foreground">₹0, or ₹2 to ₹5</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST (%)</Label>
                    <Input id="gst" type="number" min="0" max="28" step="1" value={gst} disabled={!admin} onChange={(e) => setGst(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{admin ? 'Applied to energy + fee' : 'Set by the administrator'}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Time-of-day prices (IST)</Label>
                      <p className="text-xs text-muted-foreground mt-1">Override the base price inside these windows. A window may cross midnight (e.g. 22:00–06:00).</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRules([...rules, { startTime: '18:00', endTime: '22:00', pricePerKwh: Number(basePrice) || 0 }])}>
                      <Plus className="w-4 h-4 mr-1" /> Add window
                    </Button>
                  </div>
                  {rules.length === 0 && <p className="text-sm text-muted-foreground">No time windows: the base price applies all day.</p>}
                  {rules.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input type="time" value={r.startTime} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input type="time" value={r.endTime} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">₹/kWh</Label>
                        <Input type="number" min="0" step="0.01" value={r.pricePerKwh} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, pricePerKwh: e.target.value } : x)))} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove window" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {errors.length > 0 && (
                  <ul className="text-sm text-destructive list-disc pl-5 space-y-1">
                    {errors.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}

                <Button onClick={handleSave} disabled={saving || errors.length > 0 || !station} className="w-full gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save pricing'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Bill preview</CardTitle>
                <CardDescription>What a customer pays right now</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kwh">Energy (kWh)</Label>
                  <Input id="kwh" type="number" min="0" step="0.5" value={previewKwh} onChange={(e) => setPreviewKwh(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Current rate: <strong>{inr(currentPrice || 0)}/kWh</strong></span>
                  {activeRule && <Badge variant="secondary">{activeRule.startTime}–{activeRule.endTime}</Badge>}
                </div>
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex justify-between p-3"><span>Energy</span><span>{inr(energyCost)}</span></div>
                  <div className="flex justify-between p-3"><span>Convenience fee</span><span>{inr(Number(fee || 0))}</span></div>
                  <div className="flex justify-between p-3"><span>GST ({Number(gst || 0)}%)</span><span>{inr(tax)}</span></div>
                  <div className="flex justify-between p-3 font-semibold"><span>Total</span><span>{inr(total)}</span></div>
                </div>
                <p className="text-xs text-muted-foreground">Charging stops automatically when the prepaid amount is used; any unused amount is refunded.</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10"><IndianRupee className="w-6 h-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Avg revenue / session</p>
                <p className="text-2xl font-bold">{inr(avgRevenue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10"><Zap className="w-6 h-6 text-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Avg energy / session</p>
                <p className="text-2xl font-bold">{avgEnergy.toFixed(1)} kWh</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10"><Receipt className="w-6 h-6 text-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total sessions</p>
                <p className="text-2xl font-bold">{totalSessions}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
