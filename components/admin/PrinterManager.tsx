"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Printer {
  id: string;
  name: string;
  ip_address: string;
  is_active: boolean;
  employee_ids: string[];
}

interface Employee {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface PrinterManagerProps {
  printers: Printer[];
  employees: Employee[];
}

export function PrinterManager({ printers: initial, employees }: PrinterManagerProps) {
  const [printers, setPrinters] = useState<Printer[]>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Printer>>(
    Object.fromEntries(initial.map((p) => [p.id, p]))
  );

  function updateDraft(id: string, field: keyof Printer, value: unknown) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function toggleEmployee(printerId: string, employeeId: string) {
    setDrafts((prev) => {
      const current = prev[printerId]?.employee_ids ?? [];
      const next = current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId];
      return { ...prev, [printerId]: { ...prev[printerId], employee_ids: next } };
    });
  }

  async function save(id: string) {
    setSaving(id);
    const draft = drafts[id];
    const res = await fetch(`/api/admin/printers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        ip_address: draft.ip_address,
        is_active: draft.is_active,
        employee_ids: draft.employee_ids,
      }),
    });
    const json = await res.json();
    if (json.data) {
      setPrinters((prev) => prev.map((p) => (p.id === id ? { ...json.data, employee_ids: draft.employee_ids } : p)));
    }
    setSaving(null);
  }

  async function deletePrinter(id: string) {
    if (!confirm("למחוק מדפסת זו?")) return;
    await fetch(`/api/admin/printers/${id}`, { method: "DELETE" });
    setPrinters((prev) => prev.filter((p) => p.id !== id));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function addPrinter() {
    const res = await fetch("/api/admin/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "מדפסת חדשה", ip_address: "", employee_ids: [] }),
    });
    const json = await res.json();
    if (json.data) {
      const newPrinter: Printer = { ...json.data, employee_ids: [] };
      setPrinters((prev) => [...prev, newPrinter]);
      setDrafts((prev) => ({ ...prev, [newPrinter.id]: newPrinter }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">לכל מדפסת בחר כתובת IP ואיזה עובדים ישלחו אליה הדפסות.</p>
        <Button onClick={addPrinter} variant="secondary">+ הוסף מדפסת</Button>
      </div>

      {printers.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed p-8 text-center text-gray-400">
          אין מדפסות. הוסף מדפסת כדי להתחיל.
        </div>
      )}

      {printers.map((printer) => {
        const draft = drafts[printer.id] ?? printer;
        return (
          <div key={printer.id} className="bg-white rounded-xl border p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="שם המדפסת"
                value={draft.name}
                onChange={(e) => updateDraft(printer.id, "name", e.target.value)}
              />
              <Input
                label="כתובת IP"
                placeholder="192.168.1.100"
                value={draft.ip_address}
                onChange={(e) => updateDraft(printer.id, "ip_address", e.target.value)}
                dir="ltr"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">עובדים שמשתמשים במדפסת זו</p>
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => {
                  const assigned = draft.employee_ids.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(printer.id, emp.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        assigned
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
                      }`}
                    >
                      {emp.full_name}
                    </button>
                  );
                })}
              </div>
              {employees.length === 0 && (
                <p className="text-xs text-gray-400">אין עובדים פעילים</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => updateDraft(printer.id, "is_active", e.target.checked)}
                  className="rounded"
                />
                פעילה
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePrinter(printer.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  מחק
                </Button>
                <Button size="sm" loading={saving === printer.id} onClick={() => save(printer.id)}>
                  שמור
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
