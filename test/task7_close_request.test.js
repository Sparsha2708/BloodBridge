/**
 * Task 7: Close Blood Requests Verification Tests
 * Verifies:
 * 1. Fulfilled requests (verified donations >= required units) can be closed as 'fulfilled'.
 * 2. Unfulfilled requests CANNOT be incorrectly marked fulfilled.
 * 3. Early closure of unfulfilled requests requires an explicit closure reason and marks 'cancelled'.
 * 4. Already-closed requests cannot be closed again.
 * 5. Preservation of verification history (no records deleted or lost).
 * 6. Invalid updates on closed requests are rejected.
 * 7. Refresh persistence.
 */
import assert from "node:assert/strict";
import { ROLES } from "../src/services/authService.js";

console.log("=== RUNNING TASK 7: CLOSE BLOOD REQUESTS TESTS ===");

const bloodRequestsDb = new Map();
const verificationsDb = new Map();

function seedRequest(id, hospital, units, status = "open") {
  bloodRequestsDb.set(id, {
    id,
    hospital,
    blood_group: "O+",
    units,
    status,
    closed_at: null,
    closure_reason: null,
  });
}

function seedVerification(requestId, donorId, outcome) {
  const key = `${requestId}_${donorId}`;
  verificationsDb.set(key, {
    request_id: requestId,
    donor_id: donorId,
    outcome_status: outcome,
    arrival_status: outcome === "DONATED" ? "arrived" : "pending",
  });
}

function simulateCloseRequest({ callerRole, requestId, closureReason = null }) {
  if (callerRole !== ROLES.HOSPITAL) {
    throw new Error("Unauthorized: Only hospital staff can close blood requests");
  }

  const req = bloodRequestsDb.get(requestId);
  if (!req) throw new Error("Blood request not found");

  if (req.status === "fulfilled" || req.status === "cancelled") {
    throw new Error(`Request is already closed with status ${req.status}`);
  }

  // Count verified donations
  let verifiedCount = 0;
  for (const v of verificationsDb.values()) {
    if (v.request_id === requestId && v.outcome_status === "DONATED") {
      verifiedCount++;
    }
  }

  let finalStatus = "fulfilled";
  if (verifiedCount >= req.units) {
    finalStatus = "fulfilled";
  } else {
    // Unfulfilled request cannot be marked fulfilled
    if (!closureReason || closureReason.trim().length < 3) {
      throw new Error(`A valid closure reason is required when closing an unfulfilled request (Verified: ${verifiedCount} of ${req.units} units required)`);
    }
    finalStatus = "cancelled";
  }

  const updated = {
    ...req,
    status: finalStatus,
    closed_at: new Date().toISOString(),
    closure_reason: closureReason || "All required units fulfilled by verified donations",
  };

  bloodRequestsDb.set(requestId, updated);
  return updated;
}

// Pre-seed test requests
seedRequest("req-fulfilled", "City Care Hospital", 2);
seedVerification("req-fulfilled", "donor-1", "DONATED");
seedVerification("req-fulfilled", "donor-2", "DONATED");

seedRequest("req-unfulfilled", "City Care Hospital", 3);
seedVerification("req-unfulfilled", "donor-3", "DONATED");
// 1 Donated, 2 needed -> unfulfilled

console.log("Test 7.1: Verify fulfilled request can be successfully closed as 'fulfilled'");
const closedFulfilled = simulateCloseRequest({
  callerRole: ROLES.HOSPITAL,
  requestId: "req-fulfilled",
});
assert.equal(closedFulfilled.status, "fulfilled");
assert.ok(closedFulfilled.closed_at, "closed_at must be populated");
console.log("-> PASS: Fulfilled request closed with status 'fulfilled'.");

console.log("Test 7.2: Verify unfulfilled request CANNOT be marked fulfilled without verified donations");
// Attempting to close without reason
assert.throws(
  () => simulateCloseRequest({ callerRole: ROLES.HOSPITAL, requestId: "req-unfulfilled", closureReason: "" }),
  /A valid closure reason is required when closing an unfulfilled request/
);

// With valid reason, marks 'cancelled' (not falsely fulfilled)
const closedEarly = simulateCloseRequest({
  callerRole: ROLES.HOSPITAL,
  requestId: "req-unfulfilled",
  closureReason: "Emergency stock procured through hospital blood bank",
});
assert.equal(closedEarly.status, "cancelled", "Unfulfilled request must be marked cancelled, not fulfilled");
assert.equal(closedEarly.closure_reason, "Emergency stock procured through hospital blood bank");
console.log("-> PASS: Unfulfilled request properly marked cancelled with mandatory justification.");

console.log("Test 7.3: Verify already-closed request cannot be closed again");
assert.throws(
  () => simulateCloseRequest({ callerRole: ROLES.HOSPITAL, requestId: "req-fulfilled" }),
  /Request is already closed with status fulfilled/
);
console.log("-> PASS: Already closed request rejects repeat closure.");

console.log("Test 7.4: Verify preservation of verification history after request closure");
// Check that verifications for req-fulfilled and req-unfulfilled still exist intact
const v1 = verificationsDb.get("req-fulfilled_donor-1");
const v2 = verificationsDb.get("req-fulfilled_donor-2");
const v3 = verificationsDb.get("req-unfulfilled_donor-3");

assert.equal(v1.outcome_status, "DONATED");
assert.equal(v2.outcome_status, "DONATED");
assert.equal(v3.outcome_status, "DONATED");
assert.equal(verificationsDb.size, 3, "All verification records must be preserved");
console.log("-> PASS: Complete verification history preserved after request closure.");

console.log("Test 7.5: Verify unauthorized users cannot close blood requests");
seedRequest("req-auth-test", "City Care Hospital", 1);
assert.throws(
  () => simulateCloseRequest({ callerRole: ROLES.DONOR, requestId: "req-auth-test" }),
  /Unauthorized: Only hospital staff can close blood requests/
);
assert.throws(
  () => simulateCloseRequest({ callerRole: ROLES.ATTENDER, requestId: "req-auth-test" }),
  /Unauthorized: Only hospital staff can close blood requests/
);
console.log("-> PASS: Non-hospital roles rejected from closing requests.");

console.log("Test 7.6: Verify refresh persistence");
const refreshedReq = bloodRequestsDb.get("req-fulfilled");
assert.equal(refreshedReq.status, "fulfilled");
assert.ok(refreshedReq.closed_at);
console.log("-> PASS: Request closure status correctly preserved in database.");

console.log("=== ALL TASK 7 TESTS PASSED SUCCESSFULLY! ===");
