import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDealMachinePerson,
  normalizeDealMachineProperty,
} from "../lib/automation/lead-contracts.ts";

test("normalizes an official provider property envelope without retaining arbitrary fields", () => {
  const result = normalizeDealMachineProperty({
    data: {
      dm_property_id: "prop_123",
      address: "123 Main Street",
      city: "Fall River",
      state: "MA",
      zip: "02720",
      estimated_value: 245000,
      owner_name: "Example Family Trust",
      secret_provider_field: "do not retain",
    },
  });

  assert.deepEqual(result, {
    provider: "dealmachine",
    providerPropertyId: "prop_123",
    address: "123 Main Street",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: 245000,
    ownerName: "Example Family Trust",
  });
});

test("normalizes people data into explicit contact fields and preserves unknowns", () => {
  const result = normalizeDealMachinePerson({
    data: {
      dm_person_id: "person_123",
      full_name: "Example Owner",
      phones: [{ number: "+15085550123", type: "mobile" }],
      emails: [{ address: "owner@example.com" }],
      dnc: true,
      private_notes: "do not retain",
    },
  });

  assert.deepEqual(result, {
    provider: "dealmachine",
    providerPersonId: "person_123",
    ownerName: "Example Owner",
    phones: ["+15085550123"],
    emails: ["owner@example.com"],
    dnc: true,
  });
});

test("rejects malformed or owner-free records rather than inventing identity", () => {
  assert.equal(normalizeDealMachineProperty({ data: { address: "123 Main Street" } }), null);
  assert.equal(normalizeDealMachinePerson({ data: { dm_person_id: "person_123" } }), null);
});
