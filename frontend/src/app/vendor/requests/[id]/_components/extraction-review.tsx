"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ContentJson, ExtractedField, Report } from "@/types/report";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  report: Report;
  onUpdated: () => void;
};

const ANCHOR_FIELD_LABELS: Record<string, string> = {
  property_address: "Property Address",
  property_type: "Property Type",
  valuation_amount: "Valuation Amount",
  built_up_area: "Built-up Area",
  owner_name: "Owner Name",
};

const SECTION_ORDER = [
  { key: "general", label: "(a) General" },
  { key: "locality", label: "(b) Locality" },
  { key: "property", label: "(c) Property" },
  { key: "boundaries", label: "(d) Boundaries" },
  { key: "structural_details", label: "(e) Structural Details" },
  { key: "quality_of_construction", label: "(f) Quality of Construction" },
  { key: "technical_approvals", label: "(g) Technical Approvals" },
  { key: "valuation_fair_market", label: "(h) Valuation — Fair Market Value" },
  { key: "valuation_land_building", label: "(i) Valuation — Land & Building" },
  { key: "recommended_valuation", label: "(j) Recommended Valuation" },
  { key: "remarks", label: "(k) Remarks" },
  { key: "google_location", label: "(l) Google Location" },
  { key: "photos", label: "(m) Photos" },
];

const SECTION_FIELD_LABELS: Record<string, string> = {
  customer_id: "Customer ID",
  property_address_with_floor_pin: "Property Address (Floor & PIN)",
  nearest_landmark: "Nearest Landmark",
  cooperative_housing_society: "Co-operative Housing Society",
  builder_developer: "Builder / Developer",
  contact_detail: "Contact Detail",
  case_type: "Case Type",
  current_owner_name: "Current Owner Name",
  address_of_property: "Address of Property",
  date_of_inspection: "Date of Inspection",
  ward_no_municipal_land_no: "Ward No / Municipal Land No",
  vicinity: "Vicinity",
  type_property_as_per_approvals: "Type of Property (per Approvals)",
  proximity_civic_amenities: "Proximity to Civic Amenities",
  nearest_railway_station: "Nearest Railway Station",
  nearest_bus_stop: "Nearest Bus Stop",
  nearest_hospital: "Nearest Hospital",
  conditions_of_approach: "Conditions of Approach",
  plot_demarcated_at_site: "Plot Demarcated at Site",
  land_freehold_or_leasehold: "Freehold / Leasehold",
  identified_through_person_met: "Identified Through (Person Met)",
  property_usage_observation: "Property Usage (Site Observation)",
  additional_amenities: "Additional Amenities",
  no_of_stories: "No. of Stories",
  occupied_by: "Occupied By",
  relationship_occupant_customer: "Occupant Relationship with Customer",
  name_on_society_board: "Name on Society Board",
  within_municipal_limits: "Within Municipal Limits",
  north_as_per_deed: "North (per Deed)",
  south_as_per_deed: "South (per Deed)",
  east_as_per_deed: "East (per Deed)",
  west_as_per_deed: "West (per Deed)",
  north_as_per_site: "North (per Site)",
  south_as_per_site: "South (per Site)",
  east_as_per_site: "East (per Site)",
  west_as_per_site: "West (per Site)",
  boundaries_match: "Boundaries Match Documentation",
  type_of_structure: "Type of Structure",
  no_of_floors: "No. of Floors",
  no_of_wings: "No. of Wings",
  no_of_flats_each_floor: "No. of Flats per Floor",
  no_of_lifts: "No. of Lifts",
  internal_composition: "Internal Composition",
  age_of_property: "Age of Property",
  estimated_future_life: "Estimated Future Life",
  construction_stage: "Construction Stage",
  recommendation: "Recommendation",
  beam_column_structure: "Beam & Column Structure",
  appearance_maintenance: "Appearance & Maintenance",
  flooring_finishing: "Flooring & Finishing",
  roofing_terracing: "Roofing & Terracing",
  quality_fixtures_fittings: "Fixtures & Fittings Quality",
  layout_plan_details: "Layout Plan Details",
  approved_plan_details: "Approved Plan (No. & Date)",
  construction_permission: "Construction Permission (No. & Date)",
  legal_document_details: "Legal Document Details",
  violations_observed: "Violations Observed",
  structure_confirming_byelaws: "Confirms Local Byelaws",
  area_as_per_measurement: "Area (per Measurement)",
  area_as_per_agreement: "Area (per Agreement)",
  area_as_per_approved_plan: "Area (per Approved Plan)",
  area_considered_for_valuation: "Area Considered for Valuation",
  rate_per_sqft: "Rate (per Sq.Ft.)",
  fair_market_value_unit: "(A) Fair Market Value of Unit",
  car_parks_count: "No. of Car Parks",
  car_park_rate: "Rate per Car Park",
  parking_value: "(B) Value of Parking",
  one_time_acquisition_cost: "(C) One Time Acquisition Cost",
  final_value_comparison_method: "Final Value — Comparison (A+B+C)",
  land_area_as_per_plan: "Land Area (per Plan)",
  land_area_as_per_deed: "Land Area (per Deed)",
  land_area_as_per_measurement: "Land Area (per Measurement)",
  land_area_considered: "Land Area Considered",
  land_rate: "Land Rate",
  land_value: "(A) Land Value",
  area_measurement_lb: "Area (per Measurement)",
  area_agreement_lb: "Area (per Agreement)",
  area_approved_plan_lb: "Area (per Approved Plan)",
  area_considered_lb: "Area Considered",
  loading: "Loading (%)",
  built_up_area_lb: "Built-up Area",
  construction_rate: "Construction Rate",
  construction_cost_completion: "(B) Construction Cost at Completion",
  current_construction_stage_pct: "(C) Current Construction Stage (%)",
  proportionate_construction_cost: "(D) Proportionate Cost (B×C)",
  value_land_building_current: "Value — L&B Current Date (A+D)",
  value_land_building_completion: "Value — L&B on Completion (A+B)",
  stage_of_construction: "Stage of Construction",
  stage_percentage: "Stage (%)",
  recommended_disbursement_pct: "Recommended Disbursement (%)",
  recommended_mortgage_valuation: "Recommended Mortgage Valuation",
  realizable_value: "Realizable Value",
  distressed_valuation_80pct: "Distressed Valuation (@80%)",
  rental_value_per_month: "Rental Value (per Month)",
  longitude_latitude: "Longitude & Latitude",
  reconstruction_cost_insurable: "Reconstruction / Insurable Value",
  remarks: "Remarks",
  google_location_url: "Google Location",
  photos_description: "Photos Description",
};

