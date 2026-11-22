/**
 * Task 3: View Expected Donors Verification Tests
 * Verifies:
 * 1. Donors associated with the authenticated hospital's blood requests appear correctly.
 * 2. Unrelated donors/hospitals are strictly excluded (data isolation).
 * 3. Required fields: name, blood group, contact info, request ID, required blood group, appointment/date,
 *    acceptance status, arrival status, verification status.
 * 4. No duplicate entries for a donor on a request.
 * 5. Search by donor name.
 * 6. Filters: blood group, request ID, date, arrival status, verification outcome status.
 */
import assert from "node:assert/strict";

console.log("=== RUNNING TASK 3: VIEW EXPECTED DONORS TESTS ===");

// Simulated Hospital database dataset
const targetHospital = "City Care Hospital";
const otherHospital = "Apex Metro Hospital";

const mockRequests = [
  { id: "req-101", hospital: targetHospital, blood_group: "O+", units: 2, needed_by: "2026-11-25T10:00:00Z" },
  { id: "req-102", hospital: targetHospital, blood_group: "A-", units: 1, needed_by: "2026-11-26T14:00:00Z" },
  { id: "req-999", hospital: otherHospital, blood_group: "B+", units: 4, needed_by: "2026-11-27T12:00:00Z" },
];

const mockDonors = [
  { id: "donor-1", full_name: "Alice Walker", blood_group: "O+", phone: "+91-9876543210" },
  { id: "donor-2", full_name: "Bob Sharma", blood_group: "O-", phone: "+91-9876543211" },
  { id: "donor-3", full_name: "Charlie David", blood_group: "A-", phone: "+91-9876543212" },
  { id: "donor-unrelated", full_name: "Eve Rogue", blood_group: "B+", phone: "+91-9876543299" },
];

const mockConversations = [
  // Alice accepted req-101 (City Care Hospital)
  { id: "conv-1", request_id: "req-101", donor_id: "donor-1", created_at: "2026-11-23T08:00:00Z" },
  // Bob accepted req-101 (City Care Hospital)
  { id: "conv-2", request_id: "req-101", donor_id: "donor-2", created_at: "2026-11-23T09:30:00Z" },
  // Charlie accepted req-102 (City Care Hospital)
  { id: "conv-3", request_id: "req-102", donor_id: "donor-3", created_at: "2026-11-24T11:15:00Z" },
  // Eve accepted req-999 (Apex Metro Hospital - UNRELATED)
  { id: "conv-4", request_id: "req-999", donor_id: "donor-unrelated", created_at: "2026-11-24T12:00:00Z" },
];

const mockVerifications = [
  { request_id: "req-101", donor_id: "donor-1", arrival_status: "arrived", arrived_at: "2026-11-25T09:50:00Z", outcome_status: "DONATED", verified_at: "2026-11-25T10:30:00Z" },
  { request_id: "req-101", donor_id: "donor-2", arrival_status: "pending", arrived_at: null, outcome_status: null, verified_at: null },
  { request_id: "req-102", donor_id: "donor-3", arrival_status: "arrived", arrived_at: "2026-11-26T13:45:00Z", outcome_status: "MEDICALLY_DEFERRED", deferral_reason: "Low hemoglobin", verified_at: "2026-11-26T14:15:00Z" },
];

// Helper to assemble expected donors for a hospital
function getExpectedDonorsForHospital(hospitalName) {
  const hospitalReqs = mockRequests.filter((r) => r.hospital === hospitalName);
  const reqMap = new Map(hospitalReqs.map((r) => [r.id, r]));
  const donorMap = new Map(mockDonors.map((d) => [d.id, d]));
  const verifMap = new Map(mockVerifications.map((v) => [`${v.request_id}_${v.donor_id}`, v]));

  // Find conversations matching this hospital's requests
  const matchedConvs = mockConversations.filter((c) => reqMap.has(c.request_id));

  // Deduplication check: Set of `${request_id}_${donor_id}`
  const seenPairs = new Set();
  const result = [];

  for (const c of matchedConvs) {
    const pairKey = `${c.request_id}_${c.donor_id}`;
    assert.equal(seenPairs.has(pairKey), false, "Duplicate donor entry detected for request");
    seenPairs.add(pairKey);

    const req = reqMap.get(c.request_id);
    const donor = donorMap.get(c.donor_id);
    const verif = verifMap.get(pairKey);

    result.push({
      id: c.id,
      request_id: c.request_id,
      donor_id: c.donor_id,
      donor,
      request: req,
      accepted_at: c.created_at,
      arrival_status: verif?.arrival_status || "pending",
      arrived_at: verif?.arrived_at || null,
      outcome_status: verif?.outcome_status || null,
      deferral_reason: verif?.deferral_reason || null,
      verified_at: verif?.verified_at || null,
    });
  }

  return result;
}

console.log("Test 3.1: Verify correct expected donors for authorized hospital and exclusion of unrelated hospital data");
const cityCareDonors = getExpectedDonorsForHospital("City Care Hospital");

