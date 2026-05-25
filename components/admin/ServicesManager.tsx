"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TranslationMap } from "@/lib/i18n";

interface ServiceRow {
  id: string;
  code: string;
  display_order: number;
  is_active: boolean;
  name_en: string;
  name_he: string;
  name_my: string;
}

interface ServicesManagerProps {
  services: ServiceRow[];
  translations: TranslationMap;
}

interface EditState {
  code: string;
  display_order: string;
  is_active: boolean;
  name_en: string;
  name_he: string;
  name_my: string;
}

const EMPTY_NEW: EditState = {
  code: "",
  display_order: "0",
  is_active: true,
  name_en: "",
  name_he: "",
  name_my: "",
};

export function ServicesManager({ services: initial, translations: t }: ServicesManagerProps) {
  const [services, setServices] = useState<ServiceRow[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<EditState>(EMPTY_NEW);
  const [addSaving, setAddSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function startEdit(s: ServiceRow) {
    setEditing(s.id);
    setEditValues((prev) => ({
      ...prev,
      [s.id]: {
        code: s.code,
        display_order: String(s.display_order),
        is_active: s.is_active,
        name_en: s.name_en,
        name_he: s.name_he,
        name_my: s.name_my,
      },
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
    const res = await fetch(`/api/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: v.code,
        display_order: parseInt(v.display_order, 10),
        is_active: v.is_active,
        name_en: v.name_en,
        name_he: v.name_he,
        name_my: v.name_my || undefined,
      }),
    });
    const json = await res.json();
    setSaving(null);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              code: v.code,
              display_order: parseInt(v.display_order, 10),
              is_active: v.is_active,
              name_en: v.name_en,
              name_he: v.name_he,
              name_my: v.name_my,
            }
          : s
      )
    );
    setEditing(null);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(null);
    setConfirmDelete(null);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    if (json.data?.soft_deleted) {
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, is_active: false } : s));
    } else {
      setServices((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function handleAdd() {
    setAddSaving(true);
    setError(null);
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newForm.code,
        display_order: parseInt(newForm.display_order, 10),
        is_active: newForm.is_active,
        name_en: newForm.name_en,
        name_he: newForm.name_he,
        name_my: newForm.name_my || undefined,
      }),
    });
    const json = await res.json();
    setAddSaving(false);
    if (!res.ok) { setError(json.error ?? t["common.error"]); return; }
    setServices((prev) => [
      ...prev,
      {
        id: json.data.id,
        code: newForm.code,
        display_order: parseInt(newForm.display_order, 10),
        is_active: newForm.is_active,
        name_en: newForm.name_en,
        name_he: newForm.name_he,
        name_my: newForm.name_my,
      },
    ].sort((a, b) => a.display_order - b.display_order));
    setNewForm(EMPTY_NEW);
    setShowAdd(false);
  }

  function updateNew(field: keyof EditState, val: string | boolean) {
    setNewForm((prev) => ({ ...prev, [field]: val }));
  }

  function updateEdit(id: string, field: keyof EditState, val: string | boolean) {
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
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.code"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["admin.service_name_he"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["admin.service_name_en"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["admin.service_order"]}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">{t["common.active"]}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {services.map((s) =>
              editing === s.id ? (
                <tr key={s.id} className="bg-brand-50">
                  <td className="px-3 py-2">
                    <input
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-28 font-mono"
                      value={editValues[s.id]?.code ?? s.code}
                      onChange={(e) => updateEdit(s.id, "code", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      dir="rtl"
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-36"
                      value={editValues[s.id]?.name_he ?? s.name_he}
                      onChange={(e) => updateEdit(s.id, "name_he", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-36"
                      value={editValues[s.id]?.name_en ?? s.name_en}
                      onChange={(e) => updateEdit(s.id, "name_en", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-16"
                      value={editValues[s.id]?.display_order ?? String(s.display_order)}
                      onChange={(e) => updateEdit(s.id, "display_order", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-brand-600"
                      checked={editValues[s.id]?.is_active ?? s.is_active}
                      onChange={(e) => updateEdit(s.id, "is_active", e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" loading={saving === s.id} onClick={() => saveEdit(s.id)}>
                        {t["common.save"]}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelEdit(s.id)}>
                        {t["common.cancel"]}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.code}</td>
                  <td className="px-4 py-3 font-medium" dir="rtl">{s.name_he || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{s.name_en || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{s.display_order}</td>
                  <td className="px-4 py-3">
                    {s.is_active ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>
                        {t["common.edit"]}
                      </Button>
                      {confirmDelete === s.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleting === s.id}
                            onClick={() => handleDelete(s.id)}
                          >
                            {t["common.confirm"]}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            {t["common.cancel"]}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(s.id)}>
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

      {/* Add new service */}
      {showAdd ? (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">{t["admin.add_service"]}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t["admin.service_code_label"]}
              placeholder="e.g. express"
              value={newForm.code}
              onChange={(e) => updateNew("code", e.target.value)}
              className="font-mono"
            />
            <Input
              label={t["admin.service_order"]}
              type="number"
              min={0}
              value={newForm.display_order}
              onChange={(e) => updateNew("display_order", e.target.value)}
            />
            <Input
              label={t["admin.service_name_he"]}
              dir="rtl"
              value={newForm.name_he}
              onChange={(e) => updateNew("name_he", e.target.value)}
            />
            <Input
              label={t["admin.service_name_en"]}
              value={newForm.name_en}
              onChange={(e) => updateNew("name_en", e.target.value)}
            />
            <Input
              label={t["admin.service_name_my"]}
              value={newForm.name_my}
              onChange={(e) => updateNew("name_my", e.target.value)}
            />
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="new-active"
                className="w-4 h-4 rounded accent-brand-600"
                checked={newForm.is_active}
                onChange={(e) => updateNew("is_active", e.target.checked)}
              />
              <label htmlFor="new-active" className="text-sm text-gray-700">{t["common.active"]}</label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              loading={addSaving}
              disabled={!newForm.code || !newForm.name_he || !newForm.name_en}
              onClick={handleAdd}
            >
              {t["admin.add_service"]}
            </Button>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setNewForm(EMPTY_NEW); }}>
              {t["common.cancel"]}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShowAdd(true)}>
          + {t["admin.add_service"]}
        </Button>
      )}
    </div>
  );
}
