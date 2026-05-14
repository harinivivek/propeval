/**
 * Value for `report_date` on vendor upload: local calendar date at submit time
 * (not user-editable; set when the vendor confirms upload).
 */
export function vendorReportUploadDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