const REQUIRED_FIELDS = ["property_address", "property_type", "valuation_amount"];

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9) {
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">High ({Math.round(confidence * 100)}%)</Badge>;
  }
  if (confidence >= 0.6) {
    return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">Medium ({Math.round(confidence * 100)}%)</Badge>;
  }
  return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 shrink-0">Low ({Math.round(confidence * 100)}%)</Badge>;
}

type FieldEntry = {
  key: string;
  value: string | number | null;
  confidence: number;
  type: string;
  original?: string | number | null;
  edited?: boolean;
  isAnchor: boolean;
  section?: string;
};

function flattenFields(content: ContentJson): FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const [key, field] of Object.entries(content.anchor_fields)) {
    entries.push({ key, ...field, isAnchor: true });
  }
  if (content.sections) {
    for (const [sectionKey, sectionFields] of Object.entries(content.sections)) {
      for (const [key, field] of Object.entries(sectionFields)) {
        entries.push({ key, ...field, isAnchor: false, section: sectionKey });
      }
    }
  }
  for (const [key, field] of Object.entries(content.additional_fields)) {
    entries.push({ key, ...field, isAnchor: false });
  }
  return entries;
}

function PdfModal({ reportId, open, onClose }: { reportId: string; open: boolean; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020";

    fetch(`${apiUrl}/api/vendor/reports/${reportId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF");
        return res.blob();
      })
      .then((blob) => {
        setPdfUrl(URL.createObjectURL(blob));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [reportId, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Original Report PDF</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 p-4 pt-2">
          {loading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <Skeleton className="w-full h-full" />
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full rounded-md border" title="Report PDF" />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <p className="text-destructive">Failed to load PDF</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionBlock({
  sectionKey,
  label,
  fields,
  allFields,
  onUpdateField,
  onRemoveField,
}: {
  sectionKey: string;
  label: string;
  fields: FieldEntry[];
  allFields: FieldEntry[];
  onUpdateField: (index: number, value: string) => void;
  onRemoveField: (index: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const fieldCount = fields.length;

  if (fieldCount === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
        <Badge variant="secondary" className="text-xs">{fieldCount} fields</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pl-6 pt-2">
          {fields.map((f) => {
            const globalIndex = allFields.indexOf(f);
            return (
              <div key={`${sectionKey}-${f.key}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Label className="sm:w-52 flex-shrink-0 text-xs">
                  {SECTION_FIELD_LABELS[f.key] || f.key.replace(/_/g, " ")}
                </Label>
                <Input
                  type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                  value={f.value ?? ""}
                  onChange={(e) => onUpdateField(globalIndex, e.target.value)}
                  className="text-sm"
                />
                {confidenceBadge(f.confidence)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveField(globalIndex)}
                  className="text-destructive hover:text-destructive shrink-0"
                  title="Remove field"
                >
                  &times;
                </Button>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ExtractionReview({ report, onUpdated }: Props) {
  const content = report.content_json;
  const [fields, setFields] = useState<FieldEntry[]>(
    content ? flattenFields(content) : []
  );
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);

  const updateFieldValue = (index: number, newValue: string) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const original = f.original ?? f.value;
        return {
          ...f,
          value: newValue,
          original: f.edited ? f.original : original,
          edited: true,
        };
      })
    );
  };

  const addField = () => {
    if (!newFieldKey.trim()) return;
    setFields((prev) => [
      ...prev,
      {
        key: newFieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
        value: newFieldValue,
        confidence: 1.0,
        type: "text",
        edited: false,
        isAnchor: false,
      },
    ]);
    setNewFieldKey("");
    setNewFieldValue("");
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const anchor: Record<string, object> = {};
    const sections: Record<string, Record<string, object>> = {};
    const additional: Record<string, object> = {};

    for (const f of fields) {
      const data = {
        value: f.value,
        confidence: f.confidence,
        type: f.type,
        original: f.original ?? null,
        edited: f.edited ?? false,
      };
      if (f.isAnchor || f.key in (content?.anchor_fields ?? {})) {
        anchor[f.key] = data;
      } else if (f.section) {
        if (!sections[f.section]) sections[f.section] = {};
        sections[f.section][f.key] = data;
      } else {
        additional[f.key] = data;
      }
    }
    return { anchor_fields: anchor, sections, additional_fields: additional };
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError("");
    try {
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      await api.post(`/api/vendor/reports/${report.id}/publish`, {});
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const missingRequired = REQUIRED_FIELDS.filter((f) => {
    const field = fields.find((entry) => entry.key === f);
    return !field || !field.value;
  });

  const anchorFields = fields.filter((f) => f.isAnchor);
  const unsectionedFields = fields.filter((f) => !f.isAnchor && !f.section);
  const hasSections = fields.some((f) => f.section);
  const totalExtracted = fields.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Extracted Report Data</CardTitle>
          {totalExtracted > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {totalExtracted} fields extracted
            </p>
          )}
        </div>
        <Button variant="link" onClick={() => setShowPdf(true)} className="text-primary">
          View Original PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {content && (
          <p className="text-xs text-muted-foreground">
            Extracted from {content.page_count} page(s) on{" "}
            {new Date(content.extracted_at).toLocaleDateString()}
            {content.extraction_version >= 2 && " (v2 — sectioned)"}
          </p>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">{error}</div>
        )}

        {/* Anchor / Key fields */}
        {anchorFields.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Key Fields</h4>
            <div className="space-y-3">
              {anchorFields.map((f) => {
                const globalIndex = fields.indexOf(f);
                const isRequired = REQUIRED_FIELDS.includes(f.key);
                return (
                  <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="sm:w-52 flex-shrink-0">
                      {ANCHOR_FIELD_LABELS[f.key] || f.key}
                      {isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                      value={f.value ?? ""}
                      onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                    />
                    {confidenceBadge(f.confidence)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section-grouped fields */}
        {hasSections && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Property Appraisal Sections
              </h4>
              <div className="space-y-1">
                {SECTION_ORDER.map((sec) => {
                  const sectionFields = fields.filter((f) => f.section === sec.key);
                  return (
                    <SectionBlock
                      key={sec.key}
                      sectionKey={sec.key}
                      label={sec.label}
                      fields={sectionFields}
                      allFields={fields}
                      onUpdateField={updateFieldValue}
                      onRemoveField={removeField}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Unsectioned additional fields (legacy or uncategorized) */}
        {unsectionedFields.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Additional Fields</h4>
              <div className="space-y-3">
                {unsectionedFields.map((f) => {
                  const globalIndex = fields.indexOf(f);
                  return (
                    <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Label className="sm:w-52 flex-shrink-0 text-xs">
                        {SECTION_FIELD_LABELS[f.key] || f.key.replace(/_/g, " ")}
                      </Label>
                      <Input
                        type="text"
                        value={f.value ?? ""}
                        onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                      />
                      {confidenceBadge(f.confidence)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(globalIndex)}
                        className="text-destructive hover:text-destructive"
                        title="Remove field"
                      >
                        &times;
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Add field */}
        <Separator />
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Add Field</h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Field name"
              className="sm:w-40"
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
            />
            <Input
              placeholder="Value"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={addField}
              disabled={!newFieldKey.trim()}
              className="whitespace-nowrap"
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || missingRequired.length > 0}
            title={
              missingRequired.length > 0
                ? `Missing: ${missingRequired.join(", ")}`
                : "Publish report"
            }
          >
            {publishing ? "Publishing..." : "Publish"}
          </Button>
          {missingRequired.length > 0 && (
            <p className="text-xs text-destructive self-center">
              Missing required: {missingRequired.join(", ")}
            </p>
          )}
        </div>

        {/* PDF Modal */}
        <PdfModal reportId={report.id} open={showPdf} onClose={() => setShowPdf(false)} />
      </CardContent>
    </Card>
  );
}
