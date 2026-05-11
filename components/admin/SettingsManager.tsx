"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";
import type { TranslationMap } from "@/lib/i18n";

type Setting = Database["public"]["Tables"]["system_settings"]["Row"];

export function SettingsManager({
  settings,
  translations: t,
}: {
  settings: Setting[];
  translations: TranslationMap;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveSetting(key: string, settingId: string) {
    setSaving(key);
    await fetch(`/api/admin/settings/${settingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: values[key] }),
    });
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="space-y-3">
      {settings.map((setting) => (
        <div key={setting.id} className="bg-white rounded-xl border p-4 space-y-2">
          <div>
            <span className="font-mono text-xs text-gray-500">{setting.key}</span>
            {setting.description && (
              <p className="text-sm text-gray-600">
                {t[`setting.${setting.key}`] ?? setting.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={values[setting.key] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [setting.key]: e.target.value }))}
              className="flex-1"
            />
            <Button
              size="sm"
              loading={saving === setting.key}
              onClick={() => saveSetting(setting.key, setting.id)}
              variant={saved === setting.key ? "secondary" : "primary"}
            >
              {saved === setting.key ? `${t["common.saved"]} ✓` : t["common.save"]}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
