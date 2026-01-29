import { useState } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Save, Clock, Users, Zap } from 'lucide-react';
import { mockTariffs, Tariff } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const Pricing = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>(mockTariffs);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    pricePerKwh: 0.30,
    pricePerMinute: 0.05,
    peakMultiplier: 1.5,
    offPeakMultiplier: 0.8,
    fleetDiscount: 15,
    peakHoursEnabled: true,
  });

  const handleSave = () => {
    toast({
      title: 'Tariff Saved',
      description: 'Your pricing configuration has been updated',
    });
  };

  const handleTariffToggle = (tariffId: string) => {
    setTariffs(prev =>
      prev.map(t =>
        t.id === tariffId ? { ...t, isActive: !t.isActive } : t
      )
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Pricing & Tariff Management" 
        subtitle="Configure charging rates and discounts"
      />
      
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pricing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Base Pricing
              </CardTitle>
              <CardDescription>Set your standard charging rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricePerKwh">Price per kWh ($)</Label>
                  <Input
                    id="pricePerKwh"
                    type="number"
                    step="0.01"
                    value={formData.pricePerKwh}
                    onChange={(e) => setFormData({ ...formData, pricePerKwh: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerMinute">Price per Minute ($)</Label>
                  <Input
                    id="pricePerMinute"
                    type="number"
                    step="0.01"
                    value={formData.pricePerMinute}
                    onChange={(e) => setFormData({ ...formData, pricePerMinute: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Peak/Off-Peak Pricing</Label>
                    <p className="text-sm text-muted-foreground">
                      Apply different rates during peak hours
                    </p>
                  </div>
                  <Switch
                    checked={formData.peakHoursEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, peakHoursEnabled: checked })}
                  />
                </div>

                {formData.peakHoursEnabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="peakMultiplier">Peak Multiplier</Label>
                      <Input
                        id="peakMultiplier"
                        type="number"
                        step="0.1"
                        value={formData.peakMultiplier}
                        onChange={(e) => setFormData({ ...formData, peakMultiplier: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">8 AM - 8 PM</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offPeakMultiplier">Off-Peak Multiplier</Label>
                      <Input
                        id="offPeakMultiplier"
                        type="number"
                        step="0.1"
                        value={formData.offPeakMultiplier}
                        onChange={(e) => setFormData({ ...formData, offPeakMultiplier: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">8 PM - 8 AM</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="fleetDiscount">Fleet Discount (%)</Label>
                <Input
                  id="fleetDiscount"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.fleetDiscount}
                  onChange={(e) => setFormData({ ...formData, fleetDiscount: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Discount applied to fleet accounts
                </p>
              </div>

              <Button onClick={handleSave} className="w-full gap-2">
                <Save className="w-4 h-4" />
                Save Tariff Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Active Tariffs */}
          <Card>
            <CardHeader>
              <CardTitle>Active Tariff Plans</CardTitle>
              <CardDescription>Manage your pricing tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tariffs.map((tariff) => (
                <div
                  key={tariff.id}
                  className={`p-4 rounded-lg border ${tariff.isActive ? 'border-primary/50 bg-primary/5' : 'bg-secondary/30'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{tariff.name}</span>
                      {tariff.isActive && (
                        <Badge className="bg-success text-success-foreground">Active</Badge>
                      )}
                    </div>
                    <Switch
                      checked={tariff.isActive}
                      onCheckedChange={() => handleTariffToggle(tariff.id)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="w-4 h-4" />
                      <span>${tariff.pricePerKwh}/kWh</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>${tariff.pricePerMinute}/min</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">Peak: {tariff.peakMultiplier}x</span>
                    </div>
                    {tariff.fleetDiscount > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{tariff.fleetDiscount}% fleet discount</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Revenue/Session</p>
                <p className="text-2xl font-bold">$15.70</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Energy/Session</p>
                <p className="text-2xl font-bold">42.3 kWh</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Users className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fleet Revenue Share</p>
                <p className="text-2xl font-bold">34%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
