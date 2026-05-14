"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  /** When set, clicking a row navigates (desktop + mobile), Gmail-style */
  getRowHref?: (row: TData) => string | undefined;
};

function headerLabel<TData, TValue>(
  column: { columnDef: ColumnDef<TData, TValue>; id: string },
): string {
  const h = column.columnDef.header;
  if (typeof h === "string") return h;
  return column.id.replace(/_/g, " ");
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  getRowHref,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  const rowOpenLabel = (original: TData) => {
    const addr = (original as { property_address?: string | null })
      .property_address;
    return addr ? `Open report details: ${addr}` : "Open report details";
  };

  const rowNavBlocked = (target: EventTarget | null) =>
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    Boolean(target.closest("[data-stop-row-nav]"));

  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">{emptyMessage}</p>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-4 py-3 font-medium text-gray-700"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const href = getRowHref?.(row.original);
              const go = () => {
                if (href) router.push(href);
              };
              const onRowActivate = href
                ? (e: MouseEvent | KeyboardEvent) => {
                    if (rowNavBlocked(e.target)) return;
                    go();
                  }
                : undefined;
              return (
                <tr
                  key={row.id}
                  onClick={onRowActivate}
                  onKeyDown={
                    href
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowActivate?.(e);
                          }
                        }
                      : undefined
                  }
                  tabIndex={href ? 0 : undefined}
                  role={href ? "link" : undefined}
                  aria-label={href ? rowOpenLabel(row.original) : undefined}
                  className={cn(
                    href &&
                      "cursor-pointer hover:bg-gray-50/80 focus-visible:bg-gray-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500",
                    !href && "hover:bg-gray-50/80",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const href = getRowHref?.(row.original);
          const go = () => {
            if (href) router.push(href);
          };
          const onRowActivate = href
            ? (e: MouseEvent | KeyboardEvent) => {
                if (rowNavBlocked(e.target)) return;
                go();
              }
            : undefined;
          return (
            <div
              key={row.id}
              onClick={onRowActivate}
              onKeyDown={
                href
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowActivate?.(e);
                      }
                    }
                  : undefined
              }
              tabIndex={href ? 0 : undefined}
              role={href ? "link" : undefined}
              aria-label={href ? rowOpenLabel(row.original) : undefined}
              className={cn(
                "border border-gray-200 rounded-lg p-4 bg-white",
                href &&
                  "cursor-pointer hover:bg-gray-50 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  className="flex flex-col gap-0.5 py-2 border-b border-gray-100 last:border-0 last:pb-0 first:pt-0"
                >
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {headerLabel(cell.column)}
                  </span>
                  <div className="text-sm text-gray-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
