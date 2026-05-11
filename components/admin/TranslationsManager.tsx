"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";

type Translation = Database["public"]["Tables"]["translations"]["Row"];

export function TranslationsManager({ translations }: { translations: Translation[] }) {
  const locales = ["en", "he", "my"];
  const keys = [...new Set(translations.map((t) => t.key))];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(translations.map((t) => [`${t.key}::${t.locale}`, t.value]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredKeys = keys.filter((k) =>
    !filter || k.toLowerCase().includes(filter.toLowerCase())
  );

  async function save(key: string, locale: string, translationId?: string) {
    const saveKey = `${key}::${locale}`;
    setSaving(saveKey);
    const value = values[saveKey] ?? "";
    await fetch("/api/admin/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, locale, value, id: translationId }),
    });
    setSaving(null);
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by key…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-600 w-48">Key</th>
              {locales.map((loc) => (
                <th key={loc} className="text-left px-4 py-2 font-semibold text-gray-600">
                  {loc.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredKeys.map((key) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-500 align-top pt-3">{key}</td>
                {locales.map((locale) => {
                  const row = translations.find((t) => t.key === key && t.locale === locale);
                  const saveKey = `${key}::${locale}`;
                  return (
                    <td key={locale} className="px-2 py-1">
                      <div className="flex gap-1">
                        <Input
                          value={values[saveKey] ?? ""}
                          onChange={(e) => setValues((p) => ({ ...p, [saveKey]: e.target.value }))}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={saving === saveKey}
                          onClick={() => save(key, locale, row?.id)}
                        >
                          ✓
                        </Button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
