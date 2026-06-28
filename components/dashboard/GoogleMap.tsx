"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Station {
  _id: string;
  stationNumber?: string;
  name: string;
  location: string;
  status: string;
  powerOutput?: number;
  ports?: number;
  latitude?: number;
  longitude?: number;
}

interface GoogleMapProps {
  stations: Station[];
}

export function GoogleMap({ stations }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // If google is already loaded, reuse it
    if ((window as any).google && (window as any).google.maps) {
      setMapLoaded(true);
      return;
    }

    // Set callback function
    (window as any).initGoogleMapCallback = () => {
      setMapLoaded(true);
    };

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    const script = document.createElement("script");
    // If no key, it will load in developer utility mode
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMapCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setLoadError(true);
    };
    document.head.appendChild(script);

    return () => {
      // Clean up callback to avoid memory leaks
      delete (window as any).initGoogleMapCallback;
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !stations) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    // Bangalore default center
    let center = { lat: 12.9716, lng: 77.5946 };
    const validStations = stations.filter(
      (s) => s.latitude !== undefined && s.longitude !== undefined && !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude))
    );

    if (validStations.length > 0) {
      center = { lat: Number(validStations[0].latitude), lng: Number(validStations[0].longitude) };
    }

    const mapOptions = {
      center,
      zoom: 12,
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: false,
      styles: [
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#e9e9e9" }, { lightness: 17 }]
        },
        {
          featureType: "landscape",
          elementType: "geometry",
          stylers: [{ color: "#f5f5f5" }, { lightness: 20 }]
        },
        {
          featureType: "road.highway",
          elementType: "geometry.fill",
          stylers: [{ color: "#ffffff" }, { lightness: 17 }]
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }]
        },
        {
          featureType: "road.arterial",
          elementType: "geometry",
          stylers: [{ color: "#ffffff" }, { lightness: 18 }]
        },
        {
          featureType: "road.local",
          elementType: "geometry",
          stylers: [{ color: "#ffffff" }, { lightness: 16 }]
        },
        {
          featureType: "poi",
          elementType: "geometry",
          stylers: [{ color: "#f5f5f5" }, { lightness: 21 }]
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#dedede" }, { lightness: 21 }]
        }
      ]
    };

    const map = new google.maps.Map(mapRef.current, mapOptions);
    const infoWindow = new google.maps.InfoWindow();

    validStations.forEach((station) => {
      const position = { lat: Number(station.latitude), lng: Number(station.longitude) };

      // Determine color based on status
      let markerColor = "#10B981"; // Green (Available / online)
      const status = String(station.status).toLowerCase();
      if (status === "offline") markerColor = "#6B7280"; // Grey
      else if (status === "maintenance") markerColor = "#F59E0B"; // Orange
      else if (status === "charging") markerColor = "#3B82F6"; // Blue
      else if (status === "faulted") markerColor = "#EF4444"; // Red

      const marker = new google.maps.Marker({
        position,
        map,
        title: station.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: markerColor,
          fillOpacity: 0.9,
          strokeWeight: 1.5,
          strokeColor: "#ffffff",
          scale: 6,
        },
      });

      marker.addListener("click", () => {
        const displayStatus = status === 'online' ? 'Available' : status.charAt(0).toUpperCase() + status.slice(1);
        const contentString = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 12px; color: #0f172a; max-width: 240px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${markerColor};"></span>
              <strong style="font-size: 14px; color: #1e293b; font-weight: 700;">${station.name}</strong>
            </div>
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; font-family: monospace; font-weight: 600;">Station #${station.stationNumber || "N/A"}</p>
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #475569; line-height: 1.4;">${station.location}</p>
            <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 8px; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-bottom: 10px; color: #475569;">
              <div>Power: <strong style="color: #0f172a;">${station.powerOutput || 0} kW</strong></div>
              <div>Ports: <strong style="color: #0f172a;">${station.ports || 1}</strong></div>
              <div>Status: <strong style="color: ${markerColor};">${displayStatus}</strong></div>
            </div>
            <a href="/stations/${station._id}" style="display: block; text-align: center; text-decoration: none; background-color: #0f172a; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; transition: background-color 0.2s;">
              View Live Telemetry
            </a>
          </div>
        `;
        infoWindow.setContent(contentString);
        infoWindow.open(map, marker);
      });
    });

  }, [mapLoaded, stations]);

  if (loadError) {
    return (
      <div className="flex h-[450px] w-full items-center justify-center rounded-2xl bg-muted/40 border border-dashed border-border text-destructive font-medium">
        Failed to load Google Maps. Please check your network connection.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-border shadow-sm">
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
