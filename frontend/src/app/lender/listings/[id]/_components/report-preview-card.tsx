import { RedactedReportPreview } from "@/types/listing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

interface Props {
  report: RedactedReportPreview;
  onPurchase: (reportId: string) => void;
  onDownload: (reportId: string) => void;
  onRequestUpdate: (reportId: string) => void;
}

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
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {report.report_category}
            </Badge>
            {report.report_date && (
              <span className="text-xs text-muted-foreground">{report.report_date}</span>
            )}
          </div>
          {report.is_purchased && (
            <StatusBadge status="COMPLETED" className="text-xs" />
          )}
        </div>

        {report.locality && (
          <p className="text-sm font-medium text-foreground mb-1">{report.locality}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
          {report.property_type && <span>{report.property_type}</span>}
          {report.plot_extent_sqft && <span>Plot: ~{report.plot_extent_sqft} sqft</span>}
          {report.built_up_sqft && <span>Built-up: ~{report.built_up_sqft} sqft</span>}
        </div>

        {/* Content preview from extracted data */}
        {report.content_preview && Object.keys(report.content_preview).length > 0 && (
          <div className="bg-muted rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(report.content_preview).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{CONTENT_LABELS[key] || key}: </span>
                  <span className="text-foreground">{String(value ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            onClick={() => onRequestUpdate(report.id)}
            variant="outline"
            size="sm"
          >
            Request Update
          </Button>
          {report.is_purchased ? (
            <Button
              onClick={() => onDownload(report.id)}
              variant="secondary"
              size="sm"
            >
              Download
            </Button>
          ) : (
            <Button
              onClick={() => onPurchase(report.id)}
              size="sm"
            >
              Buy Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
