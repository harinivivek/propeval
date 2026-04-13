"use client";

import type { ReportRequestCreate } from "@/types/request";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <h2 className="text-lg font-semibold text-foreground">Confirm & Submit</h2>

      <Card>
        <CardHeader>
          <CardTitle>Request Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Property:</span>
            <span className="text-foreground">{data.property_address}</span>
            <span className="text-muted-foreground">City:</span>
            <span className="text-foreground">{data.city}{data.area ? `, ${data.area}` : ""}</span>
            <span className="text-muted-foreground">Type:</span>
            <span className="text-foreground">{data.property_type}</span>
            <span className="text-muted-foreground">Category:</span>
            <span className="text-foreground">{data.report_category}</span>
            <span className="text-muted-foreground">Applicant:</span>
            <span className="text-foreground">{data.loan_applicant_name}</span>
            <span className="text-muted-foreground">Vendor:</span>
            <span className="text-foreground">{data.vendor_specified_id ? "Specified" : "Auto-assign (broadcast)"}</span>
          </div>
        </CardContent>
      </Card>

      {price && (
        <Card className="bg-primary/5">
          <CardContent className="text-center">
            <p className="text-sm text-primary">Estimated Price</p>
            <p className="text-2xl font-bold text-foreground">₹{price}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        Price will be calculated based on your lender&apos;s pricing configuration.
        The final price will be shown after submission.
      </p>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </div>
  );
}
