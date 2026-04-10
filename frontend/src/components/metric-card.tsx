import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
}

export function MetricCard({ label, value, icon: Icon, color = "text-blue-600" }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-4 min-w-[160px]">
      <div className={`p-3 rounded-lg bg-gray-50 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
