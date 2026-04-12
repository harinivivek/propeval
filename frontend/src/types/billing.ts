export interface InvoiceResponse {
  id: string;
  invoice_type: string;
  organization_id: string;
  amount: string;
  status: string;
  month: string;
  generated_at: string | null;
  invoice_number: string | null;
  line_items_count: number;
  notes: string | null;
  org_name: string;
}

export interface BillingEntry {
  id: string;
  report_id: string;
  request_id: string | null;
  amount: string;
  entry_type: string;
  created_at: string;
}

export interface InvoiceDetailResponse extends InvoiceResponse {
  entries: BillingEntry[];
}

export interface BillingEntriesWithInvoice {
  entries: BillingEntry[];
  invoice_number: string | null;
  invoice_status: string | null;
}

export interface GenerateInvoicesResponse {
  count: number;
  invoices: {
    id: string;
    invoice_number: string | null;
    invoice_type: string;
    amount: string;
    status: string;
  }[];
}

export interface BulkStatusResponse {
  updated: string[];
  skipped: string[];
}
