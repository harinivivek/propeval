import SystemConfigForm from "./_components/system-config-form";

export default function AdminSettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>
      <SystemConfigForm />
    </div>
  );
}
