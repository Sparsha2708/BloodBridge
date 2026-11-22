/**
 * BloodBridge Hospital Service
 * Fetches actual database records from Supabase and computes accurate metrics for Part 2.
 * No hardcoded values or mock data.
 */
import { supabase } from "../../supbaseClient.js";

/**
 * Calculates remaining donor requirement for a specific blood request.
 * Formula: MAX(0, Required Donors - Verified Donations)
 * Only DONATED counts as a successful donation.
 */
export function calculateRemainingRequirement(unitsRequired, verifiedDonationsCount) {
  const req = Number(unitsRequired) || 0;
  const verified = Number(verifiedDonationsCount) || 0;
  return Math.max(0, req - verified);
}

/**
 * Computes dashboard metrics from live database records.
 */
export function computeDashboardMetrics(bloodRequests = [], conversations = [], verifications = []) {
  const activeRequests = bloodRequests.filter((r) => r.status === "open");
  const fulfilledRequests = bloodRequests.filter((r) => r.status === "fulfilled");

  // Map of request_id -> verified donations count (only 'DONATED')
  const verifiedDonationsByReq = {};
  verifications.forEach((v) => {
    if (v.outcome_status === "DONATED") {
      verifiedDonationsByReq[v.request_id] = (verifiedDonationsByReq[v.request_id] || 0) + 1;
    }
  });

  // Calculate remaining requirement across all active requests
  let totalRemainingRequirements = 0;
  activeRequests.forEach((r) => {
    const verified = verifiedDonationsByReq[r.id] || 0;
    totalRemainingRequirements += calculateRemainingRequirement(r.units, verified);
  });

  // Counts from verifications
  const donorsArrived = verifications.filter((v) => v.arrival_status === "arrived").length;
  const successfulDonations = verifications.filter((v) => v.outcome_status === "DONATED").length;
  const medicallyDeferred = verifications.filter((v) => v.outcome_status === "MEDICALLY_DEFERRED").length;
  const noShowDonors = verifications.filter((v) => v.outcome_status === "NO_SHOW").length;
  const cancelledDonors = verifications.filter((v) => v.outcome_status === "CANCELLED").length;

  // Expected donors: Count of unique donors who accepted active requests
  const activeRequestIds = new Set(activeRequests.map((r) => r.id));
  const expectedDonorsCount = conversations.filter((c) => activeRequestIds.has(c.request_id)).length;

  return {
    totalActiveRequests: activeRequests.length,
    totalFulfilledRequests: fulfilledRequests.length,
    totalExpectedDonors: expectedDonorsCount,
    donorsArrived,
    successfulDonations,
    medicallyDeferred,
    noShowDonors,
    cancelledDonors,
    totalRemainingRequirements,
  };
}

/**
 * Fetch all hospital data from Supabase.
 * Returns live records or clean empty states if none exist.
 */
export async function fetchHospitalData(hospitalName) {
  try {
    let query = supabase
      .from("blood_requests")
      .select("*, requester:profiles!requester_id(full_name, phone)")
      .order("created_at", { ascending: false });

    if (hospitalName && hospitalName !== "ALL") {
      query = query.eq("hospital", hospitalName);
    }

    const { data: requests, error: reqError } = await query;
    if (reqError) {
      console.warn("Could not fetch blood_requests:", reqError.message);
      return {
        bloodRequests: [],
        expectedDonors: [],
        verifications: [],
        metrics: computeDashboardMetrics([], [], []),
      };
    }

    const bloodRequests = requests || [];
    const requestIds = bloodRequests.map((r) => r.id);

    if (requestIds.length === 0) {
      return {
        bloodRequests: [],
        expectedDonors: [],
        verifications: [],
        metrics: computeDashboardMetrics([], [], []),
      };
    }

    // Fetch conversations (accepted donors) for these requests
    const { data: convs, error: convError } = await supabase
      .from("conversations")
      .select("id, request_id, donor_id, created_at, donor:profiles!donor_id(id, full_name, avatar_url, blood_group, phone)")
      .in("request_id", requestIds);

    const conversations = convError ? [] : (convs || []);

    // Fetch verifications for these requests
    const { data: verifs, error: verifError } = await supabase
      .from("donor_verifications")
      .select("*")
      .in("request_id", requestIds);

    const verifications = verifError ? [] : (verifs || []);

    const verifMap = new Map();
    verifications.forEach((v) => {
      verifMap.set(`${v.request_id}_${v.donor_id}`, v);
    });

    const reqMap = new Map(bloodRequests.map((r) => [r.id, r]));
    const expectedDonors = conversations.map((c) => {
      const verif = verifMap.get(`${c.request_id}_${c.donor_id}`);
      const req = reqMap.get(c.request_id);
      return {
        id: c.id,
        request_id: c.request_id,
        donor_id: c.donor_id,
        donor: c.donor,
        request: req,
        accepted_at: c.created_at,
        arrival_status: verif?.arrival_status || "pending",
        arrived_at: verif?.arrived_at || null,
        outcome_status: verif?.outcome_status || null,
        deferral_reason: verif?.deferral_reason || null,
        verified_at: verif?.verified_at || null,
        verification_id: verif?.id || null,
      };
    });

    const metrics = computeDashboardMetrics(bloodRequests, conversations, verifications);

    return {
      bloodRequests,
      expectedDonors,
      verifications,
      metrics,
    };
  } catch (err) {
    console.error("fetchHospitalData error:", err);
    return {
      bloodRequests: [],
      expectedDonors: [],
      verifications: [],
      metrics: computeDashboardMetrics([], [], []),
    };
  }
}

/**
 * TASK 4: Confirm Donor Arrival
 */