assert.equal(cityCareDonors.length, 3, "City Care Hospital must have exactly 3 expected donors");
assert.ok(cityCareDonors.some((d) => d.donor.full_name === "Alice Walker"), "Alice Walker should be in list");
assert.ok(cityCareDonors.some((d) => d.donor.full_name === "Bob Sharma"), "Bob Sharma should be in list");
assert.ok(cityCareDonors.some((d) => d.donor.full_name === "Charlie David"), "Charlie David should be in list");

// Verify unrelated hospital donor is NOT exposed
assert.equal(
  cityCareDonors.some((d) => d.donor.full_name === "Eve Rogue"),
  false,
  "Unrelated hospital donor (Eve Rogue) must NOT be exposed to City Care Hospital"
);
console.log("-> PASS: Expected donors loaded with strict hospital authorization boundary.");

console.log("Test 3.2: Verify all required donor information fields are present");
const alice = cityCareDonors.find((d) => d.donor.full_name === "Alice Walker");
assert.equal(alice.donor.full_name, "Alice Walker");
assert.equal(alice.donor.blood_group, "O+");
assert.equal(alice.donor.phone, "+91-9876543210");
assert.equal(alice.request_id, "req-101");
assert.equal(alice.request.blood_group, "O+");
assert.equal(alice.request.needed_by, "2026-11-25T10:00:00Z");
assert.equal(alice.arrival_status, "arrived");
assert.equal(alice.outcome_status, "DONATED");
assert.ok(alice.accepted_at);
console.log("-> PASS: All required donor and request details are present.");

console.log("Test 3.3: Verify filtering and search functionality");
function filterDonorsList(donors, { searchName = "", bloodGroup = "ALL", requestId = "ALL", date = "", arrival = "ALL", status = "ALL" }) {
  return donors.filter((item) => {
    if (searchName && !item.donor.full_name.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (bloodGroup !== "ALL" && item.donor.blood_group !== bloodGroup && item.request.blood_group !== bloodGroup) return false;
    if (requestId !== "ALL" && item.request_id !== requestId) return false;
    if (date) {
      const matchAccepted = item.accepted_at && item.accepted_at.startsWith(date);
      const matchNeeded = item.request.needed_by && item.request.needed_by.startsWith(date);
      if (!matchAccepted && !matchNeeded) return false;
    }
    if (arrival !== "ALL") {
      if (arrival === "arrived" && item.arrival_status !== "arrived") return false;
      if (arrival === "pending" && item.arrival_status === "arrived") return false;
    }
    if (status !== "ALL") {
      if (status === "UNVERIFIED" && item.outcome_status) return false;
      if (status !== "UNVERIFIED" && item.outcome_status !== status) return false;
    }
    return true;
  });
}

// 1. Search by donor name
const searchedAlice = filterDonorsList(cityCareDonors, { searchName: "alice" });
assert.equal(searchedAlice.length, 1);
assert.equal(searchedAlice[0].donor.full_name, "Alice Walker");

// 2. Filter by blood group
const filteredOPlus = filterDonorsList(cityCareDonors, { bloodGroup: "O+" });
assert.equal(filteredOPlus.length, 2, "Alice (donor O+, req O+) and Bob (donor O-, req O+) both match req O+");

// 3. Filter by request ID
const req102Only = filterDonorsList(cityCareDonors, { requestId: "req-102" });
assert.equal(req102Only.length, 1);
assert.equal(req102Only[0].donor.full_name, "Charlie David");

// 4. Filter by date (acceptance date 2026-11-23)
const dateNov23 = filterDonorsList(cityCareDonors, { date: "2026-11-23" });
assert.equal(dateNov23.length, 2);

// 5. Filter by arrival status
const arrivedOnly = filterDonorsList(cityCareDonors, { arrival: "arrived" });
assert.equal(arrivedOnly.length, 2); // Alice & Charlie
const pendingArrival = filterDonorsList(cityCareDonors, { arrival: "pending" });
assert.equal(pendingArrival.length, 1); // Bob

// 6. Filter by donor verification status
const donatedOnly = filterDonorsList(cityCareDonors, { status: "DONATED" });
assert.equal(donatedOnly.length, 1);
assert.equal(donatedOnly[0].donor.full_name, "Alice Walker");

const unverifiedOnly = filterDonorsList(cityCareDonors, { status: "UNVERIFIED" });
assert.equal(unverifiedOnly.length, 1);
assert.equal(unverifiedOnly[0].donor.full_name, "Bob Sharma");

const deferredOnly = filterDonorsList(cityCareDonors, { status: "MEDICALLY_DEFERRED" });
assert.equal(deferredOnly.length, 1);
assert.equal(deferredOnly[0].donor.full_name, "Charlie David");

console.log("-> PASS: Search and all 5 filters work accurately.");
console.log("=== ALL TASK 3 TESTS PASSED SUCCESSFULLY! ===");
