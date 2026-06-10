"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";

type WebhookRow = Pick<
  Database["public"]["Tables"]["pos_webhooks"]["Row"],
  | "id"
  | "pos_order_name"
  | "pos_order_id"
  | "extracted_order_number"
  | "amount_total"
  | "process_status"
  | "process_result"
  | "processed_at"
  | "created_at"
  | "matched_order_id"
  | "general_note"
>;

type ProcessStatus = Database["public"]["Enums"]["webhook_process_status"];

interface PaymentsManagerProps {
  webhooks: WebhookRow[];
  locale: Locale;
  translations: Record<string, string>;
}

const STATUS_STYLE: Record<ProcessStatus, string> = {
  matched_paid:   "bg-green-100 text-green-800 border-green-200",
  pending:        "bg-gray-100 text-gray-600 border-gray-200",
  already_paid:   "bg-blue-100 text-blue-800 border-blue-200",
  no_order_found: "bg-red-100 text-red-700 border-red-200",
  amount_mismatch:"bg-amber-100 text-amber-800 border-amber-200",
  error:          "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<ProcessStatus, string> = {
  matched_paid:   "שולם ✓",
  pending:        "ממתין",
  already_paid:   "כבר שולם",
  no_order_found: "הזמנה לא נמצאה",
  amount_mismatch:"אי-התאמה בסכום",
  error:          "שגיאה",
};

function formatDatetime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function PaymentsManager({ webhooks: initial, locale }: PaymentsManagerProps) {
  const [rows, setRows] = useState<WebhookRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrderNum, setEditOrderNum] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProcessStatus | "all">("all");
  const [saveError, setSaveError] = useState<string | null>(null);

  function openEdit(row: WebhookRow) {
    setEditingId(row.id);
    setEditOrderNum(row.extracted_order_number ?? "");
    setEditAmount(row.amount_total != null ? String(row.amount_total) : "");
    setSaveError(null);
  }

  function closeEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      const trimmedNum = editOrderNum.trim();
      if (trimmedNum !== "") body.extracted_order_number = trimmedNum;
      else body.extracted_order_number = null;

      const parsedAmount = parseFloat(editAmount);
      if (!isNaN(parsedAmount) && parsedAmount > 0) body.amount_total = parsedAmount;

      const res = await fetch(`/api/admin/webhooks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.data) {
        setSaveError(typeof json.error === "string" ? json.error : "שגיאה בשמירה");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...json.data } : r)));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function reprocess(id: string) {
    setReprocessingId(id);
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: "POST" });
      const json = await res.json();
      if (json.data) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...json.data } : r)));
      }
    } finally {
      setReprocessingId(null);
    }
  }

  const filtered = statusFilter === "all"
    ? rows
    : rows.filter((r) => r.process_status === statusFilter);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.process_status] = (acc[r.process_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5" dir="rtl">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
            statusFilter === "all"
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          הכל ({rows.length})
        </button>
        {(Object.keys(STATUS_LABEL) as ProcessStatus[]).filter((s) => counts[s]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
              statusFilter === s
                ? `${STATUS_STYLE[s]} shadow-sm`
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">תאריך ושעה</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">הזמנת POS</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">מספר הזמנה</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">סכום</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">סטטוס</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">פרטים</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    אין רשומות להצגה
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {/* Date/time */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                    {formatDatetime(row.created_at)}
                  </td>

                  {/* POS order */}
                  <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                    {row.pos_order_name ?? row.pos_order_id ?? "—"}
                  </td>

                  {/* Extracted order number */}
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <Input
                        value={editOrderNum}
                        onChange={(e) => setEditOrderNum(e.target.value)}
                        placeholder="L-000000"
                        className="w-32 text-sm h-8"
                      />
                    ) : (
                      <span className={`font-mono font-bold ${row.extracted_order_number ? "text-gray-900" : "text-red-400"}`}>
                        {row.extracted_order_number ?? "חסר"}
                      </span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                    {editingId === row.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-24 text-sm h-8"
                      />
                    ) : (
                      row.amount_total != null
                        ? formatCurrency(Number(row.amount_total), locale)
                        : "—"
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl border text-xs font-semibold ${STATUS_STYLE[row.process_status]}`}>
                      {STATUS_LABEL[row.process_status]}
                    </span>
                  </td>

                  {/* Result message */}
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                    <span className="line-clamp-2" title={row.process_result ?? ""}>
                      {row.process_result ?? "—"}
                    </span>
                    {row.processed_at && (
                      <div className="text-gray-400 mt-0.5 font-mono">{formatDatetime(row.processed_at)}</div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editingId === row.id ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" loading={saving} onClick={saveEdit}>שמור</Button>
                        <Button size="sm" variant="secondary" onClick={closeEdit} disabled={saving}>ביטול</Button>
                        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(row)}
                          disabled={reprocessingId === row.id}
                        >
                          עריכה
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={reprocessingId === row.id}
                          onClick={() => reprocess(row.id)}
                          disabled={editingId !== null}
                          title="הפעל שוב את עיבוד ה-Webhook"
                        >
                          הפעל שוב
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">מציג {filtered.length} מתוך {rows.length} רשומות · לחץ &quot;עריכה&quot; לתיקון מספר הזמנה או סכום, לאחר מכן &quot;הפעל שוב&quot; להרצה מחדש</p>
    </div>
  );
}
