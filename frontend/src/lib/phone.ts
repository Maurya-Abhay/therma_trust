import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import mobileExamples from "libphonenumber-js/examples.mobile.json";

/**
 * Region-aware phone numbers. People pick a country, type the national number, and the
 * app keeps it as an international number ("+919876543210"), which is what the server stores.
 */
export interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string;
}

const FALLBACK_COUNTRY: CountryCode = "IN";

let cachedCountries: CountryOption[] | null = null;

export function countryOptions(): CountryOption[] {
  if (cachedCountries) return cachedCountries;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  cachedCountries = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedCountries;
}

export const findCountry = (code: CountryCode) => countryOptions().find((c) => c.code === code) ?? countryOptions()[0];

/** The visitor's own country from their browser language ("en-IN" gives India), else India. */
export function guessCountry(): CountryCode {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && getCountries().includes(region as CountryCode)) return region as CountryCode;
  } catch {
    // an unusual locale string; fall through to the default
  }
  return FALLBACK_COUNTRY;
}

const capCache = new Map<CountryCode, number>();

/**
 * The most digits a number in this country can have. Starts from a real example number and
 * keeps extending it while a longer valid number exists, so India stops at 10 (typing an 11th
 * digit does nothing) while countries with longer valid numbers are never cut short.
 */
export function maxDigits(country: CountryCode): number {
  const cached = capCache.get(country);
  if (cached) return cached;

  const example = getExampleNumber(country, mobileExamples);
  let national = example?.nationalNumber ?? "";
  const dial = getCountryCallingCode(country);
  for (let guard = 0; guard < 8 && national; guard += 1) {
    const next = "0123456789".split("").find((digit) => isValidPhoneNumber(`+${dial}${national}${digit}`));
    if (next === undefined) break;
    national += next;
  }
  const cap = national.length || 15;
  capCache.set(country, cap);
  return cap;
}

/** A sample number, nicely spaced, for the helper text: "98765 43210". */
export function exampleNumber(country: CountryCode): { text: string; digits: number } {
  const example = getExampleNumber(country, mobileExamples);
  // Spaced like the number is written without the country code or the national "0" prefix, so what is
  // shown matches what is typed ("98765 43210", not "098765 43210").
  const text = example ? example.formatInternational().replace(/^\+\d+\s*/, "") : "";
  return { text, digits: example?.nationalNumber.length ?? 0 };
}

export const toInternational = (country: CountryCode, digits: string) => (digits ? `+${getCountryCallingCode(country)}${digits}` : "");

/** Break a stored number (even an older free-typed one) back into country + national digits. */
export function splitPhone(value: string, fallback: CountryCode): { country: CountryCode; digits: string } {
  const parsed = value ? parsePhoneNumberFromString(value, fallback) : undefined;
  if (parsed?.country) return { country: parsed.country, digits: parsed.nationalNumber };
  return { country: fallback, digits: value.replace(/\D/g, "") };
}

/** An empty number is allowed (the field is optional); a filled one must be valid for its country. */
export const isPhoneValid = (value: string) => !value || isValidPhoneNumber(value);
