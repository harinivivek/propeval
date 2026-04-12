"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { InvoiceResponse, BillingEntry, BulkStatusResponse } from "@/types/billing";

interface InvoiceTableProps {
  invoices: InvoiceResponse[];
  onRefresh: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

const STATUS_OPTIONS = ["PENDING", "BILLED", "PAID"];

export function InvoiceTable({ invoices, onRefresh }: InvoiceTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const allSelected = invoices.length > 0 && selected.size === invoices.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEntries([]);
      return;
    }
    setExpandedId(id);
    setLoadingEntries(true);
    try {
      const data = await api.get<{ entries: BillingEntry[] }>(
        `/api/admin/billing/invoices/${id}`
      );
      setEntries(data.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setStatusLoading(id);
    try {
      await api.patch(`/api/admin/billing/invoices/${id}/status`, { status });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setStatusLoading(null);
    }
  };

  const handleBulkAction = async (status: string) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await api.post<BulkStatusResponse>("/api/admin/billing/invoices/bulk-status", {
        invoice_ids: Array.from(selected),
        status,
      });
      setSelected(new Set());
      onRefresh();
    } catch {
      // ignore
    } finally {
      setBulkLoading(false);
    }
  };

  const formatCurrency = (amt: string) =>
    `₹${Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  if (invoices.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">No invoices found for this period.</p>
    );
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
          <span className="text-sm font-medium text-blue-800">
            {selected.size} selected
          </span>
          <button
            onClick={() => handleBulkAction("BILLED")}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Mark as Billed
          </button>
          <button
            onClick={() => handleBulkAction("PAID")}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Mark as Paid
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Organization</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <DesktopRow
                key={inv.id}
                invoice={inv}
                isSelected={selected.has(inv.id)}
                isExpanded={expandedId === inv.id}
                entries={expandedId === inv.id ? entries : []}
                loadingEntries={loadingEntries && expandedId === inv.id}
                statusLoading={statusLoading === inv.id}
                onToggleSelect={() => toggleSelect(inv.id)}
                onToggleExpand={() => handleExpand(inv.id)}
                onStatusChange={(s) => handleStatusChange(inv.id, s)}
                formatCurrency={formatCurrency}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {invoices.map((inv) => (
          <MobileCard
            key={inv.id}
            invoice={inv}
            isSelected={selected.has(inv.id)}
            isExpanded={expandedId === inv.id}
            entries={expandedId === inv.id ? entries : []}
            loadingEntries={loadingEntries && expandedId === inv.id}
            statusLoading={statusLoading === inv.id}
            onToggleSelect={() => toggleSelect(inv.id)}
            onToggleExpand={() => handleExpand(inv.id)}
            onStatusChange={(s) => handleStatusChange(inv.id, s)}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Desktop Row ─── */
interface RowProps {
  invoice: InvoiceResponse;
  isSelected: boolean;
  isExpanded: boolean;
  entries: BillingEntry[];
  loadingEntries: boolean;
  statusLoading: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onStatusChange: (s: string) => void;
  formatCurrency: (a: string) => string;
}

function DesktopRow({
  invoice,
  isSelected,
  isExpanded,
  entries,
  loadingEntries,
  statusLoading,
  onToggleSelect,
  onToggleExpand,
  onStatusChange,
  formatCurrency,
}: RowProps) {
  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded"
          />
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          {invoice.invoice_number || "—"}
        </td>
        <td className="px-4 py-3">{invoice.org_name}</td>
        <td className="px-4 py-3 text-right font-medium">
          {formatCurrency(invoice.amount)}
        </td>
        <td className="px-4 py-3 text-center">{invoice.line_items_count}</td>
        <td className="px-4 py-3 text-center">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {invoice.status}
          </span>
        </td>
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <select
            value={invoice.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={statusLoading}
            className="text-xs border rounded px-2 py-1 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-6 py-4">
            {loadingEntries ? (
              <p className="text-sm text-gray-500">Loading entries...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-gray-500">No billing entries.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left pb-2">Type</th>
                    <th className="text-left pb-2">Report ID</th>
                    <th className="text-right pb-2">Amount</th>
                    <th className="text-right pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-1.5">{e.entry_type}</td>
                      <td className="py-1.5 font-mono">{e.report_id.slice(0, 8)}...</td>
                      <td className="py-1.5 text-right">{formatCurrency(e.amount)}</td>
                      <td className="py-1.5 text-right">
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Mobile Card ─── */
function MobileCard({
  invoice,
  isSelected,
  isExpanded,
  entries,
  loadingEntries,
  statusLoading,
  onToggleSelect,
  onToggleExpand,
  onStatusChange,
  formatCurrency,
}: RowProps) {
  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded mt-1"
          />
          <div className="flex-1 min-w-0" onClick={onToggleExpand}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm truncate">{invoice.org_name}</span>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.status] ?? "bg-gray-100 text-gray-700"}`}
              >
                {invoice.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{invoice.invoice_number || "No invoice #"}</span>
              <span>{invoice.line_items_count} items</span>
            </div>
            <div className="text-lg font-semibold">{formatCurrency(invoice.amount)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-gray-500">Status:</label>
          <select
            value={invoice.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={statusLoading}
            className="text-xs border rounded px-2 py-1 flex-1 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-gray-50 px-4 py-3">
          {loadingEntries ? (
            <p className="text-xs text-gray-500">Loading entries...</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-500">No billing entries.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-medium">{e.entry_type}</span>
                    <span className="text-gray-400 ml-2">
                      {e.report_id.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
