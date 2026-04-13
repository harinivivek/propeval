"use client";

import dynamic from "next/dynamic";
import type { MarketplaceResult } from "@/types/marketplace";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface MarketplaceMapProps {
  results: MarketplaceResult[];
}

export function MarketplaceMap({ results }: MarketplaceMapProps) {
  // Filter results with coordinates
  const pins = results.filter(
    (r) =>
      (r.result_type === "report" && r.latitude && r.longitude) ||
      (r.result_type === "vendor" && r.latitude && r.longitude)
  );

  // Default center (Bengaluru)
  const center: [number, number] = [12.9716, 77.5946];

  if (pins.length > 0) {
    const first = pins[0];
    if (first.latitude && first.longitude) {
      center[0] = parseFloat(first.latitude);
      center[1] = parseFloat(first.longitude);
    }
  }

  return (
    <div className="h-full w-full" style={{ minHeight: 300 }}>
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((pin, i) => {
          const lat = parseFloat(pin.latitude!);
          const lng = parseFloat(pin.longitude!);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker key={i} position={[lat, lng]}>
              <Popup>
                {pin.result_type === "report" ? (
                  <div className="text-xs">
                    <strong>{pin.locality_name || pin.pin_code}</strong>
                    <br />
                    {pin.property_type} - {pin.city}
                    <br />
                    {pin.report_count} reports
                  </div>
                ) : (
                  <div className="text-xs">
                    <strong>{pin.vendor_name}</strong>
                    <br />
                    {pin.vendor_tier} - {pin.total_completed_jobs} jobs
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
