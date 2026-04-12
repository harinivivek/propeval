"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { InvoiceResponse, GenerateInvoicesResponse } from "@/types/billing";
import { InvoiceTable } from "./_components/invoice-table";

function getLast12Months(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

const MONTHS = getLast12Months();

type Tab = "LENDER_PAYABLE" | "VENDOR_RECEIVABLE";

export default function AdminBillingPage() {
  const [month, setMonth] = useState(MONTHS[0].value);
  const [allInvoices, setAllInvoices] = useState<InvoiceResponse[]>([]);
  const [tab, setTab] = useState<Tab>("LENDER_PAYABLE");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<InvoiceResponse[]>(
        `/api/admin/billing/invoices?month=${month}`
      );
      setAllInvoices(data);
    } catch {
      setAllInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await api.post<GenerateInvoicesResponse>(
        "/api/admin/billing/generate",
        { month }
      );
      setGenerateResult(`Generated ${res.count} invoice(s).`);
      fetchInvoices();
    } catch (err) {
      setGenerateResult(err instanceof Error ? err.message : "Failed to generate invoices.");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const baseUrl =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? "http://localhost:8020"
          : (process.env.NEXT_PUBLIC_API_URL || "");
      const blob = await fetch(
        `${baseUrl}/api/admin/billing/export?month=${month}&invoice_type=${tab}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore export errors
    }
  };

  const tabInvoices = allInvoices.filter((i) => i.invoice_type === tab);

  // Summary stats across all invoices
  const totalPayables = allInvoices
    .filter((i) => i.invoice_type === "LENDER_PAYABLE")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const totalReceivables = allInvoices
    .filter((i) => i.invoice_type === "VENDOR_RECEIVABLE")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const pendingCount = allInvoices.filter((i) => i.status === "PENDING").length;
  const paidCount = allInvoices.filter((i) => i.status === "PAID").length;

  const formatCurrency = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Invoices"}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {generateResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          {generateResult}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Payables</p>
          <p className="text-lg font-semibold">{formatCurrency(totalPayables)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Receivables</p>
          <p className="text-lg font-semibold">{formatCurrency(totalReceivables)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Pending</p>
          <p className="text-lg font-semibold">{pendingCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Paid</p>
          <p className="text-lg font-semibold">{paidCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-0">
          <button
            onClick={() => setTab("LENDER_PAYABLE")}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
              tab === "LENDER_PAYABLE"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Lender Payables
          </button>
          <button
            onClick={() => setTab("VENDOR_RECEIVABLE")}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
              tab === "VENDOR_RECEIVABLE"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Vendor Receivables
          </button>
        </div>
      </div>

      {/* Invoice table */}
      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading invoices...</p>
      ) : (
        <InvoiceTable invoices={tabInvoices} onRefresh={fetchInvoices} />
      )}
    </div>
  );
}
