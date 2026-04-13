"use client";

import { useState } from "react";
import type { ReportRequestCreate } from "@/types/request";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  data: Partial<ReportRequestCreate>;
  onNext: (data: Partial<ReportRequestCreate>) => void;
};

export function PropertyForm({ data, onNext }: Props) {
  const [form, setForm] = useState({
    property_address: data.property_address || "",
    city: data.city || "",
    area: data.area || "",
    pin_code: data.pin_code || "",
    property_type: data.property_type || "RESIDENTIAL",
    plot_extent_sqft: data.plot_extent_sqft?.toString() || "",
    built_up_sqft: data.built_up_sqft?.toString() || "",
    loan_applicant_name: data.loan_applicant_name || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      property_address: form.property_address,
      city: form.city,
      area: form.area || undefined,
      pin_code: form.pin_code || undefined,
      property_type: form.property_type,
      plot_extent_sqft: form.plot_extent_sqft ? Number(form.plot_extent_sqft) : undefined,
      built_up_sqft: form.built_up_sqft ? Number(form.built_up_sqft) : undefined,
      loan_applicant_name: form.loan_applicant_name,
    });
  };

  const selectClass = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Property Details</h2>

      <div className="space-y-1.5">
        <Label>Property Address *</Label>
        <Input required value={form.property_address}
          onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>City *</Label>
          <Input required value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Area</Label>
          <Input value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>PIN Code</Label>
          <Input value={form.pin_code}
            onChange={(e) => setForm({ ...form, pin_code: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Property Type *</Label>
          <select className={selectClass} required value={form.property_type}
            onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Plot Extent (sq ft)</Label>
          <Input type="number" value={form.plot_extent_sqft}
            onChange={(e) => setForm({ ...form, plot_extent_sqft: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Built-up Area (sq ft)</Label>
          <Input type="number" value={form.built_up_sqft}
            onChange={(e) => setForm({ ...form, built_up_sqft: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Loan Applicant Name *</Label>
        <Input required value={form.loan_applicant_name}
          onChange={(e) => setForm({ ...form, loan_applicant_name: e.target.value })} />
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit">
          Next
        </Button>
      </div>
    </form>
  );
}
