"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ActivityLogEntry, ActivityLogListResponse } from "@/types/activity";

const ACTION_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Request Created",
  REQUEST_ACCEPTED: "Request Accepted",
  REQUEST_REJECTED: "Request Rejected",
  REQUEST_CANCELLED: "Request Cancelled",
  REPORT_UPLOADED: "Report Uploaded",
  REPORT_PUBLISHED: "Report Published",
  REPORT_REVISION_REQUESTED: "Revision Requested",
  REPORT_REVISED: "Report Revised",
  LISTING_CREATED: "Listing Created",
  LISTING_DELISTED: "Listing Delisted",
  LISTING_PURCHASED: "Listing Purchased",
  USER_CREATED: "User Created",
  USER_DEACTIVATED: "User Deactivated",
  USER_LOGIN: "User Login",
  PRICING_RULE_CREATED: "Pricing Rule Created",
  PRICING_RULE_UPDATED: "Pricing Rule Updated",
  TEMPLATE_CREATED: "Template Created",
  TEMPLATE_UPDATED: "Template Updated",
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  LENDER: "bg-blue-100 text-blue-700",
  VENDOR: "bg-green-100 text-green-700",
  ADMIN: "bg-purple-100 text-purple-700",
  SYSTEM: "bg-gray-100 text-gray-700",
};

export function ActivityTab() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (actionFilter) params.set("action", actionFilter);
      if (actorTypeFilter) params.set("actor_type", actorTypeFilter);
      if (targetTypeFilter) params.set("target_type", targetTypeFilter);
      const res = await api.get<ActivityLogListResponse>(
        `/api/admin/activity/?${params}`
      );
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, actorTypeFilter, targetTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (actorTypeFilter) params.set("actor_type", actorTypeFilter);
    if (targetTypeFilter) params.set("target_type", targetTypeFilter);
    const token = localStorage.getItem("access_token");
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/activity/export?${params}&token=${token}`,
      "_blank"
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select
          value={actorTypeFilter}
          onChange={(e) => { setActorTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        >
          <option value="">All Roles</option>
          <option value="LENDER">Lender</option>
          <option value="VENDOR">Vendor</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-52"
        >
          <option value="">All Actions</option>
          <optgroup label="Requests">
            <option value="REQUEST_CREATED">Request Created</option>
            <option value="REQUEST_ACCEPTED">Request Accepted</option>
            <option value="REQUEST_REJECTED">Request Rejected</option>
            <option value="REQUEST_CANCELLED">Request Cancelled</option>
          </optgroup>
          <optgroup label="Reports">
            <option value="REPORT_UPLOADED">Report Uploaded</option>
            <option value="REPORT_PUBLISHED">Report Published</option>
            <option value="REPORT_REVISION_REQUESTED">Revision Requested</option>
            <option value="REPORT_REVISED">Report Revised</option>
          </optgroup>
          <optgroup label="Listings">
            <option value="LISTING_CREATED">Listing Created</option>
            <option value="LISTING_DELISTED">Listing Delisted</option>
            <option value="LISTING_PURCHASED">Listing Purchased</option>
          </optgroup>
          <optgroup label="Users">
            <option value="USER_CREATED">User Created</option>
            <option value="USER_DEACTIVATED">User Deactivated</option>
            <option value="USER_LOGIN">User Login</option>
          </optgroup>
          <optgroup label="Admin">
            <option value="PRICING_RULE_CREATED">Pricing Rule Created</option>
            <option value="PRICING_RULE_UPDATED">Pricing Rule Updated</option>
            <option value="TEMPLATE_CREATED">Template Created</option>
            <option value="TEMPLATE_UPDATED">Template Updated</option>
          </optgroup>
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        >
          <option value="">All Targets</option>
          <option value="REQUEST">Request</option>
          <option value="REPORT">Report</option>
          <option value="LISTING">Listing</option>
          <option value="USER">User</option>
          <option value="PRICING_RULE">Pricing Rule</option>
          <option value="TEMPLATE">Template</option>
        </select>
        <button
          onClick={exportCsv}
          className="px-4 py-2 text-sm bg-gray-100 border rounded hover:bg-gray-200 sm:ml-auto"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading activity logs...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-sm">No activity logs found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">Timestamp</th>
                  <th className="text-left px-4 py-2 border-b">User</th>
                  <th className="text-left px-4 py-2 border-b">Action</th>
                  <th className="text-left px-4 py-2 border-b">Target</th>
                  <th className="text-left px-4 py-2 border-b">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ACTOR_TYPE_COLORS[log.actor_type] || "bg-gray-100"}`}>
                          {log.actor_type}
                        </span>
                        <span>{log.actor_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {log.target_type}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {log.ip_address || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTOR_TYPE_COLORS[log.actor_type] || "bg-gray-100"}`}>
                    {log.actor_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(log.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">{log.actor_name}</p>
                <p className="text-sm text-gray-600">
                  {ACTION_LABELS[log.action] || log.action} — {log.target_type}
                </p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
