import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accentColor?: string;
  /** @deprecated Use accentColor instead. Kept for backward compatibility. */
  color?: string;
}

const colorMap: Record<string, { border: string; iconBg: string; iconText: string }> = {
  teal: { border: "border-l-teal-500", iconBg: "bg-teal-50", iconText: "text-teal-600" },
  amber: { border: "border-l-amber-500", iconBg: "bg-amber-50", iconText: "text-amber-600" },
  emerald: { border: "border-l-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  blue: { border: "border-l-blue-500", iconBg: "bg-blue-50", iconText: "text-blue-600" },
  purple: { border: "border-l-purple-500", iconBg: "bg-purple-50", iconText: "text-purple-600" },
  orange: { border: "border-l-orange-500", iconBg: "bg-orange-50", iconText: "text-orange-600" },
  red: { border: "border-l-red-500", iconBg: "bg-red-50", iconText: "text-red-600" },
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  accentColor = "teal",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  color: _deprecated,
}: MetricCardProps) {
  const colors = colorMap[accentColor] || colorMap.teal;

  return (
    <Card className={cn("border-l-4 shadow-sm", colors.border)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex items-center justify-center h-10 w-10 rounded-lg", colors.iconBg)}>
          <Icon className={cn("h-5 w-5", colors.iconText)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
