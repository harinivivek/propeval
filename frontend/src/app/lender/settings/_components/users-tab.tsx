"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/auth";

export default function UsersTab() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<UserResponse[]>("/api/lender/settings/users")
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Desktop/Tablet: Table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Mobile</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users found.</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{u.mobile}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {loading && <p className="text-center text-gray-400 py-8">Loading…</p>}
        {!loading && users.length === 0 && <p className="text-center text-gray-400 py-8">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900">{u.full_name}</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {u.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-sm text-gray-500">{u.email}</div>
            <div className="text-sm text-gray-500">{u.mobile}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
