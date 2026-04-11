export interface TemplateSectionField {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface TemplateHeader {
  bank_name: string;
  primary_color: string;
  secondary_color: string;
  show_logo: boolean;
  subtitle: string;
}

export interface TemplateFooter {
  text: string;
  show_page_numbers: boolean;
}

export interface TemplateConfig {
  header: TemplateHeader;
  sections: TemplateSectionField[];
  footer: TemplateFooter;
}

export interface ReportTemplate {
  id: string;
  lender_id: string;
  name: string;
  is_active: boolean;
  logo_path: string | null;
  config_json: TemplateConfig;
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  templates: ReportTemplate[];
}

export interface TemplateFieldOption {
  key: string;
  label: string;
}
