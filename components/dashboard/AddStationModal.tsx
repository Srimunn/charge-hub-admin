"use client";
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createStation, updateStation, getImageUrl } from '@/services/api';
import { Plus, MapPin, Zap, Minus, UploadCloud, X, Trash2, Clock, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const POWER_OPTIONS = [
  { value: 3.3, label: '3.3 kW' },
  { value: 7, label: '7 kW' },
  { value: 22, label: '22 kW' },
  { value: 50, label: '50 kW' },
];

const CONNECTOR_TYPES = [
  { value: 'CCS2', label: 'CCS2 (DC Fast)' },
  { value: 'Type 2', label: 'Type 2 (AC)' },
  { value: 'GB/T', label: 'GB/T (DC)' },
  { value: 'CHAdeMO', label: 'CHAdeMO' },
];

export const AddStationModal = ({ 
  onStationAdded,
  customTrigger,
  editingStation
}: { 
  onStationAdded: () => void,
  customTrigger?: React.ReactNode,
  editingStation?: any
}) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: editingStation?.name || '', 
    location: editingStation?.location || '', 
    latitude: editingStation?.latitude || '',
    longitude: editingStation?.longitude || '',
    district: editingStation?.district || '',
    powerOutput: editingStation?.powerOutput || 0, 
    ports: editingStation?.ports || 1, 
    basePricePerKwh: editingStation?.basePricePerKwh || 15, 
    convenienceFee: editingStation?.convenienceFee || 2, 
    tax: editingStation?.tax || 20, 
    connectorType: editingStation?.connectorType || 'Type 2',
    districtPin: editingStation?.stationNumber?.substring(0, 3) || '' 
  });
  const [dynamicPricing, setDynamicPricing] = useState<{startTime: string, endTime: string, pricePerKwh: number}[]>(editingStation?.dynamicPricing || []);
  const [imageFile, setImageFile] = useState<File | null>(null);    // raw File for upload
  const [imagePreview, setImagePreview] = useState<string>(
    editingStation?.image ? getImageUrl(editingStation.image) : ''
  );
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addDynamicSlot = () => {
    setDynamicPricing([...dynamicPricing, { startTime: "18:00", endTime: "22:00", pricePerKwh: 20 }]);
  };
  
  const removeDynamicSlot = (index: number) => {
    setDynamicPricing(dynamicPricing.filter((_, i) => i !== index));
  };
  
  const updateDynamicSlot = (index: number, field: string, value: string | number) => {
    const updated = [...dynamicPricing];
    updated[index] = { ...updated[index], [field]: value };
    setDynamicPricing(updated);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      toast({ title: 'Invalid File', description: 'Only JPG, PNG, and WebP images are supported', variant: 'destructive' });
    }
  };

  const isFormValid = formData.name && formData.location && formData.latitude && formData.longitude && formData.powerOutput && formData.ports && (editingStation || formData.districtPin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsLoading(true);
    try {
      if (!localStorage.getItem('token')) {
        throw new Error('Authentication required. Please log in.');
      }

      if (editingStation) {
        await updateStation(editingStation._id, {
          name: formData.name,
          location: formData.location,
          latitude: formData.latitude,
          longitude: formData.longitude,
          district: formData.district,
          powerOutput: formData.powerOutput,
          ports: formData.ports,
          basePricePerKwh: formData.basePricePerKwh,
          convenienceFee: formData.convenienceFee,
          tax: formData.tax,
          connectorType: formData.connectorType,
          dynamicPricing,
          imageFile,
        });
        toast({
          title: 'Station Updated Successfully',
          description: 'Station details have been updated in the database',
        });
      } else {
        await createStation({
          name: formData.name,
          location: formData.location,
          latitude: formData.latitude,
          longitude: formData.longitude,
          district: formData.district,
          powerOutput: formData.powerOutput,
          ports: formData.ports,
          basePricePerKwh: formData.basePricePerKwh,
          convenienceFee: formData.convenienceFee,
          tax: formData.tax,
          districtPin: formData.districtPin,
          connectorType: formData.connectorType,
          dynamicPricing,
          imageFile,          // raw File → backend uploads to Cloudinary
        });
        toast({
          title: 'Station Created Successfully',
          description: 'Station integrated successfully into tracking Database',
        });
      }

      if (!editingStation) {
        setFormData({ name: '', location: '', latitude: '', longitude: '', district: '', powerOutput: 0, ports: 1, basePricePerKwh: 15, convenienceFee: 2, tax: 20, connectorType: 'Type 2', districtPin: '' });
        setDynamicPricing([]);
        setImageFile(null);
        setImagePreview('');
      }
      setOpen(false);
      onStationAdded();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || `Failed to ${editingStation ? 'update' : 'create'} station`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dialogComponent = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {customTrigger || (
          <Button className="w-full gap-2 shadow-md hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
            <Plus className="w-4 h-4" /> Add Station
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {editingStation ? <Edit className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />} 
            {editingStation ? 'Update Station' : 'Add New Station'}
          </DialogTitle>
          <DialogDescription>
            {editingStation ? 'Modify the parameters for this charging station.' : 'Configure the hardware parameters and location for your new EV charging point.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              {/* Name & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Station Name</Label>
                  <Input id="name" required value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} placeholder="e.g. City Center Hub" className="focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Address / Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="location" required className="pl-9 focus:ring-2 focus:ring-primary/50 transition-all" value={formData.location} onChange={e => setFormData(f => ({...f, location: e.target.value}))} placeholder="Address or specific location" />
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input id="latitude" type="number" step="any" required value={formData.latitude} onChange={e => setFormData(f => ({...f, latitude: e.target.value}))} placeholder="e.g. 11.3500" className="focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input id="longitude" type="number" step="any" required value={formData.longitude} onChange={e => setFormData(f => ({...f, longitude: e.target.value}))} placeholder="e.g. 77.7120" className="focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
              </div>

              {/* District / Pin (Only for new stations) */}
              {!editingStation && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="districtPin">District / Region PIN</Label>
                    <Select value={formData.districtPin} onValueChange={(value) => setFormData(f => ({...f, districtPin: value, district: value === '641' ? 'Coimbatore' : value === '600' ? 'Chennai' : value === '638' ? 'Erode' : value === '625' ? 'Madurai' : value === '636' ? 'Salem' : value === '620' ? 'Trichy' : value === '627' ? 'Tirunelveli' : ''}))}>
                      <SelectTrigger id="districtPin" className="focus:ring-2 focus:ring-primary/50">
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="641">Coimbatore (641)</SelectItem>
                        <SelectItem value="600">Chennai (600)</SelectItem>
                        <SelectItem value="638">Erode (638)</SelectItem>
                        <SelectItem value="625">Madurai (625)</SelectItem>
                        <SelectItem value="636">Salem (636)</SelectItem>
                        <SelectItem value="620">Trichy (620)</SelectItem>
                        <SelectItem value="627">Tirunelveli (627)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District Name</Label>
                    <Input id="district" value={formData.district} onChange={e => setFormData(f => ({...f, district: e.target.value}))} placeholder="e.g. Chennai" className="focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                </div>
              )}

              {/* Power Output Cards */}
              <div className="space-y-3">
                <Label>Power Output (kW)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {POWER_OPTIONS.map((opt) => (
                    <div 
                      key={opt.value}
                      onClick={() => setFormData(f => ({ ...f, powerOutput: opt.value }))}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                        formData.powerOutput === opt.value 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' 
                          : 'border-border hover:border-primary/50 bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">{opt.label}</span>
                        <Zap className={`w-4 h-4 ${formData.powerOutput === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector Type Selection */}
              <div className="space-y-3">
                <Label>Connector Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {CONNECTOR_TYPES.map((type) => (
                    <div 
                      key={type.value}
                      onClick={() => setFormData(f => ({ ...f, connectorType: type.value }))}
                      className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:shadow-sm ${
                        formData.connectorType === type.value 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                          : 'border-border hover:border-primary/50 bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${formData.connectorType === type.value ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        <span className="font-medium text-sm">{type.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Number of Ports */}
              <div className="space-y-3">
                <Label>Number of Ports</Label>
                <div className="flex items-center gap-4 bg-secondary/30 p-2 rounded-lg w-max border">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFormData(f => ({ ...f, ports: Math.max(1, f.ports - 1) }))} disabled={formData.ports <= 1} className="h-8 w-8 rounded-md hover:bg-background">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="w-8 text-center font-bold text-lg">{formData.ports}</div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFormData(f => ({ ...f, ports: Math.min(10, f.ports + 1) }))} disabled={formData.ports >= 10} className="h-8 w-8 rounded-md hover:bg-background">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Pricing & Fees */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-lg">Pricing Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price (₹/kWh)</Label>
                    <Input id="basePrice" type="number" step="0.5" required value={formData.basePricePerKwh} onChange={e => setFormData(f => ({...f, basePricePerKwh: Number(e.target.value)}))} className="focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="convenienceFee">Conv. Fee (₹)</Label>
                    <Input id="convenienceFee" type="number" min="2" max="5" step="0.5" required value={formData.convenienceFee} onChange={e => setFormData(f => ({...f, convenienceFee: Number(e.target.value)}))} className="focus:ring-2 focus:ring-primary/50" />
                    <p className="text-xs text-muted-foreground ml-1">Range: ₹2 - ₹5</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax">Tax/Surcharge (₹)</Label>
                    <Input id="tax" type="number" step="0.5" value={formData.tax} onChange={e => setFormData(f => ({...f, tax: Number(e.target.value)}))} className="focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>

                {/* Dynamic Pricing Slots */}
                <div className="space-y-3 bg-secondary/20 p-4 rounded-xl border border-secondary">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold flex items-center gap-2"><Clock className="w-4 h-4"/> Dynamic Pricing (Time-based)</Label>
                      <p className="text-sm text-muted-foreground mt-1">Override base price during specific hours.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addDynamicSlot} className="gap-2">
                      <Plus className="w-4 h-4" /> Add Slot
                    </Button>
                  </div>

                  {dynamicPricing.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {dynamicPricing.map((slot, idx) => (
                        <div key={idx} className="flex flex-wrap md:flex-nowrap items-end gap-3 bg-background p-3 rounded-lg border">
                          <div className="space-y-1 w-full md:w-auto flex-1">
                            <Label className="text-xs">Start Time</Label>
                            <Input type="time" value={slot.startTime} onChange={(e) => updateDynamicSlot(idx, 'startTime', e.target.value)} required />
                          </div>
                          <div className="space-y-1 w-full md:w-auto flex-1">
                            <Label className="text-xs">End Time</Label>
                            <Input type="time" value={slot.endTime} onChange={(e) => updateDynamicSlot(idx, 'endTime', e.target.value)} required />
                          </div>
                          <div className="space-y-1 w-full md:w-auto flex-1">
                            <Label className="text-xs">Price (₹/kWh)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">₹</span>
                              <Input type="number" step="0.5" value={slot.pricePerKwh} className="pl-7" onChange={(e) => updateDynamicSlot(idx, 'pricePerKwh', Number(e.target.value))} required />
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0" onClick={() => removeDynamicSlot(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image Upload Drag Drop */}
              <div className="space-y-3 border-t pt-4">
                <Label>Station Image</Label>
                {!imagePreview ? (
                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${
                      dragActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50 hover:border-primary/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="hidden" />
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG or WebP (max. 5 MB)</p>
                  </div>
                ) : (
                  <div className="relative rounded-xl border overflow-hidden group h-48 bg-black/5 flex items-center justify-center">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button type="button" variant="destructive" size="sm" onClick={() => { setImageFile(null); setImagePreview(''); }} className="gap-2">
                        <X className="w-4 h-4" /> Remove Image
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <Button type="submit" disabled={isLoading || !isFormValid} className="w-full h-11 text-base shadow-lg transition-transform hover:-translate-y-0.5" size="lg">
                  {isLoading ? (editingStation ? "Updating Hardware..." : "Provisioning Hardware...") : (editingStation ? "Update Charging Station" : "Deploy Charging Station")}
                </Button>
              </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (customTrigger) return dialogComponent;

  return (
    <Card className="shadow-lg border-0 h-full flex flex-col items-center justify-center p-6 bg-card text-center relative overflow-hidden group">
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <CardHeader className="p-0 mb-4 z-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-xl">Add New Station</CardTitle>
        <CardDescription className="mt-2">Register a new EV charging point to your network.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 z-10 w-full mt-2">
        {dialogComponent}
      </CardContent>
    </Card>
  );
};
