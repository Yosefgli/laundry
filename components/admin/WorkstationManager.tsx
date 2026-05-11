"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";
import type { TranslationMap } from "@/lib/i18n";

type Workstation = Database["public"]["Tables"]["workstations"]["Row"];

export function WorkstationManager({
  workstations: initial,
  translations: t,
}: {
  workstations: Workstation[];
  translations: TranslationMap;
}) {
  const [workstations, setWorkstations] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Partial<Workstation>>>(
    Object.fromEntries(initial.map((w) => [w.id, w]))
  );

  function update(id: string, field: keyof Workstation, val: string | number) {
    setValues((p) => ({ ...p, [id]: { ...p[id], [field]: val } }));
  }

  async function save(id: string) {
    setSaving(id);
    const v = values[id];
    const res = await fetch(`/api/admin/workstations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const json = await res.json();
    if (json.data) {
      setWorkstations((prev) => prev.map((w) => (w.id === id ? json.data : w)));
    }
    setSaving(null);
  }

  async function addWorkstation() {
    const res = await fetch("/api/admin/workstations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Station", printer_port: 9100 }),
    });
    const json = await res.json();
    if (json.data) {
      setWorkstations((p) => [...p, json.data]);
      setValues((p) => ({ ...p, [json.data.id]: json.data }));
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={addWorkstation} variant="secondary">+ {t["admin.add_workstation"]}</Button>
      {workstations.map((ws) => {
        const v = values[ws.id] ?? ws;
        return (
          <div key={ws.id} className="bg-white rounded-xl border p-5 space-y-3">
            <Input
              label={t["common.name"]}
              value={(v.name as string) ?? ""}
              onChange={(e) => update(ws.id, "name", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t["admin.printer_ip"]}
                placeholder="192.168.1.100"
                value={(v.printer_ip as string) ?? ""}
                onChange={(e) => update(ws.id, "printer_ip", e.target.value)}
              />
              <Input
                label={t["admin.printer_port"]}
                type="number"
                value={(v.printer_port as number) ?? 9100}
                onChange={(e) => update(ws.id, "printer_port", parseInt(e.target.value))}
              />
            </div>
            <Input
              label={t["admin.printer_http_url"]}
              placeholder="http://192.168.1.100/print"
              value={(v.printer_http_url as string) ?? ""}
              onChange={(e) => update(ws.id, "printer_http_url", e.target.value)}
            />
            <Button size="sm" loading={saving === ws.id} onClick={() => save(ws.id)}>
              {t["common.save"]}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
