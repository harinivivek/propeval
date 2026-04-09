"use client";

import type { ReportRequestCreate } from "@/types/request";

type Props = {
  data: ReportRequestCreate;
  price: string | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function PriceConfirmation({ data, price, submitting, onBack, onConfirm }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Confirm & Submit</h2>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
        <h3 className="font-medium text-gray-900">Request Summary</h3>
        <div className="grid grid-cols-2 gap-2 text-gray-700">
          <span className="text-gray-500">Property:</span>
          <span>{data.property_address}</span>
          <span className="text-gray-500">City:</span>
          <span>{data.city}{data.area ? `, ${data.area}` : ""}</span>
          <span className="text-gray-500">Type:</span>
          <span>{data.property_type}</span>
          <span className="text-gray-500">Category:</span>
          <span>{data.report_category}</span>
          <span className="text-gray-500">Applicant:</span>
          <span>{data.loan_applicant_name}</span>
          <span className="text-gray-500">Vendor:</span>
          <span>{data.vendor_specified_id ? "Specified" : "Auto-assign (broadcast)"}</span>
        </div>
      </div>

      {price && (
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-600">Estimated Price</p>
          <p className="text-2xl font-bold text-blue-900">₹{price}</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Price will be calculated based on your lender&apos;s pricing configuration.
        The final price will be shown after submission.
      </p>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} disabled={submitting}
          className="border px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
          Back
        </button>
        <button onClick={onConfirm} disabled={submitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </div>
  );
}
