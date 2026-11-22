import { useState, useMemo } from "react";

const bg = (g) => (g || "?").replace("-", "\u2212");

/**
 * ExpectedDonorsList Component
 * Displays donors associated with the authenticated hospital's blood requests.
 * Provides granular search by donor name and filters by blood group, request ID,
 * date, arrival status, and verification outcome status.
 * Ensures no duplicate entries and no unrelated donor exposure.
 */
export default function ExpectedDonorsList({
  donors = [],
  onConfirmArrival,
  onOpenVerifyModal,
}) {
  const [searchName, setSearchName] = useState("");
  const [filterBloodGroup, setFilterBloodGroup] = useState("ALL");
  const [filterRequestId, setFilterRequestId] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  const [filterArrival, setFilterArrival] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Extract unique request IDs for the dropdown
  const uniqueRequestIds = useMemo(() => {
    const ids = new Set();
    donors.forEach((d) => {
      if (d.request_id) ids.add(d.request_id);
    });
    return Array.from(ids);
  }, [donors]);

  // Filter expected donors
  const filteredDonors = useMemo(() => {
    return donors.filter((item) => {
      // 1. Search by donor name
      if (searchName.trim()) {
        const name = (item.donor?.full_name || "").toLowerCase();
        if (!name.includes(searchName.toLowerCase().trim())) {
          return false;
        }
      }

      // 2. Filter by blood group
      if (filterBloodGroup !== "ALL") {
        const donorBg = item.donor?.blood_group;
        const reqBg = item.request?.blood_group;
        if (donorBg !== filterBloodGroup && reqBg !== filterBloodGroup) {
          return false;
        }
      }

      // 3. Filter by request ID
      if (filterRequestId !== "ALL" && item.request_id !== filterRequestId) {
        return false;
      }

      // 4. Filter by date (matches accepted_at or needed_by date string YYYY-MM-DD)
      if (filterDate) {
        const acceptedDateStr = item.accepted_at ? new Date(item.accepted_at).toISOString().split("T")[0] : "";
        const neededDateStr = item.request?.needed_by ? new Date(item.request.needed_by).toISOString().split("T")[0] : "";
        if (acceptedDateStr !== filterDate && neededDateStr !== filterDate) {
          return false;
        }
      }

      // 5. Filter by arrival status
      if (filterArrival !== "ALL") {
        if (filterArrival === "arrived" && item.arrival_status !== "arrived") return false;
        if (filterArrival === "pending" && item.arrival_status === "arrived") return false;
      }

      // 6. Filter by donor verification status
      if (filterStatus !== "ALL") {
        if (filterStatus === "UNVERIFIED" && item.outcome_status) return false;
        if (filterStatus !== "UNVERIFIED" && item.outcome_status !== filterStatus) return false;
      }

      return true;
    });
  }, [donors, searchName, filterBloodGroup, filterRequestId, filterDate, filterArrival, filterStatus]);

  const hasActiveFilters = Boolean(
    searchName ||
    filterBloodGroup !== "ALL" ||
    filterRequestId !== "ALL" ||
    filterDate ||
    filterArrival !== "ALL" ||
    filterStatus !== "ALL"
  );

  const resetFilters = () => {
    setSearchName("");
    setFilterBloodGroup("ALL");
    setFilterRequestId("ALL");
    setFilterDate("");
    setFilterArrival("ALL");
    setFilterStatus("ALL");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filtering Toolbar */}
      <div
        style={{
          background: "var(--sf)",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "1px solid var(--ln)",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {/* Donor Name Search */}
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            SEARCH BY DONOR NAME
          </label>
          <input
            type="text"
            placeholder="Type donor name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              width: "100%",
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "8px 14px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Blood Group Filter */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            BLOOD GROUP
          </label>
          <select
            value={filterBloodGroup}
            onChange={(e) => setFilterBloodGroup(e.target.value)}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "8px 14px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Groups</option>
            <option value="A+">A+</option>
            <option value="A-">A−</option>
            <option value="B+">B+</option>
            <option value="B-">B−</option>
            <option value="O+">O+</option>
            <option value="O-">O−</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB−</option>
          </select>
        </div>

        {/* Request ID Filter */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            REQUEST ID
          </label>
          <select
            value={filterRequestId}
            onChange={(e) => setFilterRequestId(e.target.value)}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "8px 14px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              cursor: "pointer",
              maxWidth: "180px",
            }}
          >
            <option value="ALL">All Requests</option>
            {uniqueRequestIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}...
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            FILTER BY DATE
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "7px 12px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          />
        </div>

        {/* Arrival Status Filter */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            ARRIVAL STATUS
          </label>
          <select
            value={filterArrival}
            onChange={(e) => setFilterArrival(e.target.value)}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "8px 14px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Arrival</option>
            <option value="arrived">Arrived</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Outcome Status Filter */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--mu)", marginBottom: "4px" }}>
            VERIFICATION OUTCOME
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              borderRadius: "999px",
              border: "1px solid var(--ln)",
              padding: "8px 14px",
              background: "var(--bg)",
              color: "var(--tx)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Outcomes</option>
            <option value="UNVERIFIED">Unverified Only</option>
            <option value="DONATED">Donated</option>
            <option value="MEDICALLY_DEFERRED">Medically Deferred</option>
            <option value="NO_SHOW">No-Show</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <button className="rd-link" onClick={resetFilters} style={{ fontSize: "12px", padding: "6px 0" }}>
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Donors List or Empty State */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--tx)", margin: 0 }}>
          Expected Donors ({filteredDonors.length} of {donors.length})
        </h3>
      </div>

      {filteredDonors.length === 0 ? (
        <div
          style={{
            background: "var(--sf)",
            borderRadius: "14px",
            padding: "40px 20px",
            textAlign: "center",
            border: "1px solid var(--ln)",
          }}
        >
          <span className="rd-drop big" style={{ opacity: 0.3 }} />
          <h4 style={{ margin: "14px 0 6px 0", color: "var(--tx)", fontSize: "16px" }}>
            No expected donors match the current criteria
          </h4>
          <p style={{ margin: 0, color: "var(--mu)", fontSize: "13px" }}>
            Try clearing or adjusting your search keywords, blood group, or status filters.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredDonors.map((item) => {
            const hasArrived = item.arrival_status === "arrived";
            const outcome = item.outcome_status;
            const key = `${item.request_id}_${item.donor_id}`;

            return (
              <div
                key={key}
                className="rd-req"
                style={{
                  margin: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                {/* Donor Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "280px" }}>
                  <span className="rd-drop sm">{bg(item.donor?.blood_group || item.request?.blood_group)}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--tx)" }}>
                        {item.donor?.full_name || "Anonymous Donor"}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "#e0e7ff",
                          color: "#3730a3",
                        }}
                      >
                        Accepted
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--mu)", marginTop: "3px" }}>
                      <span>Donor Blood: <strong>{bg(item.donor?.blood_group || "Unknown")}</strong></span>
                      <span> • Needed: <strong>{bg(item.request?.blood_group || "Unknown")}</strong></span>
                      {item.donor?.phone && <span> • Contact: {item.donor.phone}</span>}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--mu)", marginTop: "2px" }}>
                      Request: <code style={{ fontSize: "11px" }}>{item.request_id.slice(0, 8)}...</code>
                      {item.request?.hospital && <span> • Hospital: {item.request.hospital}</span>}
                      {item.request?.needed_by && (
                        <span> • Needed By: {new Date(item.request.needed_by).toLocaleDateString()}</span>
                      )}
                      {item.accepted_at && (
                        <span> • Accepted on: {new Date(item.accepted_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badges & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {/* Arrival Badge */}
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: hasArrived ? "#d1fae5" : "#fee2e2",
                        color: hasArrived ? "#065f46" : "#991b1b",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: hasArrived ? "#10b981" : "#ef4444",
                        }}
                      />
                      {hasArrived ? "Arrived" : "Arrival Pending"}
                    </span>
                    {hasArrived && item.arrived_at && (
                      <div style={{ fontSize: "11px", color: "var(--mu)", marginTop: "2px" }}>
                        At: {new Date(item.arrived_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>

                  {/* Outcome Badge */}
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background:
                          outcome === "DONATED"
                            ? "#d1fae5"
                            : outcome === "MEDICALLY_DEFERRED"
                            ? "#fef3c7"
                            : outcome === "NO_SHOW"
                            ? "#f3f4f6"
                            : outcome === "CANCELLED"
                            ? "#fee2e2"
                            : "var(--bg)",
                        color:
                          outcome === "DONATED"
                            ? "#065f46"
                            : outcome === "MEDICALLY_DEFERRED"
                            ? "#92400e"
                            : outcome === "NO_SHOW"
                            ? "#4b5563"
                            : outcome === "CANCELLED"
                            ? "#991b1b"
                            : "var(--mu)",
                        border: outcome ? "none" : "1px solid var(--ln)",
                      }}
                    >
                      {outcome === "MEDICALLY_DEFERRED"
                        ? "Medically Deferred"
                        : outcome === "NO_SHOW"
                        ? "No-Show"
                        : outcome || "Unverified"}
                    </span>
                    {outcome && item.verified_at && (
                      <div style={{ fontSize: "11px", color: "var(--mu)", marginTop: "2px" }}>
                        Verified: {new Date(item.verified_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>

                  {/* Confirm Arrival Button (Task 4) */}
                  {!hasArrived && onConfirmArrival && (
                    <button
                      className="rd-btn sm"
                      onClick={() => onConfirmArrival(item.request_id, item.donor_id)}
                      style={{ background: "var(--navy2) !important", border: "1px solid #2d406b" }}
                    >
                      Confirm Arrival
                    </button>
                  )}

                  {/* Verify Outcome Button (Task 5) */}
                  {onOpenVerifyModal && (
                    <button
                      className="rd-btn sm"
                      onClick={() => onOpenVerifyModal(item)}
                    >
                      {outcome ? "Edit Outcome" : "Verify Outcome"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
