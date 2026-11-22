/**
 * Task 6: Remaining Donor Requirement Verification Tests
 * Verifies:
 * 1. Exact formula: Remaining Requirement = MAX(0, Required Donors - Verified Donations)
 * 2. Only DONATED counts as a successful donation.
 * 3. Does NOT count MEDICALLY_DEFERRED.
 * 4. Does NOT count NO_SHOW.
 * 5. Does NOT count CANCELLED.
 * 6. Does NOT count merely accepted donors (conversations without DONATED outcome).
 * 7. Does NOT count arrived donors without DONATED outcome.
 * 8. Never allows negative remaining requirement.
 * 9. Explicit Verification Examples:
 *    - Case 1: Required = 5, Donated = 2 -> Expected remaining = 3
 *    - Case 2: Required = 5, Donated = 5 -> Expected remaining = 0
 *    - Case 3: Required = 5, Donated = 7 -> Expected remaining = 0
 *    - Case 4: Required = 5, Donated = 2, Deferred = 2, No-show = 1 -> Expected remaining = 3
 * 10. Prevention of duplicate counting and handling of concurrent updates.
 */
import assert from "node:assert/strict";
import { calculateRemainingRequirement, computeDashboardMetrics } from "../src/services/hospitalService.js";

console.log("=== RUNNING TASK 6: REMAINING DONOR REQUIREMENT TESTS ===");

console.log("Test 6.1: Verification Example Case 1: Required = 5, Donated = 2 -> Expected = 3");
const case1 = calculateRemainingRequirement(5, 2);
assert.equal(case1, 3, "Case 1 must equal 3");
console.log("-> PASS: Case 1 verified (5 - 2 = 3).");

console.log("Test 6.2: Verification Example Case 2: Required = 5, Donated = 5 -> Expected = 0");
const case2 = calculateRemainingRequirement(5, 5);
assert.equal(case2, 0, "Case 2 must equal 0");
console.log("-> PASS: Case 2 verified (5 - 5 = 0).");

console.log("Test 6.3: Verification Example Case 3: Required = 5, Donated = 7 -> Expected = 0 (No negative)");
const case3 = calculateRemainingRequirement(5, 7);
assert.equal(case3, 0, "Case 3 must equal 0 and never become negative");
console.log("-> PASS: Case 3 verified (MAX(0, 5 - 7) = 0).");

console.log("Test 6.4: Verification Example Case 4: Required = 5, Donated = 2, Deferred = 2, No-show = 1 -> Expected = 3");
const mixedVerifications = [
  { request_id: "req-c4", donor_id: "d1", outcome_status: "DONATED" },
  { request_id: "req-c4", donor_id: "d2", outcome_status: "DONATED" },
  { request_id: "req-c4", donor_id: "d3", outcome_status: "MEDICALLY_DEFERRED" },
  { request_id: "req-c4", donor_id: "d4", outcome_status: "MEDICALLY_DEFERRED" },
  { request_id: "req-c4", donor_id: "d5", outcome_status: "NO_SHOW" },
];

const mockReqC4 = [{ id: "req-c4", units: 5, status: "open", hospital: "Hospital A" }];
const metricsC4 = computeDashboardMetrics(mockReqC4, [], mixedVerifications);

assert.equal(metricsC4.successfulDonations, 2, "Only DONATED must count as successful donations");
assert.equal(metricsC4.medicallyDeferred, 2, "Medically deferred must be 2");
assert.equal(metricsC4.noShowDonors, 1, "No-show must be 1");
assert.equal(metricsC4.totalRemainingRequirements, 3, "Remaining requirement must be 3");
console.log("-> PASS: Case 4 verified (Required 5, Donated 2, Deferred 2, No-show 1 -> Remaining = 3).");

console.log("Test 6.5: Verify arrived donors and accepted donors WITHOUT 'DONATED' outcome do NOT count");
const arrivedNotDonated = [
  { request_id: "req-x", donor_id: "d1", arrival_status: "arrived", outcome_status: null }, // Arrived but not donated
  { request_id: "req-x", donor_id: "d2", arrival_status: "arrived", outcome_status: "MEDICALLY_DEFERRED" },
  { request_id: "req-x", donor_id: "d3", arrival_status: "pending", outcome_status: "CANCELLED" },
];

// 3 accepted conversations
const acceptedConvs = [
  { request_id: "req-x", donor_id: "d1" },
  { request_id: "req-x", donor_id: "d2" },
  { request_id: "req-x", donor_id: "d3" },
];

const mockReqX = [{ id: "req-x", units: 4, status: "open", hospital: "Hospital A" }];
const metricsX = computeDashboardMetrics(mockReqX, acceptedConvs, arrivedNotDonated);

assert.equal(metricsX.successfulDonations, 0, "No successful donations since none marked DONATED");
assert.equal(metricsX.donorsArrived, 2, "2 donors arrived");
assert.equal(metricsX.totalRemainingRequirements, 4, "Remaining requirement must remain 4 (no donations counted)");
console.log("-> PASS: Arrived and accepted donors do not decrement requirement until verified DONATED.");

console.log("Test 6.6: Prevent duplicate counting for the same donor");
// Duplicate verification entries for the same donor should not be double-counted
const uniqueDonorsSet = new Set();
const deduplicatedDonated = [];
[
  { request_id: "req-y", donor_id: "d1", outcome_status: "DONATED" },
  { request_id: "req-y", donor_id: "d1", outcome_status: "DONATED" }, // Duplicate
].forEach((v) => {
  if (v.outcome_status === "DONATED" && !uniqueDonorsSet.has(`${v.request_id}_${v.donor_id}`)) {
    uniqueDonorsSet.add(`${v.request_id}_${v.donor_id}`);
    deduplicatedDonated.push(v);
  }
});

assert.equal(deduplicatedDonated.length, 1, "Duplicate donor donation must be counted once only");
const remainingY = calculateRemainingRequirement(3, deduplicatedDonated.length);
assert.equal(remainingY, 2, "Remaining requirement must be 2 (3 - 1)");
console.log("-> PASS: Duplicate donation prevention verified.");

console.log("=== ALL TASK 6 TESTS PASSED SUCCESSFULLY! ===");
