// Pure contact helpers for the career profile (US-057, decision 0017).
// libphonenumber-js supplies the supported-country list, calling codes, and
// phone validation/E.164 normalization; Intl.DisplayNames supplies country
// names (no shipped dataset). Kept out of action-validation.mjs so the library
// is only bundled where the profile form actually needs it.
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry as libIsSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code) {
  if (!code) {
    return "";
  }
  // Intl returns the input code for regions it doesn't know; treat that as a
  // missing name rather than echoing the code.
  const name = regionNames.of(code);
  return name && name !== code ? name : code;
}

export function callingCode(code) {
  if (!code || !libIsSupportedCountry(code)) {
    return "";
  }
  return `+${getCountryCallingCode(code)}`;
}

// Country dropdown options, sorted by display name. Built once at module load.
export const COUNTRY_OPTIONS = getCountries()
  .map((code) => ({ code, name: countryName(code), callingCode: callingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function isSupportedCountry(code) {
  return Boolean(code) && libIsSupportedCountry(code);
}

// Compose the "City, Country" display string the CV and profile read. Returns
// null when neither part is present.
export function composeLocation(city, countryCode) {
  const trimmedCity = (city || "").trim();
  const name = countryCode ? countryName(countryCode) : "";
  const parts = [trimmedCity, name].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Validate + normalize a phone to E.164 using the selected country as the
// region. Returns { ok, e164 } on success (e164 is null when no number given),
// or { ok: false, error } with a country-specific message.
export function normalizePhone(raw, countryCode) {
  const value = (raw || "").trim();
  if (!value) {
    return { ok: true, e164: null };
  }

  const region = isSupportedCountry(countryCode) ? countryCode : undefined;
  const parsed = parsePhoneNumberFromString(value, region);

  if (!parsed || !parsed.isValid()) {
    if (!region && !value.startsWith("+")) {
      return {
        ok: false,
        error: "Select a country, or start the number with + and its country code.",
      };
    }
    return {
      ok: false,
      error: region
        ? `Enter a valid phone number for ${countryName(countryCode)}.`
        : "Enter a valid phone number.",
    };
  }

  return { ok: true, e164: parsed.number };
}

// Cross-field validation for the profile's location + phone. Consumes the raw
// form values, returns either field errors or the normalized values to persist
// (including the derived location_preference).
/**
 * @param {{ location_country?: string | null, location_city?: string | null, phone?: string | null }} input
 * @returns {{ ok: false, fieldErrors: Record<string, string> }
 *   | { ok: true, data: { location_country: string | null, location_city: string | null, location_preference: string | null, phone: string | null } }}
 */
export function validateProfileContact(input) {
  const { location_country, location_city, phone } = input;
  /** @type {Record<string, string>} */
  const fieldErrors = {};

  const country = (location_country || "").trim().toUpperCase();
  if (country && !isSupportedCountry(country)) {
    fieldErrors.location_country = "Choose a country from the list.";
  }

  const city = (location_city || "").trim();
  if (city.length > 120) {
    fieldErrors.location_city = "City must be 120 characters or less.";
  } else if (city.includes("@")) {
    // Guard against an email landing in the city field (e.g. browser autofill
    // cross-filling the contact email). A city never contains "@", and an email
    // here would otherwise be composed into location_preference and surface on
    // the generated CV's contact line.
    fieldErrors.location_city = "Enter a city name, not an email address.";
  }

  const effectiveCountry = country && isSupportedCountry(country) ? country : "";
  const phoneResult = normalizePhone(phone, effectiveCountry);
  if (!phoneResult.ok) {
    fieldErrors.phone = phoneResult.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      location_country: country || null,
      location_city: city || null,
      location_preference: composeLocation(city, effectiveCountry),
      phone: phoneResult.e164,
    },
  };
}
