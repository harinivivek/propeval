"use client";

import { useState } from "react";
import type { ReportRequestCreate } from "@/types/request";

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

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Property Details</h2>

      <div>
        <label className={labelClass}>Property Address *</label>
        <input className={inputClass} required value={form.property_address}
          onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>City *</label>
          <input className={inputClass} required value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Area</label>
          <input className={inputClass} value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>PIN Code</label>
          <input className={inputClass} value={form.pin_code}
            onChange={(e) => setForm({ ...form, pin_code: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Property Type *</label>
          <select className={inputClass} required value={form.property_type}
            onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Plot Extent (sq ft)</label>
          <input type="number" className={inputClass} value={form.plot_extent_sqft}
            onChange={(e) => setForm({ ...form, plot_extent_sqft: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Built-up Area (sq ft)</label>
          <input type="number" className={inputClass} value={form.built_up_sqft}
            onChange={(e) => setForm({ ...form, built_up_sqft: e.target.value })} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Loan Applicant Name *</label>
        <input className={inputClass} required value={form.loan_applicant_name}
          onChange={(e) => setForm({ ...form, loan_applicant_name: e.target.value })} />
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
          Next
        </button>
      </div>
    </form>
  );
}
