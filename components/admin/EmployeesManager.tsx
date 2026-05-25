"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TranslationMap } from "@/lib/i18n";
import { localeToIntl, type Locale } from "@/lib/i18n";

interface EmployeeRow {
  id: string;
  user_id: string;
  full_name: string;
  role: "admin" | "employee";
  is_active: boolean;
  email: string | null;
  created_at: string;
}

interface EmployeesManagerProps {
  employees: EmployeeRow[];
  translations: TranslationMap;
  locale: Locale;
}

interface NewEmployeeForm {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "employee";
}

const EMPTY_NEW: NewEmployeeForm = { email: "", password: "", full_name: "", role: "employee" };

interface EditState {
  full_name: string;
  role: "admin" | "employee";
  new_password: string;
}

export function EmployeesManager({ employees: initial, translations: t, locale }: EmployeesManagerProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<NewEmployeeForm>(EMPTY_NEW);
  const [addSaving, setAddSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intlLocale = localeToIntl(locale);

  function startEdit(e: EmployeeRow) {
    setEditing(e.id);
    setEditValues((prev) => ({
      ...prev,
      [e.id]: { full_name: e.full_name, role: e.role, new_password: "" },
    }));
  }

  function cancelEdit(id: string) {
    setEditing(null);
    setEditValues((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveEdit(id: string) {
    const v = editValues[id];
    if (!v) return;
    setSaving(id);
    setError(null);
    const body: Record<string, unknown> = { full_name: v.full_name, role: v.role };
    if (v.new_password) body.new_password = v.new_password;
    const res = await fetch(`/api/admin/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(null);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setEmployees((prev) =>
      prev.map((e) => e.id === id ? { ...e, full_name: v.full_name, role: v.role } : e)
    );
    setEditing(null);
  }

  async function toggleActive(emp: EmployeeRow) {
    setToggling(emp.id);
    setError(null);
    const res = await fetch(`/api/admin/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !emp.is_active }),
    });
    const json = await res.json();
    setToggling(null);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setEmployees((prev) =>
      prev.map((e) => e.id === emp.id ? { ...e, is_active: !emp.is_active } : e)
    );
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(null);
    setConfirmDelete(null);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleAdd() {
    setAddSaving(true);
    setError(null);
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    const json = await res.json();
    setAddSaving(false);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setEmployees((prev) =>
      [...prev, json.data].sort((a, b) => a.full_name.localeCompare(b.full_name))
    );
    setNewForm(EMPTY_NEW);
    setShowAdd(false);
  }

  function updateNew<K extends keyof NewEmployeeForm>(field: K, val: NewEmployeeForm[K]) {
    setNewForm((prev) => ({ ...prev, [field]: val }));
  }

  function updateEdit(id: string, field: keyof EditState, val: string) {
    setEditValues((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.name"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["admin.employee_email"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.role"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.active"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.joined"]}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map((emp) =>
              editing === emp.id ? (
                <tr key={emp.id} className="bg-brand-50">
                  <td className="px-3 py-2">
                    <input
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40"
                      value={editValues[emp.id]?.full_name ?? emp.full_name}
                      onChange={(e) => updateEdit(emp.id, "full_name", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{emp.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                      value={editValues[emp.id]?.role ?? emp.role}
                      onChange={(e) => updateEdit(emp.id, "role", e.target.value)}
                    >
                      <option value="employee">{t["nav.employee"]}</option>
                      <option value="admin">{t["nav.admin"]}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {emp.is_active ? "✓" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="password"
                      placeholder={t["admin.new_password_placeholder"]}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40"
                      value={editValues[emp.id]?.new_password ?? ""}
                      onChange={(e) => updateEdit(emp.id, "new_password", e.target.value)}
                      autoComplete="new-password"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" loading={saving === emp.id} onClick={() => saveEdit(emp.id)}>
                        {t["common.save"]}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelEdit(emp.id)}>
                        {t["common.cancel"]}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={emp.id} className={emp.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{emp.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {emp.role === "admin" ? t["nav.admin"] : t["nav.employee"]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={toggling === emp.id}
                      onClick={() => toggleActive(emp)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        emp.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={emp.is_active ? t["admin.deactivate"] : t["admin.activate"]}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          emp.is_active ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(emp.created_at).toLocaleDateString(intlLocale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(emp)}>
                        {t["common.edit"]}
                      </Button>
                      {confirmDelete === emp.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleting === emp.id}
                            onClick={() => handleDelete(emp.id)}
                          >
                            {t["common.confirm"]}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            {t["common.cancel"]}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(emp.id)}>
                          {t["common.delete"]}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Add new employee */}
      {showAdd ? (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">{t["admin.add_employee"]}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t["admin.employee_email"]}
              type="email"
              value={newForm.email}
              onChange={(e) => updateNew("email", e.target.value)}
              autoComplete="off"
            />
            <Input
              label={t["admin.employee_password"]}
              type="password"
              value={newForm.password}
              onChange={(e) => updateNew("password", e.target.value)}
              autoComplete="new-password"
              placeholder="min 8 characters"
            />
            <Input
              label={t["common.name"]}
              value={newForm.full_name}
              onChange={(e) => updateNew("full_name", e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t["common.role"]}</label>
              <select
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                value={newForm.role}
                onChange={(e) => updateNew("role", e.target.value as "admin" | "employee")}
              >
                <option value="employee">{t["nav.employee"]}</option>
                <option value="admin">{t["nav.admin"]}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              loading={addSaving}
              disabled={!newForm.email || !newForm.password || !newForm.full_name}
              onClick={handleAdd}
            >
              {t["admin.add_employee"]}
            </Button>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setNewForm(EMPTY_NEW); }}>
              {t["common.cancel"]}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShowAdd(true)}>
          + {t["admin.add_employee"]}
        </Button>
      )}
    </div>
  );
}
