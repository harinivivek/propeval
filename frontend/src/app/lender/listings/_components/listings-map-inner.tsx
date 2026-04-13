"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { ListingMapItem } from "@/types/map";

const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ items }: { items: ListingMapItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length > 0) {
      const bounds = L.latLngBounds(items.map((i) => [i.latitude, i.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [items, map]);
  return null;
}

export default function ListingsMapInner({ items }: { items: ListingMapItem[] }) {
  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds items={items} />
      {items.map((item) => (
        <Marker
          key={item.listing_id}
          position={[item.latitude, item.longitude]}
          icon={defaultIcon}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[180px]">
              <div className="font-semibold">{item.macro_location}</div>
              <div className="text-muted-foreground">{item.city} — {item.pin_code}</div>
              <div>
                <span className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  {item.property_type}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {item.report_count} reports · {item.vendor_count} vendors
              </div>
              {item.latest_report_date && (
                <div className="text-xs text-muted-foreground/60">Latest: {item.latest_report_date}</div>
              )}
              <a
                href={`/lender/listings/${item.listing_id}`}
                className="text-xs text-primary hover:underline block mt-1"
              >
                View Details →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
