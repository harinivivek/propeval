"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequestCreate, ReportRequest } from "@/types/request";
import { PropertyForm } from "./_components/property-form";
import { ReportConfigForm } from "./_components/report-config-form";
import { PriceConfirmation } from "./_components/price-confirmation";

type FormData = Partial<ReportRequestCreate>;

export default function NewRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [price, setPrice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleStep2Complete = async (data: Partial<FormData>) => {
    updateForm(data);
    setError("");
    const merged = { ...formData, ...data };
    try {
      const params = new URLSearchParams({
        lender_id: "",
        report_category: merged.report_category || "",
        city: merged.city || "",
        property_type: merged.property_type || "",
        request_type: "NEW",
        ...(merged.area ? { area: merged.area } : {}),
      });
      setStep(3);
    } catch {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await api.post<ReportRequest>(
        "/api/lender/requests/",
        formData as ReportRequestCreate,
      );
      router.push(`/lender/requests/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create request");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Raise New Request</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-12 h-0.5 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <PropertyForm
          data={formData}
          onNext={(data) => {
            updateForm(data);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ReportConfigForm
          data={formData}
          onBack={() => setStep(1)}
          onNext={handleStep2Complete}
        />
      )}

      {step === 3 && (
        <PriceConfirmation
          data={formData as ReportRequestCreate}
          price={price}
          submitting={submitting}
          onBack={() => setStep(2)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
