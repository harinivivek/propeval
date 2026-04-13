"use client";

interface DateRangeFilterProps {
  selectedYear: number;
  onChange: (year: number) => void;
}

function getFYOptions(): { label: string; value: number }[] {
  const now = new Date();
  const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let y = currentFY; y >= currentFY - 2; y--) {
    options.push({
      label: `FY ${y}-${(y + 1).toString().slice(2)}`,
      value: y,
    });
  }
  return options;
}

export function DateRangeFilter({ selectedYear, onChange }: DateRangeFilterProps) {
  const options = getFYOptions();

  return (
    <select
      value={selectedYear}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border border-input rounded-md px-3 py-2 text-sm bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
