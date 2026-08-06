import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRentCastOwner,
  normalizeRentCastProperties,
  normalizeRentCastProperty,
} from "../lib/automation/lead-contracts.ts";

test("normalizes a RentCast property record and retains only approved owner facts", () => {
  const result = normalizeRentCastProperty({
    id: "rentcast_123",
    formattedAddress: "123 Main Street, Fall River, MA 02720",
    addressLine1: "123 Main Street",
    city: "Fall River",
    state: "ma",
    zipCode: "02720",
    estimatedValue: 245000,
    owner: {
      names: ["Example Family Trust"],
      type: "Trust",
      mailingAddress: {
        addressLine1: "PO Box 10",
        city: "Boston",
        state: "MA",
        zipCode: "02108",
      },
    },
    ownerOccupied: false,
    privateNotes: "do not retain",
  });

  assert.deepEqual(result, {
    provider: "rentcast",
    providerPropertyId: "rentcast_123",
    address: "123 Main Street",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: 245000,
    ownerNames: ["Example Family Trust"],
    ownerType: "Trust",
    ownerMailingAddress: {
      addressLine1: "PO Box 10",
      addressLine2: null,
      city: "Boston",
      state: "MA",
      zipCode: "02108",
    },
    ownerOccupied: false,
  });
});

test("normalizes a bounded property collection and does not invent contacts", () => {
  const result = normalizeRentCastProperties([
    {
      id: "rentcast_123",
      addressLine1: "123 Main Street",
      city: "Fall River",
      state: "MA",
      zipCode: "02720",
      owner: { names: ["Example Owner"] },
    },
    { id: "missing-location", city: "Fall River" },
  ]);

  assert.deepEqual(result, [{
    provider: "rentcast",
    providerPropertyId: "rentcast_123",
    address: "123 Main Street",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: null,
    ownerNames: ["Example Owner"],
    ownerType: null,
    ownerMailingAddress: null,
    ownerOccupied: null,
  }]);
  assert.equal("phones" in (result[0] ?? {}), false);
  assert.equal("emails" in (result[0] ?? {}), false);
});

test("owner normalization is explicit and malformed records are rejected", () => {
  assert.deepEqual(normalizeRentCastOwner({
    id: "rentcast_123",
    addressLine1: "123 Main Street",
    city: "Fall River",
    state: "MA",
    zipCode: "02720",
    owner: { names: ["Example Owner"], type: "Individual" },
  }), {
    provider: "rentcast",
    providerPropertyId: "rentcast_123",
    ownerNames: ["Example Owner"],
    ownerType: "Individual",
    ownerMailingAddress: null,
    ownerOccupied: null,
  });
  assert.equal(normalizeRentCastProperty({ id: "missing-location" }), null);
  assert.equal(normalizeRentCastOwner({ data: { id: "missing-location" } }), null);
});
