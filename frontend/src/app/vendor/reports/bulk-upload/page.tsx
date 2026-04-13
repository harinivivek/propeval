"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { BulkUploadJob } from "@/types/bulk-upload";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FilePicker } from "./_components/file-picker";

export default function BulkUploadPage() {
  const router = useRouter();

  const handleJobCreated = (newJob: BulkUploadJob) => {
    router.push(`/vendor/reports/bulk-jobs/${newJob.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/vendor/requests")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      <PageHeader
        title="Bulk Upload Reports"
        description="Upload multiple PDF reports at once. Each report will be automatically processed to extract property details."
      />

      <FilePicker onJobCreated={handleJobCreated} />
    </div>
  );
}
