"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { VendorOwnReport, CompetitorArea } from "@/types/map";

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
              <div className="font-semibold">{report.property_address}</div>
              <div className="text-gray-500">{report.city}</div>
              <div className="flex gap-1">
                {report.property_type && (
                  <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {report.property_type}
                  </span>
                )}
                {report.report_category && (
                  <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                    {report.report_category}
                  </span>
                )}
              </div>
              {report.status && (
                <div className="text-xs text-gray-600">Status: {report.status}</div>
              )}
              {report.report_date && (
                <div className="text-xs text-gray-400">{report.report_date}</div>
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
              <div className="font-semibold">{area.report_count} reports by other vendors</div>
              <div className="text-gray-500">{area.pin_code}, {area.city}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
