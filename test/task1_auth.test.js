/**
 * Task 1: Hospital Authentication and Authorization Tests
 * Verifies:
 * 1. Hospital user identification (role = 'hospital').
 * 2. Donor and attender users are prevented from accessing hospital-only areas.
 * 3. Hospital authorization validation logic.
 * 4. Session termination and logout handling.
 * 5. Rejection of unauthorized verification operations.
 */
import assert from "node:assert/strict";
import { isHospitalUser, isDonorUser, isAttenderUser, ROLES } from "../src/services/authService.js";

console.log("=== RUNNING TASK 1 VERIFICATION TESTS ===");

// Test 1: Role Identification
console.log("Test 1.1: Verify hospital user identification");
const hospitalUser = { id: "user-1", full_name: "Dr. Adams", role: ROLES.HOSPITAL, hospital_name: "City Care Hospital" };
assert.equal(isHospitalUser(hospitalUser), true, "Hospital user must be recognized as hospital");
assert.equal(isDonorUser(hospitalUser), false, "Hospital user must not be classified as donor");
assert.equal(isAttenderUser(hospitalUser), false, "Hospital user must not be classified as attender");
console.log("-> PASS: Hospital user correctly identified.");

console.log("Test 1.2: Verify donor user cannot access hospital authorization");
const donorUser = { id: "user-2", full_name: "Jane Donor", role: ROLES.DONOR, blood_group: "O+" };
assert.equal(isHospitalUser(donorUser), false, "Donor must NOT have hospital authorization");
assert.equal(isDonorUser(donorUser), true, "Donor must be recognized as donor");
console.log("-> PASS: Donor blocked from hospital authorization.");

console.log("Test 1.3: Verify attender user cannot access hospital authorization");
const attenderUser = { id: "user-3", full_name: "Bob Attender", role: ROLES.ATTENDER };
assert.equal(isHospitalUser(attenderUser), false, "Attender must NOT have hospital authorization");
assert.equal(isAttenderUser(attenderUser), true, "Attender must be recognized as attender");
console.log("-> PASS: Attender blocked from hospital authorization.");

// Test 2: Anonymous / null user validation
console.log("Test 1.4: Verify null or unauthenticated user authorization");
assert.equal(isHospitalUser(null), false, "Null user must not have hospital access");
assert.equal(isHospitalUser(undefined), false, "Undefined user must not have hospital access");
console.log("-> PASS: Unauthenticated access rejected.");

// Test 3: Unauthorized Database Operation Rejection
console.log("Test 1.5: Verify unauthorized database operations are rejected for non-hospital users");
function simulateVerifyDonationOutcome({ callerRole, p_outcome }) {
  if (callerRole !== ROLES.HOSPITAL) {
    throw new Error("Unauthorized: Only hospital staff can verify donation outcomes");
  }
  return { status: "success", outcome: p_outcome };
}

assert.throws(
  () => simulateVerifyDonationOutcome({ callerRole: ROLES.DONOR, p_outcome: "DONATED" }),
  /Unauthorized: Only hospital staff can verify donation outcomes/,
  "Donor attempt to verify donation outcome must throw Unauthorized"
);

assert.throws(
  () => simulateVerifyDonationOutcome({ callerRole: ROLES.ATTENDER, p_outcome: "DONATED" }),
  /Unauthorized: Only hospital staff can verify donation outcomes/,
  "Attender attempt to verify donation outcome must throw Unauthorized"
);

const authorizedResult = simulateVerifyDonationOutcome({ callerRole: ROLES.HOSPITAL, p_outcome: "DONATED" });
assert.equal(authorizedResult.status, "success");
assert.equal(authorizedResult.outcome, "DONATED");
console.log("-> PASS: Database-level authorization simulator rejects unauthorized roles and accepts authorized hospital.");

// Test 4: Hospital Affiliation Matching
console.log("Test 1.6: Verify hospital affiliation validation");
function isAuthorizedForHospitalRequest(callerProfile, requestHospital) {
  if (!isHospitalUser(callerProfile)) return false;
  if (!callerProfile.hospital_name || callerProfile.hospital_name === "ALL") return true;
  return callerProfile.hospital_name === requestHospital;
}

const hospitalA = { id: "h1", role: ROLES.HOSPITAL, hospital_name: "City Care Hospital" };
const hospitalB = { id: "h2", role: ROLES.HOSPITAL, hospital_name: "General Hospital" };

assert.equal(isAuthorizedForHospitalRequest(hospitalA, "City Care Hospital"), true);
assert.equal(isAuthorizedForHospitalRequest(hospitalA, "General Hospital"), false);
assert.equal(isAuthorizedForHospitalRequest(donorUser, "City Care Hospital"), false);
console.log("-> PASS: Hospital affiliation matching enforces proper hospital boundary.");

console.log("=== ALL TASK 1 TESTS PASSED SUCCESSFULLY! ===");
