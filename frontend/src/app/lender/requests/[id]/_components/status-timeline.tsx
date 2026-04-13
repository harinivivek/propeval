"use client";

import type { LenderRequestStatus } from "@/types/request";

const STEPS: { status: LenderRequestStatus; label: string }[] = [
  { status: "SENT", label: "Sent" },
  { status: "AWAITED", label: "Awaited" },
  { status: "RECEIVED", label: "Received" },
  { status: "ACCEPTED", label: "Accepted" },
];

const STATUS_ORDER: Record<string, number> = {
  SENT: 0, AWAITED: 1, RECEIVED: 2, ACCEPTED: 3,
  SENT_FOR_REVIEW: 2, REJECTED: -1,
};

export function StatusTimeline({ status }: { status: LenderRequestStatus }) {
  const currentIndex = STATUS_ORDER[status] ?? -1;

  return (
    <>
      {/* Desktop horizontal */}
      <div className="hidden sm:flex items-center gap-2 mb-6">
        {STEPS.map((step, i) => (
          <div key={step.status} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= currentIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i <= currentIndex ? "\u2713" : i + 1}
              </div>
              <span className="text-xs mt-1 text-muted-foreground">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mb-5 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Mobile vertical */}
      <div className="sm:hidden space-y-3 mb-6">
        {STEPS.map((step, i) => (
          <div key={step.status} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                i <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i <= currentIndex ? "\u2713" : i + 1}
            </div>
            <span className={`text-sm ${i <= currentIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {status === "SENT_FOR_REVIEW" && (
        <div className="bg-orange-50 text-orange-800 text-sm px-4 py-2 rounded-lg mb-4">
          Report sent back for revision — awaiting vendor resubmission
        </div>
      )}
    </>
  );
}
