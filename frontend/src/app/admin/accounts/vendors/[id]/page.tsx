"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Vendor, VendorUser, ServiceArea } from "@/types/user";

export default function AdminVendorDetailPage() {
  const params = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [users, setUsers] = useState<VendorUser[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editArea, setEditArea] = useState("");
  const [saving, setSaving] = useState(false);

  // Add user state
  const [showUserForm, setShowUserForm] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("FIELD_AGENT");

  // Add service area state
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [saCity, setSaCity] = useState("");
  const [saAreas, setSaAreas] = useState("");
  const [saServiceType, setSaServiceType] = useState("VALUATION");

  useEffect(() => {
    async function load() {
      try {
        const v = await api.get<Vendor>(`/api/admin/vendors/${params.id}`);
        setVendor(v);
        setEditName(v.name);
        setEditCity(v.office_city ?? "");
        setEditArea(v.office_area ?? "");
      } catch {
        setError("Vendor not found");
        setLoading(false);
        return;
      }
      // Load sub-resources independently
      api.get<VendorUser[]>(`/api/admin/vendors/${params.id}/users`)
        .then(setUsers)
        .catch(() => {});
      api.get<ServiceArea[]>(`/api/admin/vendors/${params.id}/service-areas`)
        .then(setServiceAreas)
        .catch(() => {});
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<Vendor>(`/api/admin/vendors/${params.id}`, {
        name: editName,
        office_city: editCity || null,
        office_area: editArea || null,
      });
      setVendor(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const user = await api.post<VendorUser>(
        `/api/admin/vendors/${params.id}/users`,
        {
          email: userEmail,
          mobile: userMobile,
          full_name: userFullName,
          password: userPassword,
          role: userRole,
        }
      );
      setUsers((prev) => [...prev, user]);
      setUserEmail("");
      setUserMobile("");
      setUserFullName("");
      setUserPassword("");
      setUserRole("FIELD_AGENT");
      setShowUserForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddServiceArea(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const areas = saAreas
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const sa = await api.post<ServiceArea>(
        `/api/admin/vendors/${params.id}/service-areas`,
        {
          city: saCity,
          areas: areas.length > 0 ? areas : null,
          service_type: saServiceType,
        }
      );
      setServiceAreas((prev) => [...prev, sa]);
      setSaCity("");
      setSaAreas("");
      setSaServiceType("VALUATION");
      setShowAreaForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service area");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (error && !vendor) {
    return (
      <div className="space-y-4">
        <a href="/admin/accounts/vendors" className="text-blue-600 hover:underline text-sm">
          ← Back to Vendors
        </a>
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!vendor) return null;

  return (
    <div className="space-y-6">
      <a href="/admin/accounts/vendors" className="text-blue-600 hover:underline text-sm">
        ← Back to Vendors
      </a>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vendor Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">{vendor.name}</h1>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-sm text-blue-600 hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Area</label>
                <input
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">City:</span>{" "}
              <span className="text-gray-900">{vendor.office_city ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Area:</span>{" "}
              <span className="text-gray-900">{vendor.office_area ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Services:</span>{" "}
              <span className="text-gray-900">
                {vendor.services?.join(", ") ?? "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Service Areas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Service Areas</h2>
          <button
            onClick={() => setShowAreaForm((v) => !v)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            {showAreaForm ? "Cancel" : "Add Service Area"}
          </button>
        </div>

        {showAreaForm && (
          <form onSubmit={handleAddServiceArea} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                <input
                  required
                  value={saCity}
                  onChange={(e) => setSaCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Areas (comma-separated)</label>
                <input
                  value={saAreas}
                  onChange={(e) => setSaAreas(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Andheri, Bandra, Juhu"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
                <select
                  value={saServiceType}
                  onChange={(e) => setSaServiceType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VALUATION">Valuation</option>
                  <option value="LEGAL">Legal</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Add Service Area"}
            </button>
          </form>
        )}

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">City</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Areas</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
              </tr>
            </thead>
            <tbody>
              {serviceAreas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No service areas yet.
                  </td>
                </tr>
              )}
              {serviceAreas.map((sa) => (
                <tr key={sa.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{sa.city}</td>
                  <td className="px-4 py-2 text-gray-600">{sa.areas?.join(", ") ?? "All areas"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                      sa.service_type === "LEGAL"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {sa.service_type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {serviceAreas.length === 0 && (
            <p className="text-center text-gray-400 py-4">No service areas yet.</p>
          )}
          {serviceAreas.map((sa) => (
            <div key={sa.id} className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{sa.city}</span>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                  sa.service_type === "LEGAL"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-green-100 text-green-800"
                }`}>
                  {sa.service_type}
                </span>
              </div>
              <div className="text-sm text-gray-500">{sa.areas?.join(", ") ?? "All areas"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          <button
            onClick={() => setShowUserForm((v) => !v)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            {showUserForm ? "Cancel" : "Add User"}
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleAddUser} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  required
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@vendor.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mobile *</label>
                <input
                  required
                  value={userMobile}
                  onChange={(e) => setUserMobile(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9876543210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input
                  required
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FIELD_AGENT">Field Agent</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Add User"}
            </button>
          </form>
        )}

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">User ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900 font-mono text-xs">{u.user_id}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {users.length === 0 && (
            <p className="text-center text-gray-400 py-4">No users yet.</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-gray-900 font-mono text-xs">{u.user_id.slice(0, 8)}…</span>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                {u.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
