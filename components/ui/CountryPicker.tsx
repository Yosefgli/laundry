"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { getPhoneCountryOptions, type PhoneCountryOption } from "@/lib/phoneCountryCodes";

interface CountryPickerProps {
  value: string;
  onChange: (countryCode: string) => void;
  locale: string;
  translations: Record<string, string>;
  error?: string;
}

export function CountryPicker({ value, onChange, locale, translations: t, error }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const options = useMemo<PhoneCountryOption[]>(() => getPhoneCountryOptions(locale), [locale]);

  const selected = options.find((o) => o.countryCode === value) ?? null;

  const filtered = query.trim()
    ? options.filter((o) =>
        o.name.toLowerCase().includes(query.toLowerCase()) ||
        o.dialCode.includes(query)
      )
    : options;

  function openPicker() {
    setQuery("");
    setOpen(true);
  }

  function pick(option: PhoneCountryOption) {
    onChange(option.countryCode);
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-brand-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className="truncate">
          {selected ? `${selected.dialCode} ${selected.name}` : (t["customer.select_phone_country_code"] ?? "Select prefix")}
        </span>
        <svg className="ms-2 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-gray-700">{t["customer.select_country"] ?? "Select Country"}</p>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t["customer.search_country"] ?? "Search country..."}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-400">{t["common.not_available"] ?? "No results"}</li>
              )}
              {filtered.map((option) => (
                <li key={option.countryCode}>
                  <button
                    type="button"
                    onClick={() => pick(option)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-brand-50 ${
                      option.countryCode === value ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700"
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-gray-500">{option.dialCode}</span>
                    <span className="truncate">{option.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