export async function confirmDonorArrival(requestId, donorId) {
  if (!requestId || !donorId) {
    throw new Error("Request ID and Donor ID are required to confirm arrival");
  }

  // 1. Try atomic database RPC first
  try {
    const { data, error } = await supabase.rpc("confirm_donor_arrival", {
      p_request_id: requestId,
      p_donor_id: donorId,
    });

    if (!error && data) return data;
    if (error && !error.message.includes("function") && !error.message.includes("not found")) {
      throw new Error(error.message);
    }
  } catch (rpcErr) {
    if (!rpcErr.message.includes("not found") && !rpcErr.message.includes("function")) {
      throw rpcErr;
    }
  }

  // 2. Direct table update
  const { data: existing } = await supabase
    .from("donor_verifications")
    .select("*")
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .maybeSingle();

  if (existing?.arrival_status === "arrived") return existing;
  if (existing?.outcome_status === "NO_SHOW" || existing?.outcome_status === "CANCELLED") {
    throw new Error(`Cannot confirm arrival for a donor marked ${existing.outcome_status}`);
  }

  const now = new Date().toISOString();
  const upsertPayload = {
    request_id: requestId,
    donor_id: donorId,
    arrival_status: "arrived",
    arrived_at: existing?.arrived_at || now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("donor_verifications")
    .upsert(upsertPayload, { onConflict: "request_id,donor_id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to confirm donor arrival: ${error.message}`);
  return data;
}

/**
 * TASK 5: Donation Outcome Verification
 */
export async function verifyDonationOutcome(requestId, donorId, outcome, deferralReason = null) {
  const VALID_OUTCOMES = ["DONATED", "MEDICALLY_DEFERRED", "NO_SHOW", "CANCELLED"];
  if (!VALID_OUTCOMES.includes(outcome)) {
    throw new Error(`Invalid outcome: ${outcome}. Allowed: ${VALID_OUTCOMES.join(", ")}`);
  }

  // 1. Try atomic database RPC first
  try {
    const { data, error } = await supabase.rpc("verify_donation_outcome", {
      p_request_id: requestId,
      p_donor_id: donorId,
      p_outcome: outcome,
      p_reason: deferralReason,
    });

    if (!error && data) return data;
    if (error && !error.message.includes("function") && !error.message.includes("not found")) {
      throw new Error(error.message);
    }
  } catch (rpcErr) {
    if (!rpcErr.message.includes("not found") && !rpcErr.message.includes("function")) {
      throw rpcErr;
    }
  }

  // 2. Direct table update with validation
  const { data: existing } = await supabase
    .from("donor_verifications")
    .select("*")
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .maybeSingle();

  if (outcome === "NO_SHOW" && (existing?.arrival_status === "arrived" || existing?.outcome_status === "DONATED")) {
    throw new Error("Cannot mark donor as no-show after confirmed arrival or donation");
  }

  if (existing?.outcome_status === "DONATED" && (outcome === "NO_SHOW" || outcome === "CANCELLED")) {
    throw new Error(`Cannot alter outcome to ${outcome} once donation has been completed`);
  }

  const now = new Date().toISOString();
  const upsertPayload = {
    request_id: requestId,
    donor_id: donorId,
    outcome_status: outcome,
    deferral_reason: outcome === "MEDICALLY_DEFERRED" ? deferralReason : null,
    verified_at: now,
    updated_at: now,
    arrival_status: outcome === "DONATED" ? "arrived" : existing?.arrival_status || "pending",
    arrived_at: outcome === "DONATED" && !existing?.arrived_at ? now : existing?.arrived_at,
  };

  const { data, error } = await supabase
    .from("donor_verifications")
    .upsert(upsertPayload, { onConflict: "request_id,donor_id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to verify donation outcome: ${error.message}`);
  return data;
}

/**
 * TASK 7: Close Blood Request
 */
export async function closeBloodRequest(requestId, closureReason = null) {
  if (!requestId) {
    throw new Error("Request ID is required to close a blood request");
  }

  // 1. Try atomic database RPC first
  try {
    const { data, error } = await supabase.rpc("close_blood_request", {
      p_request_id: requestId,
      p_closure_reason: closureReason,
    });

    if (!error && data) return data;
    if (error && !error.message.includes("function") && !error.message.includes("not found")) {
      throw new Error(error.message);
    }
  } catch (rpcErr) {
    if (!rpcErr.message.includes("not found") && !rpcErr.message.includes("function")) {
      throw rpcErr;
    }
  }

  // 2. Direct table update
  const { data: request, error: reqError } = await supabase
    .from("blood_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    throw new Error(`Blood request not found: ${reqError?.message}`);
  }

  if (request.status === "fulfilled" || request.status === "cancelled") {
    throw new Error(`Request is already closed with status ${request.status}`);
  }

  const { data: verifs } = await supabase
    .from("donor_verifications")
    .select("*")
    .eq("request_id", requestId)
    .eq("outcome_status", "DONATED");

  const verifiedCount = (verifs || []).length;
  let newStatus = "fulfilled";

  if (verifiedCount >= request.units) {
    newStatus = "fulfilled";
  } else {
    if (!closureReason || closureReason.trim().length < 3) {
      throw new Error(
        `A valid closure reason is required when closing an unfulfilled request (Verified: ${verifiedCount} of ${request.units} units required)`
      );
    }
    newStatus = "cancelled";
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("blood_requests")
    .update({
      status: newStatus,
      closed_at: now,
      closure_reason: closureReason || "All required units fulfilled by verified donations",
    })
    .eq("id", requestId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to close blood request: ${updateError.message}`);
  return updated;
}
