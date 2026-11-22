import { useState } from "react";
import { isHospitalUser, ROLES } from "../services/authService";

/**
 * HospitalGuard component
 * Restricts access to authenticated users with role = 'hospital'.
 * If the signed-in user is a donor/attender, displays Access Denied notice
 * with an authorization action allowing the user to authorize as hospital staff.
 */
export default function HospitalGuard({
  session,
  profile,
  onSignOut,
  onAuthorizeHospital,
  onNavigateToUserChat,
  children,
}) {
  const [authorizing, setAuthorizing] = useState(false);
  const [hospitalNameInput, setHospitalNameInput] = useState("Manipal Hospital, Old Airport Rd");

  // 1. Check if user is authenticated
  if (!session) {
    return (
      <div className="rd-auth">
        <div className="rd-authbox">
          <span className="rd-drop big" />
          <h1>Hospital Portal</h1>
          <p>Please sign in to access the Hospital & Verification Module.</p>
          <button
            className="rd-btn"
            onClick={() => window.location.reload()}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // 2. Check authorization: User must have hospital role
  const isAuthorized = isHospitalUser(profile);

  if (!isAuthorized) {
    const currentRole = profile?.role || ROLES.DONOR;

    const handleAuthorize = async () => {
      if (!onAuthorizeHospital) return;
      try {
        setAuthorizing(true);
        await onAuthorizeHospital(hospitalNameInput || "General Hospital");
      } catch (err) {
        console.error("Authorization error:", err);
      } finally {
        setAuthorizing(false);
      }
    };

    return (
      <div className="rd-auth" style={{ minHeight: "100vh" }}>
        <div className="rd-authbox" style={{ maxWidth: "560px", textAlign: "center" }}>
          <span
            className="rd-drop big"
            style={{
              filter: "grayscale(100%)",
              opacity: 0.8,
            }}
          />
          <h1 style={{ fontSize: "32px", margin: "10px 0" }}>Hospital Access Restricted</h1>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "14px",
              padding: "16px 20px",
              width: "100%",
              textAlign: "left",
              color: "#fff",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ffe3e0" }}>
              <strong>Hospital Portal Authorization:</strong> Your Google account is currently assigned the <strong>{currentRole}</strong> role.
            </p>
            <p style={{ margin: "0 0 6px 0", fontSize: "13px" }}>
              <strong>Signed-in User:</strong> {profile?.full_name || session.user.email || "User"}
            </p>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px" }}>
              <strong>Account Role:</strong>{" "}
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#ff6b5e",
                  color: "#fff",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {currentRole}
              </span>
            </p>

            <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.2)", margin: "10px 0" }} />

            <label style={{ display: "block", fontSize: "12px", color: "#ffe3e0", marginBottom: "6px", fontWeight: 700 }}>
              SELECT OR ENTER YOUR HOSPITAL AFFILIATION:
            </label>
            <input
              type="text"
              value={hospitalNameInput}
              onChange={(e) => setHospitalNameInput(e.target.value)}
              placeholder="e.g. Manipal Hospital, Old Airport Rd or City Care Hospital"
              style={{
                width: "100%",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(0,0,0,0.25)",
                color: "#fff",
                fontSize: "13px",
                marginBottom: "10px",
                outline: "none",
              }}
            />

            <button
              className="rd-btn"
              disabled={authorizing}
              onClick={handleAuthorize}
              style={{
                background: "var(--ok) !important",
                width: "100%",
                fontSize: "14px",
                padding: "10px !important",
              }}
            >
              {authorizing ? "Authorizing Account..." : "✓ Authorize My Account as Hospital Staff"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "16px" }}>
            {onNavigateToUserChat && (
              <button
                className="rd-btn"
                style={{ background: "var(--navy2) !important", border: "1px solid rgba(255,255,255,0.3)" }}
                onClick={onNavigateToUserChat}
              >
                Return to Chat & Donor View
              </button>
            )}

            <button
              className="rd-btn sm"
              style={{ background: "transparent !important", border: "1px solid rgba(255,255,255,0.4)" }}
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. User is an authorized hospital staff member
  return <>{children}</>;
}
