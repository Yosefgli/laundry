"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { formatCurrency, formatWeight, type Locale } from "@/lib/i18n";

type OrderItem = {
  id: string;
  color_type: string | null;
  weight_kg: number;
  order_item_services: Array<{
    service_type: { code: string } | null;
  }>;
};

type ReportOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  customer_name: string | null;
  total_weight_kg: number;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
};

interface ReportsViewProps {
  orders: ReportOrder[];
  serviceCodes: string[];
  translations: Record<string, string>;
  locale: Locale;
  currentFilters: {
    dateFrom?: string;
    dateTo?: string;
    service?: string;
    color?: string;
  };
}

const COLORS = ["white", "colorful", "dark"] as const;

export function ReportsView({
  orders,
  serviceCodes,
  translations: t,
  locale,
  currentFilters,
}: ReportsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalWeight = orders.reduce((s, o) => s + Number(o.total_weight_kg), 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  function getOrderServices(order: ReportOrder): string {
    const codes = new Set<string>();
    for (const item of order.order_items) {
      for (const svc of item.order_item_services) {
        if (svc.service_type?.code) codes.add(t[`service.${svc.service_type.code}`] ?? svc.service_type.code);
      }
    }
    return Array.from(codes).join(", ") || "—";
  }

  function getOrderColors(order: ReportOrder): string {
    const colors = new Set<string>();
    for (const item of order.order_items) {
      if (item.color_type) colors.add(t[`color.${item.color_type}`] ?? item.color_type);
    }
    return Array.from(colors).join(", ") || "—";
  }

  function exportCSV() {
    const headers = [
      t["admin.order_number"] ?? "#",
      t["common.created"] ?? "Date",
      t["common.customer"] ?? "Customer",
      t["common.status"] ?? "Status",
      t["admin.report_filter_service"] ?? "Service",
      t["admin.report_filter_color"] ?? "Color",
      `${t["employee.weight_kg"] ?? "Weight"} (kg)`,
      t["common.total"] ?? "Total",
      t["common.payment"] ?? "Payment",
    ];

    const rows = orders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString(),
      o.customer_name ?? "",
      t[`status.${o.status}`] ?? o.status,
      getOrderServices(o),
      getOrderColors(o),
      Number(o.total_weight_kg).toFixed(3),
      Number(o.total_amount).toFixed(2),
      t[`payment.${o.payment_status}`] ?? o.payment_status,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Laundry By Chabad", 14, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`${t["common.created"] ?? "Generated"}: ${new Date().toLocaleString()}`, 14, 21);
    doc.text(
      `${t["admin.report_total_orders"] ?? "Orders"}: ${orders.length}   ${t["admin.report_total_revenue"] ?? "Revenue"}: ${formatCurrency(totalRevenue, locale)}`,
      14,
      27,
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 33,
      head: [[
        t["admin.order_number"] ?? "#",
        t["common.created"] ?? "Date",
        t["common.customer"] ?? "Customer",
        t["common.status"] ?? "Status",
        t["admin.report_filter_service"] ?? "Service",
        t["admin.report_filter_color"] ?? "Color",
        `${t["employee.weight_kg"] ?? "Weight"} (kg)`,
        t["common.total"] ?? "Total",
        t["common.payment"] ?? "Payment",
      ]],
      body: orders.map((o) => [
        `#${o.order_number}`,
        new Date(o.created_at).toLocaleString(),
        o.customer_name ?? "",
        t[`status.${o.status}`] ?? o.status,
        getOrderServices(o),
        getOrderColors(o),
        Number(o.total_weight_kg).toFixed(3),
        Number(o.total_amount).toFixed(2),
        t[`payment.${o.payment_status}`] ?? o.payment_status,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [23, 174, 173], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 254, 254] },
    });

    doc.save(`report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t["admin.report_date_from"] ?? "From"}
            </label>
            <input
              type="date"
              defaultValue={currentFilters.dateFrom ?? ""}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t["admin.report_date_to"] ?? "To"}
            </label>
            <input
              type="date"
              defaultValue={currentFilters.dateTo ?? ""}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t["admin.report_filter_service"] ?? "Service"}
            </label>
            <select
              defaultValue={currentFilters.service ?? "all"}
              onChange={(e) => updateFilter("service", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">{t["admin.report_all"] ?? "All"}</option>
              {serviceCodes.map((code) => (
                <option key={code} value={code}>
                  {t[`service.${code}`] ?? code}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t["admin.report_filter_color"] ?? "Color"}
            </label>
            <select
              defaultValue={currentFilters.color ?? "all"}
              onChange={(e) => updateFilter("color", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">{t["admin.report_all"] ?? "All"}</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {t[`color.${c}`] ?? c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-500">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t["admin.report_export_csv"] ?? "Export CSV"}
          </button>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M7 21H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11a2 2 0 01-2 2h-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 12v7m0 0l-3-3m3 3l3-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t["admin.report_export_pdf"] ?? "Export PDF"}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t["admin.report_total_orders"] ?? "Total Orders"} value={orders.length} />
        <StatCard label={t["admin.report_total_revenue"] ?? "Total Revenue"} value={formatCurrency(totalRevenue, locale)} />
        <StatCard label={t["admin.report_avg_order"] ?? "Average Order"} value={formatCurrency(avgOrder, locale)} />
        <StatCard label={t["admin.report_total_weight"] ?? "Total Weight"} value={formatWeight(totalWeight, locale, t["unit.kg"] ?? "kg")} />
      </div>

      {/* Table */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          {t["admin.report_no_results"] ?? "No orders match the selected filters"}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    t["admin.order_number"] ?? "#",
                    t["common.created"] ?? "Date",
                    t["common.customer"] ?? "Customer",
                    t["common.status"] ?? "Status",
                    t["admin.report_filter_service"] ?? "Service",
                    t["admin.report_filter_color"] ?? "Color",
                    t["employee.weight_kg"] ?? "Weight",
                    t["common.total"] ?? "Total",
                    t["common.payment"] ?? "Payment",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString()}{" "}
                      <span className="text-gray-400">{new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{order.customer_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {t[`status.${order.status}`] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{getOrderServices(order)}</td>
                    <td className="px-4 py-3 text-gray-600">{getOrderColors(order)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatWeight(Number(order.total_weight_kg), locale, t["unit.kg"] ?? "kg")}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrency(Number(order.total_amount), locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        order.payment_status === "paid"
                          ? "bg-green-100 text-green-700"
                          : order.payment_status === "refunded"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {t[`payment.${order.payment_status}`] ?? order.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}
