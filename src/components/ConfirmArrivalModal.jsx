import { useState } from "react";

const bg = (g) => (g || "?").replace("-", "\u2212");

/**
 * ConfirmArrivalModal Component
 * Prompts hospital staff to confirm donor arrival with full context:
 * - Donor name & blood group
 * - Associated blood request details
 * - Expected arrival time / timestamp
 * - Prevents duplicate clicks with loading state
 */
export default function ConfirmArrivalModal({
  donorItem,
  isOpen,
  onClose,
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !donorItem) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError("");
      await onConfirm(donorItem.request_id, donorItem.donor_id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to confirm arrival");
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
      aria-labelledby="modal-arrival-title"
    >
      <div
        style={{
          background: "var(--sf)",
          borderRadius: "20px",
          border: "1px solid var(--ln)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          maxWidth: "480px",
          width: "100%",
          padding: "24px",
          color: "var(--tx)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="rd-drop sm">{bg(donorItem.donor?.blood_group || "?")}</span>
          <div>
            <h3 id="modal-arrival-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
              Confirm Donor Arrival
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--mu)" }}>
              Hospital Reception & Verification Check-In
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

        <div
          style={{
            background: "var(--bg)",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid var(--ln)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Donor Name:</span>
            <strong>{donorItem.donor?.full_name || "Anonymous Donor"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Donor Blood Group:</span>
            <strong>{bg(donorItem.donor?.blood_group || "Unknown")}</strong>
          </div>
          {donorItem.donor?.phone && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--mu)" }}>Contact Phone:</span>
              <strong>{donorItem.donor.phone}</strong>
            </div>
          )}
          <hr style={{ border: 0, borderTop: "1px solid var(--ln)", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Blood Request ID:</span>
            <code>{donorItem.request_id.slice(0, 10)}...</code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Hospital Destination:</span>
            <strong>{donorItem.request?.hospital || "Hospital"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Required Blood:</span>
            <strong>{bg(donorItem.request?.blood_group)} ({donorItem.request?.units} units)</strong>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: "12px", color: "var(--mu)", lineHeight: "1.4" }}>
          Confirming arrival verifies that the donor has reported to the hospital blood collection counter.
          The arrival timestamp will be recorded permanently in the verification history.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          <button
            className="rd-btn sm"
            type="button"
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
            className="rd-btn sm"
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{ background: "var(--ok) !important" }}
          >
            {submitting ? "Confirming..." : "✓ Confirm Arrival"}
          </button>
        </div>
      </div>
    </div>
  );
}
