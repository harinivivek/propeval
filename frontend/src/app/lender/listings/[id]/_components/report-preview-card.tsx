import { RedactedReportPreview } from "@/types/listing";

interface Props {
  report: RedactedReportPreview;
  onPurchase: (reportId: string) => void;
  onDownload: (reportId: string) => void;
  onRequestUpdate: (reportId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  VALUATION: "bg-purple-100 text-purple-800",
  LEGAL: "bg-teal-100 text-teal-800",
};

const CONTENT_LABELS: Record<string, string> = {
  construction_type: "Construction",
  number_of_floors: "Floors",
  land_use_zone: "Land Use",
  building_age: "Building Age",
  road_width: "Road Width",
  property_usage: "Usage",
  property_description: "Description",
};

export function ReportPreviewCard({ report, onPurchase, onDownload, onRequestUpdate }: Props) {
  const catColor = CATEGORY_COLORS[report.report_category] || "bg-gray-100 text-gray-800";

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${catColor}`}>
            {report.report_category}
          </span>
          {report.report_date && (
            <span className="text-xs text-gray-400 ml-2">{report.report_date}</span>
          )}
        </div>
        {report.is_purchased && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
            Purchased
          </span>
        )}
      </div>

      {report.locality && (
        <p className="text-sm font-medium text-gray-800 mb-1">{report.locality}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
        {report.property_type && <span>{report.property_type}</span>}
        {report.plot_extent_sqft && <span>Plot: ~{report.plot_extent_sqft} sqft</span>}
        {report.built_up_sqft && <span>Built-up: ~{report.built_up_sqft} sqft</span>}
      </div>

      {/* Content preview from extracted data */}
      {report.content_preview && Object.keys(report.content_preview).length > 0 && (
        <div className="bg-gray-50 rounded p-3 mb-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(report.content_preview).map(([key, value]) => (
              <div key={key}>
                <span className="text-gray-500">{CONTENT_LABELS[key] || key}: </span>
                <span className="text-gray-800">{String(value ?? "—")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => onRequestUpdate(report.id)}
          className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
        >
          Request Update
        </button>
        {report.is_purchased ? (
          <button
            onClick={() => onDownload(report.id)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download
          </button>
        ) : (
          <button
            onClick={() => onPurchase(report.id)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Buy Report
          </button>
        )}
      </div>
    </div>
  );
}
