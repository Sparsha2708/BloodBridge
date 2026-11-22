import { useState } from "react";

const bg = (g) => (g || "?").replace("-", "\u2212");

/**
 * CloseRequestModal Component
 * Prompts hospital staff for confirmation before closing a blood request.
 * Enforces business rules:
 * - Shows remaining donor requirement.
 * - If fulfilled (verified donations >= units), allows one-click fulfillment confirmation.
 * - If unfulfilled (verified donations < units), requires an explicit closure reason and marks cancelled/closed.
 * - Unfulfilled requests cannot be falsely marked fulfilled.
 */
export default function CloseRequestModal({
  requestItem,
  remaining,
  verifiedCount,
  isOpen,
  onClose,
  onCloseRequest,
}) {
  const [closureReason, setClosureReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !requestItem) return null;

  const isFulfilled = remaining === 0 || (verifiedCount >= requestItem.units);

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError("");

    if (!isFulfilled && (!closureReason || closureReason.trim().length < 3)) {
      setError("Please provide a valid reason for early closure of this unfulfilled request.");
      return;
    }

    try {
      setSubmitting(true);
      const reason = isFulfilled ? "All required units fulfilled by verified donations" : closureReason.trim();
      await onCloseRequest(requestItem.id, reason);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to close blood request");
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
      aria-labelledby="modal-close-title"
    >
      <div
        style={{
          background: "var(--sf)",
          borderRadius: "20px",
          border: "1px solid var(--ln)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          maxWidth: "500px",
          width: "100%",
          padding: "24px",
          color: "var(--tx)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="rd-drop sm">{bg(requestItem.blood_group)}</span>
          <div>
            <h3 id="modal-close-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
              {isFulfilled ? "Close Fulfilled Request" : "Close Unfulfilled Request"}
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--mu)" }}>
              Official Blood Request Status Finalization
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

        {/* Request Status Breakdown */}
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
            <span style={{ color: "var(--mu)" }}>Blood Request ID:</span>
            <code>{requestItem.id.slice(0, 10)}...</code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Hospital:</span>
            <strong>{requestItem.hospital}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Required Blood:</span>
            <strong>{requestItem.units} units of {bg(requestItem.blood_group)}</strong>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid var(--ln)", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Verified Donations:</span>
            <strong style={{ color: "var(--ok)" }}>{verifiedCount} units</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mu)" }}>Remaining Requirement:</span>
            <strong style={{ color: remaining > 0 ? "var(--red)" : "var(--ok)" }}>
              {remaining} units needed
            </strong>
          </div>
        </div>

        {isFulfilled ? (
          <div
            style={{
              background: "#e4f6ee",
              border: "1px solid var(--ok)",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#065f46",
              fontSize: "13px",
            }}
          >
            ✓ <strong>Requirement Fulfilled:</strong> All {requestItem.units} required units have been confirmed by verified hospital blood donations. Closing this request will mark it <em>Fulfilled</em> and archive open chats.
          </div>
        ) : (
          <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#92400e",
                fontSize: "13px",
              }}
            >
              ⚠️ <strong>Unfulfilled Request Notice:</strong> Only {verifiedCount} of {requestItem.units} required units have been verified ({remaining} units remaining). Closing early requires an official justification.
            </div>

            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--tx)", marginTop: "4px" }}>
              CLOSURE REASON (REQUIRED):
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g., Blood requirement fulfilled from central blood bank stock; patient transferred; or emergency expired."
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "1px solid var(--ln)",
                padding: "10px 14px",
                background: "var(--sf)",
                color: "var(--tx)",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </form>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
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
            type="button"
            className="rd-btn sm"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              background: isFulfilled ? "var(--ok) !important" : "var(--red) !important",
            }}
          >
            {submitting ? "Closing..." : isFulfilled ? "Confirm & Mark Fulfilled" : "Confirm Early Closure"}
          </button>
        </div>
      </div>
    </div>
  );
}
