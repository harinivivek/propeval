"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import FieldList from "./field-list";
import type {
  ReportTemplate,
  TemplateConfig,
  TemplateFieldOption,
  TemplateSectionField,
} from "@/types/template";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const DEFAULT_CONFIG: TemplateConfig = {
  header: {
    bank_name: "",
    primary_color: "#1a3b5c",
    secondary_color: "#f0f4f8",
    show_logo: true,
    subtitle: "Property Valuation Report",
  },
  sections: [],
  footer: {
    text: "Confidential - For internal use only",
    show_page_numbers: true,
  },
};

export default function TemplateBuilder() {
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [config, setConfig] = useState<TemplateConfig>(DEFAULT_CONFIG);
  const [name, setName] = useState("My Template");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [archivedTemplates, setArchivedTemplates] = useState<ReportTemplate[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadTemplate = useCallback(async () => {
    try {
      const [fieldOptions, activeTemplate] = await Promise.allSettled([
        api.get<TemplateFieldOption[]>("/api/lender/templates/fields"),
        api.get<ReportTemplate>("/api/lender/templates/active"),
      ]);

      const fields =
        fieldOptions.status === "fulfilled" ? fieldOptions.value : [];

      if (activeTemplate.status === "fulfilled") {
        const t = activeTemplate.value;
        setTemplate(t);
        setName(t.name);
        setConfig(t.config_json as TemplateConfig);
      } else {
        const defaultSections: TemplateSectionField[] = fields.map(
          (f, i) => ({
            key: f.key,
            label: f.label,
            enabled: ["property_address", "property_type", "valuation_amount", "loan_applicant_name", "report_date"].includes(f.key),
            order: i + 1,
          })
        );
        setConfig((prev) => ({ ...prev, sections: defaultSections }));
      }
    } catch {
      // Ignore — no active template is valid
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function loadHistory() {
    try {
      const data = await api.get<{ templates: ReportTemplate[] }>("/api/lender/templates/");
      setArchivedTemplates(data.templates.filter((t) => !t.is_active));
      setShowHistory(true);
    } catch {
      toast.error("Failed to load template history");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { name, config_json: config };
      let saved: ReportTemplate;

      if (template) {
        saved = await api.put<ReportTemplate>(`/api/lender/templates/${template.id}`, payload);
      } else {
        saved = await api.post<ReportTemplate>("/api/lender/templates/", payload);
      }

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        saved = await api.upload<ReportTemplate>(`/api/lender/templates/${saved.id}/logo`, formData);
      }

      setTemplate(saved);
      toast.success("Template saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      const activated = await api.patch<ReportTemplate>(`/api/lender/templates/${id}/activate`, {});
      setTemplate(activated);
      setName(activated.name);
      setConfig(activated.config_json as TemplateConfig);
      setShowHistory(false);
      toast.success("Template activated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to activate");
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Logo must be PNG or JPEG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Template name */}
      <div className="space-y-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input
          id="template-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Header Config */}
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {(logoPreview || template?.logo_path) && (
                <img
                  src={logoPreview || `/api/media/${template?.logo_path}`}
                  alt="Logo preview"
                  className="h-10 object-contain border border-border rounded px-2 py-1"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoChange}
                className="text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                type="text"
                value={config.header.bank_name}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, bank_name: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                type="text"
                value={config.header.subtitle}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, subtitle: e.target.value } }))
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.header.primary_color}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                  }
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <Input
                  type="text"
                  value={config.header.primary_color}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.header.secondary_color}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                  }
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <Input
                  type="text"
                  value={config.header.secondary_color}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                  }
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Selection & Ordering */}
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Drag to reorder. Check to include in the template.</p>
          <FieldList
            fields={config.sections}
            onChange={(sections) => setConfig((c) => ({ ...c, sections }))}
          />
        </CardContent>
      </Card>

      {/* Footer Config */}
      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="footer-text">Footer Text</Label>
            <Input
              id="footer-text"
              type="text"
              value={config.footer.text}
              onChange={(e) =>
                setConfig((c) => ({ ...c, footer: { ...c.footer, text: e.target.value } }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={config.footer.show_page_numbers}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  footer: { ...c.footer, show_page_numbers: e.target.checked },
                }))
              }
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            Show page numbers
          </label>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Template"}
        </Button>
        <Button variant="link" onClick={loadHistory} className="text-primary">
          Template History
        </Button>
      </div>

      {/* Template History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Archived Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {archivedTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground">No archived templates.</p>
            )}
            {archivedTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActivate(t.id)}
                >
                  Activate
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
