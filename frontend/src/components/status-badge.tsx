import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  SENT: "bg-blue-100 text-blue-800 border-blue-200",
  BROADCAST: "bg-blue-100 text-blue-800 border-blue-200",
  ACCEPTED: "bg-teal-100 text-teal-800 border-teal-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SUBMITTED: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RECEIVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
  EXPIRED: "bg-gray-100 text-gray-800 border-gray-200",
  REVISION: "bg-orange-100 text-orange-800 border-orange-200",
  GTR_REVIEW: "bg-violet-100 text-violet-800 border-violet-200",
  UPLOADED: "bg-gray-100 text-gray-700 border-gray-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  EXTRACTION_FAILED: "bg-red-100 text-red-700 border-red-200",
  READY_TO_PUBLISH: "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED: "bg-gray-100 text-gray-500 border-gray-200",
  BILLED: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  NEW: "bg-gray-100 text-gray-700 border-gray-200",
  VERIFIED: "bg-blue-100 text-blue-700 border-blue-200",
  TOP_VALUER: "bg-amber-100 text-amber-700 border-amber-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  const label = status.replace(/_/g, " ");

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium border", style, className)}
    >
      {label}
    </Badge>
  );
}
