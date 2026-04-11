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
    return <p className="text-center text-gray-400 py-8">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Template name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Header Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Header</h3>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Logo</label>
          <div className="flex items-center gap-4">
            {(logoPreview || template?.logo_path) && (
              <img
                src={logoPreview || `/api/media/${template?.logo_path}`}
                alt="Logo preview"
                className="h-10 object-contain border border-gray-200 rounded px-2 py-1"
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoChange}
              className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
            <input
              type="text"
              value={config.header.bank_name}
              onChange={(e) =>
                setConfig((c) => ({ ...c, header: { ...c.header, bank_name: e.target.value } }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Subtitle</label>
            <input
              type="text"
              value={config.header.subtitle}
              onChange={(e) =>
                setConfig((c) => ({ ...c, header: { ...c.header, subtitle: e.target.value } }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.header.primary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                }
                className="h-9 w-9 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={config.header.primary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.header.secondary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                }
                className="h-9 w-9 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={config.header.secondary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Field Selection & Ordering */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Fields</h3>
        <p className="text-xs text-gray-500">Drag to reorder. Check to include in the template.</p>
        <FieldList
          fields={config.sections}
          onChange={(sections) => setConfig((c) => ({ ...c, sections }))}
        />
      </div>

      {/* Footer Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Footer</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Footer Text</label>
          <input
            type="text"
            value={config.footer.text}
            onChange={(e) =>
              setConfig((c) => ({ ...c, footer: { ...c.footer, text: e.target.value } }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.footer.show_page_numbers}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                footer: { ...c.footer, show_page_numbers: e.target.checked },
              }))
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show page numbers
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Template"}
        </button>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Template History
        </button>
      </div>

      {/* Template History */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-900">Archived Templates</h3>
          {archivedTemplates.length === 0 && (
            <p className="text-sm text-gray-400">No archived templates.</p>
          )}
          {archivedTemplates.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-400">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleActivate(t.id)}
                className="text-xs px-3 py-1 border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50"
              >
                Activate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
