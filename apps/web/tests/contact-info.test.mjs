import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_OPTIONS,
  callingCode,
  composeLocation,
  countryName,
  isSupportedCountry,
  normalizePhone,
  validateProfileContact,
} from "../src/lib/contact-info.mjs";

test("COUNTRY_OPTIONS is a sorted list with names and calling codes", () => {
  assert.ok(COUNTRY_OPTIONS.length > 200);
  const us = COUNTRY_OPTIONS.find((c) => c.code === "US");
  assert.equal(us.name, "United States");
  assert.equal(us.callingCode, "+1");
  const vn = COUNTRY_OPTIONS.find((c) => c.code === "VN");
  assert.equal(vn.name, "Vietnam");
  assert.equal(vn.callingCode, "+84");
  // Sorted by display name.
  const names = COUNTRY_OPTIONS.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test("countryName / callingCode / isSupportedCountry", () => {
  assert.equal(countryName("GB"), "United Kingdom");
  assert.equal(countryName(""), "");
  assert.equal(callingCode("US"), "+1");
  assert.equal(callingCode(""), "");
  assert.equal(isSupportedCountry("US"), true);
  assert.equal(isSupportedCountry("ZZ"), false);
  assert.equal(isSupportedCountry(""), false);
});

test("composeLocation joins city and country", () => {
  assert.equal(composeLocation("San Diego", "US"), "San Diego, United States");
  assert.equal(composeLocation("", "VN"), "Vietnam");
  assert.equal(composeLocation("Austin", ""), "Austin");
  assert.equal(composeLocation("", ""), null);
  assert.equal(composeLocation("  ", ""), null);
});

test("normalizePhone: national number with country -> E.164", () => {
  assert.deepEqual(normalizePhone("619 555 0199", "US"), { ok: true, e164: "+16195550199" });
});

test("normalizePhone: international number needs no country", () => {
  assert.deepEqual(normalizePhone("+84 28 3822 9999", ""), { ok: true, e164: "+842838229999" });
});

test("normalizePhone: empty is allowed", () => {
  assert.deepEqual(normalizePhone("", "US"), { ok: true, e164: null });
  assert.deepEqual(normalizePhone("   ", ""), { ok: true, e164: null });
});

test("normalizePhone: invalid number for the country is rejected", () => {
  const result = normalizePhone("123", "US");
  assert.equal(result.ok, false);
  assert.match(result.error, /valid phone number for United States/);
});

test("normalizePhone: national number with no country asks for country or +", () => {
  const result = normalizePhone("619 555 0199", "");
  assert.equal(result.ok, false);
  assert.match(result.error, /Select a country/);
});

test("validateProfileContact: normalizes and composes on success", () => {
  const result = validateProfileContact({
    location_country: "us",
    location_city: "San Diego",
    phone: "619 555 0199",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    location_country: "US",
    location_city: "San Diego",
    location_preference: "San Diego, United States",
    phone: "+16195550199",
  });
});

test("validateProfileContact: empties become null", () => {
  const result = validateProfileContact({ location_country: "", location_city: "", phone: "" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    location_country: null,
    location_city: null,
    location_preference: null,
    phone: null,
  });
});

test("validateProfileContact: collects field errors", () => {
  const result = validateProfileContact({
    location_country: "ZZ",
    location_city: "x".repeat(121),
    phone: "123",
  });
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.location_country);
  assert.ok(result.fieldErrors.location_city);
  assert.ok(result.fieldErrors.phone);
});

test("validateProfileContact: rejects an email in the city field", () => {
  // Regression: an email cross-filled into city composed into location_preference
  // and appeared twice on the generated CV's contact line.
  const result = validateProfileContact({
    location_country: "US",
    location_city: "phamminhtuan1999@gmail.com",
    phone: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors.location_city, "Enter a city name, not an email address.");
});
