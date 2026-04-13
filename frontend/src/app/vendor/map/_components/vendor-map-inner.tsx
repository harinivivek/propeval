"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { VendorOwnReport, CompetitorArea } from "@/types/map";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ ownReports, competitorAreas }: { ownReports: VendorOwnReport[]; competitorAreas: CompetitorArea[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...ownReports.map((r) => [r.latitude, r.longitude] as [number, number]),
      ...competitorAreas.map((c) => [c.latitude, c.longitude] as [number, number]),
    ];
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [ownReports, competitorAreas, map]);
  return null;
}

export default function VendorMapInner({
  ownReports,
  competitorAreas,
}: {
  ownReports: VendorOwnReport[];
  competitorAreas: CompetitorArea[];
}) {
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
      <FitBounds ownReports={ownReports} competitorAreas={competitorAreas} />

      {/* Own reports — green markers */}
      {ownReports.map((report) => (
        <Marker
          key={report.report_id}
          position={[report.latitude, report.longitude]}
          icon={greenIcon}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[180px]">
              <div className="font-semibold text-foreground">{report.property_address}</div>
              <div className="text-muted-foreground">{report.city}</div>
              <div className="flex gap-1">
                {report.property_type && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    {report.property_type}
                  </Badge>
                )}
                {report.report_category && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                    {report.report_category}
                  </Badge>
                )}
              </div>
              {report.status && (
                <div className="mt-1">
                  <StatusBadge status={report.status} />
                </div>
              )}
              {report.report_date && (
                <div className="text-xs text-muted-foreground">{report.report_date}</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Competitor areas — red circles with count */}
      {competitorAreas.map((area) => (
        <CircleMarker
          key={`${area.pin_code}-${area.city}`}
          center={[area.latitude, area.longitude]}
          radius={Math.min(12 + area.report_count * 3, 30)}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.6 }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-foreground">{area.report_count} reports by other vendors</div>
              <div className="text-muted-foreground">{area.pin_code}, {area.city}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
