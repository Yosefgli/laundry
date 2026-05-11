import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";

export type PhoneCountryCodeOption = {
  code: string;
  label: string;
};

export const PHONE_COUNTRY_CODES = Array.from(
  new Set(getCountries().map((country) => `+${getCountryCallingCode(country)}`))
).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

export function isSupportedPhoneCountryCode(code: string): boolean {
  return PHONE_COUNTRY_CODES.includes(code);
}

function getRegionName(country: CountryCode, locale: string): string {
  try {
    return new Intl.DisplayNames([locale, "en"], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

export function getPhoneCountryCodeOptions(locale: string): PhoneCountryCodeOption[] {
  const countriesByCode = new Map<string, string[]>();

  for (const country of getCountries()) {
    const code = `+${getCountryCallingCode(country)}`;
    const countries = countriesByCode.get(code) ?? [];
    countries.push(getRegionName(country, locale));
    countriesByCode.set(code, countries);
  }

  return [...countriesByCode.entries()]
    .map(([code, countries]) => ({
      code,
      label: `${code} ${countries.sort((a, b) => a.localeCompare(b, locale)).join(", ")}`,
    }))
    .sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
}
