import { useState, useMemo } from "react";
import { calculateRemainingRequirement } from "../services/hospitalService.js";
import ExpectedDonorsList from "./ExpectedDonorsList.jsx";

const bg = (g) => (g || "?").replace("-", "\u2212");

export default function HospitalDashboard({
  hospitalName,
  userProfile,
  data,
  loading,
  error,
  onRefresh,
  onSignOut,
  onConfirmArrival,
  onOpenVerifyModal,
  onOpenCloseModal,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "donors"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const metrics = data?.metrics || {
    totalActiveRequests: 0,
    totalFulfilledRequests: 0,
    totalExpectedDonors: 0,
    donorsArrived: 0,
    successfulDonations: 0,
    medicallyDeferred: 0,
    noShowDonors: 0,
    cancelledDonors: 0,
    totalRemainingRequirements: 0,
  };

  const bloodRequests = useMemo(() => data?.bloodRequests || [], [data?.bloodRequests]);
  const expectedDonors = useMemo(() => data?.expectedDonors || [], [data?.expectedDonors]);

  // Filtered Blood Requests
  const filteredRequests = useMemo(() => {
    return bloodRequests.filter((req) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        req.id.toLowerCase().includes(q) ||
        (req.hospital || "").toLowerCase().includes(q) ||
        (req.blood_group || "").toLowerCase().includes(q) ||
        (req.requester?.full_name || "").toLowerCase().includes(q);

      const matchBg = selectedBloodGroup === "ALL" || req.blood_group === selectedBloodGroup;
      const matchStatus = statusFilter === "ALL" || req.status === statusFilter;

      return matchSearch && matchBg && matchStatus;
    });
  }, [bloodRequests, searchQuery, selectedBloodGroup, statusFilter]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Top Navigation Bar adhering to BloodBridge theme */}
      <header className="rd-head" style={{ borderRadius: "0 0 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div className="rd-brand" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="rd-drop sm" />
            <div>
              <span style={{ fontSize: "18px", fontWeight: 800 }}>BloodBridge</span>
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "12px",
                  background: "var(--navy2)",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  color: "#ffe3e0",
                  fontWeight: 600,
                }}
              >
                Hospital & Verification Module
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ textAlign: "right", color: "#fff", fontSize: "13px" }}>
              <div style={{ fontWeight: 700 }}>{hospitalName || "General Hospital"}</div>
              <div style={{ color: "#b9c3dc", fontSize: "12px" }}>
                {userProfile?.full_name || "Authorized Staff"}
              </div>
            </div>

            <button
              className="rd-btn sm"
              onClick={onRefresh}
              title="Refresh Data"
              style={{ background: "var(--navy2) !important", border: "1px solid #2d406b" }}
            >
              ↻ Refresh
            </button>

            <button className="rd-link" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              border: 0,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              background: activeTab === "overview" ? "var(--grad)" : "var(--navy2)",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
          >
            Dashboard Overview
          </button>
          <button
            onClick={() => setActiveTab("donors")}
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              border: 0,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              background: activeTab === "donors" ? "var(--grad)" : "var(--navy2)",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
          >
            Expected Donors ({expectedDonors.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "20px max(16px, 4%)", maxWidth: "1280px", width: "100%", margin: "0 auto" }}>
        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "#ffebee",
              border: "1px solid var(--red)",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "20px",
              color: "var(--red)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Error loading data:</strong> {error}
            </div>
            <button className="rd-btn sm" onClick={onRefresh} style={{ marginLeft: "12px" }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <span className="rd-drop big" style={{ animation: "pulse 1.2s infinite ease-in-out" }} />
            <p style={{ marginTop: "16px", color: "var(--mu)", fontWeight: 600 }}>
              Loading database records...
            </p>
          </div>
        )}

        {!loading && (
          <>
            {/* KPI Metrics Cards */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              {/* Active Requests */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--mu)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Active Requests
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--tx)", marginTop: "4px" }}>
                  {metrics.totalActiveRequests}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Currently open in hospital</small>
              </div>

              {/* Remaining Requirement */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--coral)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
                  Remaining Donors
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)", marginTop: "4px" }}>
                  {metrics.totalRemainingRequirements}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Units needed to fulfill</small>
              </div>

              {/* Expected Donors */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--mu)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Expected Donors
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--tx)", marginTop: "4px" }}>
                  {metrics.totalExpectedDonors}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Donors accepted requests</small>
              </div>

              {/* Arrived Donors */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--ok)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Arrived Donors
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--ok)", marginTop: "4px" }}>
                  {metrics.donorsArrived}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Confirmed at hospital</small>
              </div>

              {/* Successful Donations */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--ok)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
                  Donated
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--ok)", marginTop: "4px" }}>
                  {metrics.successfulDonations}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Verified blood units</small>
              </div>

              {/* Medically Deferred */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "#f59e0b", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Medically Deferred
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>
                  {metrics.medicallyDeferred}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Temporary/medical deferrals</small>
              </div>

              {/* No-Shows */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--mu)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  No-Show
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--mu)", marginTop: "4px" }}>
                  {metrics.noShowDonors}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Did not arrive</small>
              </div>

              {/* Cancelled */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--mu)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Cancelled
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--mu)", marginTop: "4px" }}>
                  {metrics.cancelledDonors}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Cancelled commitments</small>
              </div>

              {/* Fulfilled Requests */}
              <div
                style={{
                  background: "var(--sf)",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid var(--ln)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ color: "var(--ok)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>
                  Fulfilled Requests
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--ok)", marginTop: "4px" }}>
                  {metrics.totalFulfilledRequests}
                </div>
                <small style={{ color: "var(--mu)", fontSize: "12px" }}>Completed requests</small>
              </div>
            </section>

            {/* Search and Filters Bar for Requests */}
            {activeTab === "overview" && (
            <div
              style={{
                background: "var(--sf)",
                padding: "14px 18px",
                borderRadius: "14px",
                border: "1px solid var(--ln)",
                marginBottom: "20px",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
                <input
                  type="text"
                  placeholder="Search by ID, donor name, hospital..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: "999px",
                    border: "1px solid var(--ln)",
                    padding: "10px 16px",
                    background: "var(--bg)",
                    color: "var(--tx)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Blood Group Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--mu)" }}>Blood:</label>
                <select
                  value={selectedBloodGroup}
                  onChange={(e) => setSelectedBloodGroup(e.target.value)}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid var(--ln)",
                    padding: "8px 12px",
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

              {/* Status Filter for Overview */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--mu)" }}>Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      borderRadius: "999px",
                      border: "1px solid var(--ln)",
                      padding: "8px 12px",
                      background: "var(--bg)",
                      color: "var(--tx)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              {(searchQuery || selectedBloodGroup !== "ALL" || statusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedBloodGroup("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="rd-link"
                  style={{ fontSize: "12px", cursor: "pointer", marginLeft: "auto" }}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

            {/* TAB 1: OVERVIEW & BLOOD REQUESTS */}
            {activeTab === "overview" && (
              <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--tx)" }}>
                    Hospital Blood Requests ({filteredRequests.length})
                  </h2>
                </div>

                {filteredRequests.length === 0 ? (
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
                    <h3 style={{ margin: "14px 0 6px 0", color: "var(--tx)" }}>No blood requests found</h3>
                    <p style={{ margin: 0, color: "var(--mu)", fontSize: "14px" }}>
                      There are no blood requests matching your search or filter criteria.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {filteredRequests.map((req) => {
                      // Compute verified donations and remaining requirement for this request
                      const reqVerifs = (data?.verifications || []).filter((v) => v.request_id === req.id);
                      const verifiedCount = reqVerifs.filter((v) => v.outcome_status === "DONATED").length;
                      const remaining = calculateRemainingRequirement(req.units, verifiedCount);

                      return (
                        <div
                          key={req.id}
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
                          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "260px" }}>
                            <span className="rd-drop sm">{bg(req.blood_group)}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--tx)" }}>
                                {req.units} {req.units === 1 ? "unit" : "units"} of {bg(req.blood_group)}
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--mu)", marginTop: "2px" }}>
                                <span>Hospital: <strong>{req.hospital}</strong></span>
                                {req.requester?.full_name && <span> • Requester: {req.requester.full_name}</span>}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--mu)", marginTop: "2px" }}>
                                Request ID: <code style={{ fontSize: "11px" }}>{req.id.slice(0, 8)}...</code>
                                {req.needed_by && (
                                  <span> • Needed by: {new Date(req.needed_by).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remaining requirement & status */}
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "12px", color: "var(--mu)", fontWeight: 600 }}>
                                Verified Donations
                              </div>
                              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--tx)" }}>
                                {verifiedCount} / {req.units} units
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: remaining > 0 ? "var(--red)" : "var(--ok)",
                                }}
                              >
                                Remaining: {remaining} {remaining === 1 ? "unit" : "units"}
                              </div>
                            </div>

                            <span
                              className={`rd-pill ${req.status === "open" ? "" : "x"}`}
                              style={{
                                background: req.status === "open" ? "#e4f6ee" : req.status === "fulfilled" ? "#d1fae5" : "var(--ln)",
                                color: req.status === "open" ? "var(--ok)" : req.status === "fulfilled" ? "#065f46" : "var(--mu)",
                                textTransform: "capitalize",
                              }}
                            >
                              {req.status}
                            </span>

                            {/* Action to Close Blood Request (Task 7) */}
                            {req.status === "open" && onOpenCloseModal && (
                              <button
                                className="rd-btn sm"
                                onClick={() => onOpenCloseModal(req, remaining, verifiedCount)}
                                style={{
                                  background: remaining === 0 ? "var(--ok) !important" : "var(--navy2) !important",
                                }}
                              >
                                {remaining === 0 ? "Close Fulfilled Request" : "Close Request"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: EXPECTED DONORS LIST */}
            {activeTab === "donors" && (
              <ExpectedDonorsList
                donors={expectedDonors}
                onConfirmArrival={onConfirmArrival}
                onOpenVerifyModal={onOpenVerifyModal}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
