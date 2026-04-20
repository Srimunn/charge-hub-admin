import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createStation } from '@/api';
import { Plus, MapPin, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const AddStation = ({ onStationAdded }: { onStationAdded: () => void }) => {
  const [formData, setFormData] = useState({ name: '', location: '', powerOutput: '', status: 'online' });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!localStorage.getItem("token")) {
         throw new Error("Authentication required. Please log in.");
      }
      
      await createStation({
        name: formData.name,
        location: formData.location,
        status: formData.status,
        powerOutput: Number(formData.powerOutput)
      });
      
      toast({
        title: "Success",
        description: "Station added successfully to MongoDB",
      });
      
      setFormData({ name: '', location: '', powerOutput: '', status: 'online' });
      onStationAdded();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create station",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-0 h-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Add New Station
        </CardTitle>
        <CardDescription>Register a new EV charging point to your network</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Station Name</Label>
            <Input id="name" required value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} placeholder="e.g. City Center Hub" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="location" required className="pl-9" value={formData.location} onChange={e => setFormData(f => ({...f, location: e.target.value}))} placeholder="Address or coordinates" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="powerOutput">Power (kW)</Label>
              <div className="relative">
                <Zap className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="powerOutput" type="number" required min="1" className="pl-9" value={formData.powerOutput} onChange={e => setFormData(f => ({...f, powerOutput: e.target.value}))} placeholder="e.g. 150" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData(f => ({...f, status: val}))}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full mt-2">
            {isLoading ? "Adding Station..." : "Create Station"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
