export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-4">GTR Admin</h2>
        <nav className="space-y-2 text-sm">
          <a href="/admin/dashboard" className="block p-2 rounded hover:bg-gray-100">Dashboard</a>
          <a href="/admin/accounts/lenders" className="block p-2 rounded hover:bg-gray-100">Lenders</a>
          <a href="/admin/accounts/vendors" className="block p-2 rounded hover:bg-gray-100">Vendors</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
