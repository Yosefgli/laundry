import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";

export type PhoneCountryCodeOption = {
  code: string;
  label: string;
};

export type PhoneCountryOption = {
  countryCode: CountryCode;
  dialCode: string;
  name: string;
};

export const DEFAULT_PHONE_COUNTRY: CountryCode = "IL";

// Deduplicated dial codes for schema validation (e.g. "+972", "+1", …)
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

/** One entry per country (countries sharing a dial code get separate rows). */
export function getPhoneCountryOptions(locale: string): PhoneCountryOption[] {
  return getCountries()
    .map((country) => ({
      countryCode: country,
      dialCode: `+${getCountryCallingCode(country)}`,
      name: getRegionName(country, locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Legacy grouped options (kept for any remaining callers). */
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
