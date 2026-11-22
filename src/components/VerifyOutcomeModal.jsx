import { useState } from "react";

const bg = (g) => (g || "?").replace("-", "\u2212");

const DEFERRAL_REASONS = [
  "Hemoglobin level below threshold",
  "Blood pressure out of acceptable range",
  "Recent medication or vaccination",
  "Recent illness, fever or infection",
  "Recent travel or surgical procedure",
  "Vein access difficulty",
  "Donor weight or vitals below criteria",
  "Other medical evaluation",
];

export default function VerifyOutcomeModal({
  donorItem,
  isOpen,
  onClose,
  onVerify,
}) {
  const [selectedOutcome, setSelectedOutcome] = useState(donorItem?.outcome_status || "DONATED");
  const [deferralCategory, setDeferralCategory] = useState(donorItem?.deferral_reason || DEFERRAL_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !donorItem) return null;

  const hasArrived = donorItem.arrival_status === "arrived";
  const wasDonated = donorItem.outcome_status === "DONATED";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side guard for NO_SHOW
    if (selectedOutcome === "NO_SHOW" && (hasArrived || wasDonated)) {
      setError("Cannot mark donor as no-show after confirmed arrival or donation.");
      return;
    }

    // Client-side guard for modifying completed donation
    if (wasDonated && (selectedOutcome === "NO_SHOW" || selectedOutcome === "CANCELLED")) {
      setError(`Cannot change outcome to ${selectedOutcome} once donation has been completed.`);
      return;
    }

    try {
      setSubmitting(true);
      const reason = selectedOutcome === "MEDICALLY_DEFERRED" ? deferralCategory : null;
      await onVerify(donorItem.request_id, donorItem.donor_id, selectedOutcome, reason);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record donation verification outcome.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 27, 51, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 9999,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-verify-title"
    >
      <div
        style={{
          background: "var(--sf)",
          borderRadius: "20px",
          border: "1px solid var(--ln)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          maxWidth: "520px",
          width: "100%",
          padding: "24px",
          color: "var(--tx)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="rd-drop sm">{bg(donorItem.donor?.blood_group || "?")}</span>
          <div>
            <h3 id="modal-verify-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
              Verify Donation Outcome
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--mu)" }}>
              Official Hospital Blood Verification Record
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "#fee2e2",
              border: "1px solid var(--red)",
              color: "var(--red)",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Donor & Request Summary */}
        <div
          style={{
            background: "var(--bg)",
            borderRadius: "14px",
            padding: "14px",
            border: "1px solid var(--ln)",
            fontSize: "13px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <div>
            <span style={{ color: "var(--mu)", fontSize: "11px", display: "block" }}>DONOR</span>
            <strong>{donorItem.donor?.full_name || "Anonymous Donor"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--mu)", fontSize: "11px", display: "block" }}>BLOOD GROUP</span>
            <strong>{bg(donorItem.donor?.blood_group || "Unknown")}</strong>
          </div>
          <div>
            <span style={{ color: "var(--mu)", fontSize: "11px", display: "block" }}>REQUEST ID</span>
            <code>{donorItem.request_id.slice(0, 10)}...</code>
          </div>
          <div>
            <span style={{ color: "var(--mu)", fontSize: "11px", display: "block" }}>ARRIVAL STATUS</span>
            <strong style={{ color: hasArrived ? "var(--ok)" : "var(--mu)" }}>
              {hasArrived ? "✓ Arrived at Hospital" : "Pending Arrival"}
            </strong>
          </div>
        </div>

        {/* Four Outcome Options */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--mu)" }}>
            SELECT FINAL OUTCOME:
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* 1. DONATED */}
            <button
              type="button"
              onClick={() => setSelectedOutcome("DONATED")}
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: selectedOutcome === "DONATED" ? "2px solid var(--ok)" : "1px solid var(--ln)",
                background: selectedOutcome === "DONATED" ? "#e4f6ee" : "var(--bg)",
                color: selectedOutcome === "DONATED" ? "#065f46" : "var(--tx)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🩸</span>
                <span>DONATED</span>
              </div>
              <small style={{ display: "block", color: "var(--mu)", fontWeight: 400, marginTop: "2px", fontSize: "11px" }}>
                Blood successfully collected
              </small>
            </button>

            {/* 2. MEDICALLY DEFERRED */}
            <button
              type="button"
              onClick={() => setSelectedOutcome("MEDICALLY_DEFERRED")}
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: selectedOutcome === "MEDICALLY_DEFERRED" ? "2px solid #f59e0b" : "1px solid var(--ln)",
                background: selectedOutcome === "MEDICALLY_DEFERRED" ? "#fef3c7" : "var(--bg)",
                color: selectedOutcome === "MEDICALLY_DEFERRED" ? "#92400e" : "var(--tx)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🩺</span>
                <span>DEFERRED</span>
              </div>
              <small style={{ display: "block", color: "var(--mu)", fontWeight: 400, marginTop: "2px", fontSize: "11px" }}>
                Temporary medical deferral
              </small>
            </button>

            {/* 3. NO SHOW */}
            <button
              type="button"
              disabled={hasArrived || wasDonated}
              onClick={() => setSelectedOutcome("NO_SHOW")}
              title={
                hasArrived || wasDonated
                  ? "Cannot mark as No-Show after confirmed arrival or donation"
                  : "Donor did not arrive"
              }
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: selectedOutcome === "NO_SHOW" ? "2px solid #6b7280" : "1px solid var(--ln)",
                background: selectedOutcome === "NO_SHOW" ? "#f3f4f6" : "var(--bg)",
                color: selectedOutcome === "NO_SHOW" ? "#374151" : "var(--tx)",
                cursor: (hasArrived || wasDonated) ? "not-allowed" : "pointer",
                opacity: (hasArrived || wasDonated) ? 0.45 : 1,
                textAlign: "left",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⏱️</span>
                <span>NO-SHOW</span>
              </div>
              <small style={{ display: "block", color: "var(--mu)", fontWeight: 400, marginTop: "2px", fontSize: "11px" }}>
                {hasArrived ? "Disabled (Already arrived)" : "Donor did not attend"}
              </small>
            </button>

            {/* 4. CANCELLED */}
            <button
              type="button"
              disabled={wasDonated}
              onClick={() => setSelectedOutcome("CANCELLED")}
              title={wasDonated ? "Cannot cancel an already completed donation" : "Commitment cancelled"}
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: selectedOutcome === "CANCELLED" ? "2px solid var(--red)" : "1px solid var(--ln)",
                background: selectedOutcome === "CANCELLED" ? "#fee2e2" : "var(--bg)",
                color: selectedOutcome === "CANCELLED" ? "var(--red)" : "var(--tx)",
                cursor: wasDonated ? "not-allowed" : "pointer",
                opacity: wasDonated ? 0.45 : 1,
                textAlign: "left",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>✕</span>
                <span>CANCELLED</span>
              </div>
              <small style={{ display: "block", color: "var(--mu)", fontWeight: 400, marginTop: "2px", fontSize: "11px" }}>
                Commitment cancelled
              </small>
            </button>
          </div>

          {/* Deferral Category Selection when MEDICALLY_DEFERRED is selected */}
          {selectedOutcome === "MEDICALLY_DEFERRED" && (
            <div
              style={{
                background: "var(--bg)",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid var(--ln)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>
                DEFERRAL REASON CATEGORY:
              </label>
              <select
                value={deferralCategory}
                onChange={(e) => setDeferralCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--ln)",
                  background: "var(--sf)",
                  color: "var(--tx)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {DEFERRAL_REASONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <small style={{ color: "var(--mu)", fontSize: "11px", lineHeight: "1.3" }}>
                🔒 <strong>Privacy Notice:</strong> Medical deferral details are confidential clinical records and will not be displayed as an unverified donor penalty.
              </small>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              className="rd-btn sm"
              onClick={onClose}
              disabled={submitting}
              style={{
                background: "transparent !important",
                border: "1px solid var(--ln)",
                color: "var(--tx) !important",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rd-btn sm"
              disabled={submitting}
            >
              {submitting ? "Saving Outcome..." : "✓ Save Outcome"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
