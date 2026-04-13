"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Desktop/Tablet: Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Email</TableHead>
                <TableHead className="px-4 hidden lg:table-cell">Mobile</TableHead>
                <TableHead className="px-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users found.</TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="px-4 py-3 font-medium">{u.full_name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{u.mobile}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={u.is_active ? "outline" : "secondary"} className={u.is_active ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 dark:border-green-800" : ""}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {loading && <p className="text-center text-muted-foreground py-8">Loading...</p>}
        {!loading && users.length === 0 && <p className="text-center text-muted-foreground py-8">No users found.</p>}
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{u.full_name}</div>
                <Badge variant={u.is_active ? "outline" : "secondary"} className={u.is_active ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 dark:border-green-800" : ""}>
                  {u.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{u.email}</div>
              <div className="text-sm text-muted-foreground">{u.mobile}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
