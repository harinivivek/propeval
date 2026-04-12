"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Lender, LenderBranch, LenderUser } from "@/types/user";

export default function AdminLenderDetailPage() {
  const params = useParams<{ id: string }>();
  const [lender, setLender] = useState<Lender | null>(null);
  const [branches, setBranches] = useState<LenderBranch[]>([]);
  const [users, setUsers] = useState<LenderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [saving, setSaving] = useState(false);

  // Add branch state
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchCity, setBranchCity] = useState("");

  // Add user state
  const [showUserForm, setShowUserForm] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("MAKER");

  useEffect(() => {
    async function load() {
      try {
        const l = await api.get<Lender>(`/api/admin/lenders/${params.id}`);
        setLender(l);
        setEditName(l.name);
        setEditCity(l.city ?? "");
      } catch {
        setError("Lender not found");
        setLoading(false);
        return;
      }
      // Load sub-resources independently
      api.get<LenderBranch[]>(`/api/admin/lenders/${params.id}/branches`)
        .then(setBranches)
        .catch(() => {});
      api.get<LenderUser[]>(`/api/admin/lenders/${params.id}/users`)
        .then(setUsers)
        .catch(() => {});
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<Lender>(`/api/admin/lenders/${params.id}`, {
        name: editName,
        city: editCity || null,
      });
      setLender(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const branch = await api.post<LenderBranch>(
        `/api/admin/lenders/${params.id}/branches`,
        { name: branchName, city: branchCity || null }
      );
      setBranches((prev) => [...prev, branch]);
      setBranchName("");
      setBranchCity("");
      setShowBranchForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add branch");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const user = await api.post<LenderUser>(
        `/api/admin/lenders/${params.id}/users`,
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
      setUserRole("MAKER");
      setShowUserForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (error && !lender) {
    return (
      <div className="space-y-4">
        <a href="/admin/accounts/lenders" className="text-blue-600 hover:underline text-sm">
          ← Back to Lenders
        </a>
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!lender) return null;

  return (
    <div className="space-y-6">
      <a href="/admin/accounts/lenders" className="text-blue-600 hover:underline text-sm">
        ← Back to Lenders
      </a>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Lender Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">{lender.name}</h1>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-sm text-blue-600 hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">City:</span>{" "}
              <span className="text-gray-900">{lender.city ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Organization ID:</span>{" "}
              <span className="text-gray-900 font-mono text-xs">{lender.organization_id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Branches */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Branches</h2>
          <button
            onClick={() => setShowBranchForm((v) => !v)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            {showBranchForm ? "Cancel" : "Add Branch"}
          </button>
        </div>

        {showBranchForm && (
          <form onSubmit={handleAddBranch} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Branch Name *</label>
                <input
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Main Branch"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mumbai"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Add Branch"}
            </button>
          </form>
        )}

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">City</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                    No branches yet.
                  </td>
                </tr>
              )}
              {branches.map((b) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{b.name}</td>
                  <td className="px-4 py-2 text-gray-600">{b.city ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {branches.length === 0 && (
            <p className="text-center text-gray-400 py-4">No branches yet.</p>
          )}
          {branches.map((b) => (
            <div key={b.id} className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-900">{b.name}</div>
              <div className="text-sm text-gray-500">{b.city ?? "—"}</div>
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
                  placeholder="user@bank.com"
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
                  <option value="MAKER">Maker</option>
                  <option value="CHECKER">Checker</option>
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
