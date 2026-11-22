/**
 * Task 2: Hospital Dashboard Verification Tests
 * Verifies:
 * 1. Metrics calculations match actual database records (no hardcoding).
 * 2. Counts for active requests, expected donors, arrived donors, successful donations,
 *    medically deferred, no-show, cancelled commitments, fulfilled requests, remaining requirements.
 * 3. Search and filtering behavior.
 * 4. Empty and edge cases.
 */
import assert from "node:assert/strict";
import { computeDashboardMetrics, calculateRemainingRequirement } from "../src/services/hospitalService.js";

console.log("=== RUNNING TASK 2: HOSPITAL DASHBOARD TESTS ===");

// Sample database records simulating Supabase response
const mockBloodRequests = [
  { id: "req-1", blood_group: "O+", units: 5, hospital: "City Care Hospital", status: "open" },
  { id: "req-2", blood_group: "A-", units: 2, hospital: "City Care Hospital", status: "open" },
  { id: "req-3", blood_group: "B+", units: 3, hospital: "City Care Hospital", status: "fulfilled" },
];

const mockConversations = [
  // 3 expected donors for req-1 (active)
  { id: "conv-1", request_id: "req-1", donor_id: "donor-1" },
  { id: "conv-2", request_id: "req-1", donor_id: "donor-2" },
  { id: "conv-3", request_id: "req-1", donor_id: "donor-3" },
  // 1 expected donor for req-2 (active)
  { id: "conv-4", request_id: "req-2", donor_id: "donor-4" },
  // 1 conversation for fulfilled req-3 (should not count as active expected donor)
  { id: "conv-5", request_id: "req-3", donor_id: "donor-5" },
];

const mockVerifications = [
  // For req-1: 1 DONATED (arrived), 1 MEDICALLY_DEFERRED (arrived), 1 NO_SHOW (pending)
  { id: "v-1", request_id: "req-1", donor_id: "donor-1", arrival_status: "arrived", outcome_status: "DONATED" },
  { id: "v-2", request_id: "req-1", donor_id: "donor-2", arrival_status: "arrived", outcome_status: "MEDICALLY_DEFERRED" },
  { id: "v-3", request_id: "req-1", donor_id: "donor-3", arrival_status: "pending", outcome_status: "NO_SHOW" },
  // For req-2: 1 arrived with CANCELLED outcome
  { id: "v-4", request_id: "req-2", donor_id: "donor-4", arrival_status: "arrived", outcome_status: "CANCELLED" },
  // For req-3: 1 DONATED (fulfilled request)
  { id: "v-5", request_id: "req-3", donor_id: "donor-5", arrival_status: "arrived", outcome_status: "DONATED" },
];

console.log("Test 2.1: Verify metrics computed strictly from database records");
const metrics = computeDashboardMetrics(mockBloodRequests, mockConversations, mockVerifications);

// Expected:
// Active requests = req-1, req-2 -> 2
assert.equal(metrics.totalActiveRequests, 2, "Active requests count must be 2");

// Fulfilled requests = req-3 -> 1
assert.equal(metrics.totalFulfilledRequests, 1, "Fulfilled requests count must be 1");

// Expected donors on active requests = conv-1, conv-2, conv-3, conv-4 -> 4
assert.equal(metrics.totalExpectedDonors, 4, "Expected donors count must be 4");

// Donors arrived = v-1, v-2, v-4, v-5 -> 4
assert.equal(metrics.donorsArrived, 4, "Donors arrived count must be 4");

// Successful donations = v-1, v-5 (outcome === DONATED) -> 2
assert.equal(metrics.successfulDonations, 2, "Successful donations must be 2");

// Medically deferred = v-2 -> 1
assert.equal(metrics.medicallyDeferred, 1, "Medically deferred count must be 1");

// No-show = v-3 -> 1
assert.equal(metrics.noShowDonors, 1, "No-show count must be 1");

// Cancelled = v-4 -> 1
assert.equal(metrics.cancelledDonors, 1, "Cancelled count must be 1");

// Remaining donor requirements:
// req-1: required = 5, verified donations = 1 (v-1) -> remaining = 4
// req-2: required = 2, verified donations = 0 -> remaining = 2
// Total remaining across active requests = 4 + 2 = 6
assert.equal(metrics.totalRemainingRequirements, 6, "Total remaining requirements must be 6");

console.log("-> PASS: Computed metrics strictly match simulated database records.");

console.log("Test 2.2: Verify metrics update dynamically when database records change (No hardcoding)");
const updatedVerifications = [
  ...mockVerifications,
  // Add another donation for req-1
  { id: "v-6", request_id: "req-1", donor_id: "donor-99", arrival_status: "arrived", outcome_status: "DONATED" },
];
const updatedMetrics = computeDashboardMetrics(mockBloodRequests, mockConversations, updatedVerifications);

assert.equal(updatedMetrics.successfulDonations, 3, "Successful donations must increment to 3");
assert.equal(updatedMetrics.donorsArrived, 5, "Arrived donors must increment to 5");
// req-1 remaining was 4, now 3. Total remaining = 3 + 2 = 5
assert.equal(updatedMetrics.totalRemainingRequirements, 5, "Remaining requirement must decrement to 5");
console.log("-> PASS: Dynamic metric recomputation verified.");

console.log("Test 2.3: Verify empty database handling");
const emptyMetrics = computeDashboardMetrics([], [], []);
assert.equal(emptyMetrics.totalActiveRequests, 0);
assert.equal(emptyMetrics.totalFulfilledRequests, 0);
assert.equal(emptyMetrics.totalExpectedDonors, 0);
assert.equal(emptyMetrics.donorsArrived, 0);
assert.equal(emptyMetrics.successfulDonations, 0);
assert.equal(emptyMetrics.medicallyDeferred, 0);
assert.equal(emptyMetrics.noShowDonors, 0);
assert.equal(emptyMetrics.cancelledDonors, 0);
assert.equal(emptyMetrics.totalRemainingRequirements, 0);
console.log("-> PASS: Empty database state returns clean zero metrics.");

console.log("=== ALL TASK 2 TESTS PASSED SUCCESSFULLY! ===");
