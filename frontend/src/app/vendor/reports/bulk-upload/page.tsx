"use client";

import { useRouter } from "next/navigation";
import type { BulkUploadJob } from "@/types/bulk-upload";
import { FilePicker } from "./_components/file-picker";

export default function BulkUploadPage() {
  const router = useRouter();

  const handleJobCreated = (newJob: BulkUploadJob) => {
    router.push(`/vendor/reports/bulk-jobs/${newJob.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => router.push("/vendor/reports")}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back to reports
      </button>

      <h1 className="text-2xl font-bold mb-2">Bulk Upload Reports</h1>
      <p className="text-sm text-gray-600 mb-6">
        Upload multiple PDF reports at once. Each report will be automatically processed
        to extract property details.
      </p>

      <FilePicker onJobCreated={handleJobCreated} />
    </div>
  );
}
