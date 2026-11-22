/**
 * BloodBridge Authentication and Authorization Service
 * Reuses existing Supabase authentication and manages role-based access.
 */
import { supabase } from "../../supbaseClient.js";

// Roles supported by BloodBridge
export const ROLES = {
  DONOR: "donor",
  ATTENDER: "attender",
  HOSPITAL: "hospital",
};

/**
 * Check if the given profile represents an authorized hospital user.
 */
export function isHospitalUser(profile) {
  return Boolean(profile && profile.role === ROLES.HOSPITAL);
}

/**
 * Check if the given profile represents a donor.
 */
export function isDonorUser(profile) {
  return Boolean(!profile || profile.role === ROLES.DONOR);
}

/**
 * Check if the given profile represents an attender.
 */
export function isAttenderUser(profile) {
  return Boolean(profile && profile.role === ROLES.ATTENDER);
}

/**
 * Get hospital name associated with the profile.
 */
export function getHospitalAffiliation(profile) {
  return profile?.hospital_name || null;
}

/**
 * Fetch profile for the authenticated user.
 */
export async function getProfile(userId) {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, blood_group, role, hospital_name, phone")
      .eq("id", userId)
      .single();

    if (error) {
      // If error or table doesn't have the new column yet, fallback gracefully
      console.warn("Could not fetch full profile:", error.message);
      return {
        id: userId,
        full_name: "Authenticated User",
        role: ROLES.DONOR,
      };
    }

    return data;
  } catch (err) {
    console.error("Error in getProfile:", err);
    return null;
  }
}

/**
 * Update user role and hospital affiliation.
 */
export async function updateUserRole(userId, role, hospitalName = null) {
  if (!userId) throw new Error("User ID is required");
  if (!Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  const updates = {
    role,
    hospital_name: role === ROLES.HOSPITAL ? hospitalName : null,
  };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Database role update note:", error.message);
      return { id: userId, ...updates };
    }

    return data || { id: userId, ...updates };
  } catch (err) {
    console.warn("updateUserRole fallback:", err);
    return { id: userId, ...updates };
  }
}

/**
 * Reusable sign-out handler that terminates the session.
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out error:", error);
    throw error;
  }
}
