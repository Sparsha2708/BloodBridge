import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supbaseClient";
import ChatApp from "./ChatApp";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const bgLabel = (g) => (g || "?").replace("-", "\u2212");

export default function UserPortal({ session, profile, onRefreshProfile, onSignOut }) {
  const me = session.user.id;
  const [view, setView] = useState("dashboard"); // 'dashboard' | 'create' | 'profile' | 'chats'
  const [dashTab, setDashTab] = useState("attender"); // 'attender' | 'donor'

  const [myRequests, setMyRequests] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [myResponses, setMyResponses] = useState({});
  const [availableDonors, setAvailableDonors] = useState([]);

  // Selected request for managing Add / Accept / Decline donors
  const [selectedReq, setSelectedReq] = useState(null);
  const [reqDonors, setReqDonors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");

  // Create Request form state
  const [reqForm, setReqForm] = useState({
    patient_name: "",
    blood_group: "O+",
    units: 1,
    hospital: "",
    hospital_area: "",
    needed_by: "",
    note: "",
  });

  // External Donor form state (WhatsApp / friends)
  const [extForm, setExtForm] = useState({
    external_name: "",
    external_phone: "",
    external_blood_group: "O+",
    source_note: "WhatsApp / Personal Contact",
  });

  // Donor Profile form state
  const [profForm, setProfForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    area: profile?.area || "",
    is_donor: profile?.is_donor ?? true,
    blood_group: profile?.blood_group || "O+",
    is_available: profile?.is_available ?? true,
  });

  useEffect(() => {
    if (profile) {
      setProfForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        area: profile.area || "",
        is_donor: profile.is_donor ?? false,
        blood_group: profile.blood_group || "O+",
        is_available: profile.is_available ?? true,
      });
    }
  }, [profile]);

  const loadAll = useCallback(async () => {
    // 1. Requests I created (Attender view)
    const { data: mine } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("requester_id", me)
      .order("created_at", { ascending: false });
    setMyRequests(mine || []);

    // 2. Open requests from others (Donor view)
    const { data: others } = await supabase
      .from("blood_requests")
      .select("*, requester:profiles!requester_id(full_name, phone)")
      .eq("status", "open")
      .neq("requester_id", me)
      .order("created_at", { ascending: false });
    setOpenRequests(others || []);

    // 3. My donor responses
    const { data: resp } = await supabase
      .from("request_donors")
      .select("*")
      .eq("donor_id", me);
    const map = {};
    (resp || []).forEach((r) => {
      map[r.request_id] = r;
    });
    setMyResponses(map);

    // 4. Registered available donors on platform
    const { data: donors } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "user")
      .eq("is_donor", true)
      .eq("is_available", true)
      .neq("id", me);
    setAvailableDonors(donors || []);
  }, [me]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadRequestDonors = async (reqObj) => {
    setSelectedReq(reqObj);
    setExtForm((p) => ({ ...p, external_blood_group: reqObj.blood_group }));
    const { data, error } = await supabase
      .from("request_donors")
      .select("*, donor:profiles!donor_id(full_name, phone, blood_group, area)")
      .eq("request_id", reqObj.id)
      .order("created_at", { ascending: false });

    if (error) {
      setBanner("Waiting for database update: " + error.message);
      setReqDonors([]);
    } else {
      setReqDonors(data || []);
    }
  };

  // Create a new blood request (Attender)
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    setBanner("");

    const { data, error } = await supabase
      .from("blood_requests")
      .insert({
        requester_id: me,
        patient_name: reqForm.patient_name,
        blood_group: reqForm.blood_group,
        units: Number(reqForm.units),
        hospital: reqForm.hospital,
        hospital_area: reqForm.hospital_area,
        needed_by: reqForm.needed_by ? new Date(reqForm.needed_by).toISOString() : null,
        note: reqForm.note,
      })
      .select()
      .single();

    setBusy(false);
    if (error) {
      setBanner("Could not create request: " + error.message);
      return;
    }

    setReqForm({
      patient_name: "",
      blood_group: "O+",
      units: 1,
      hospital: "",
      hospital_area: "",
      needed_by: "",
      note: "",
    });
    await loadAll();
    setView("dashboard");
    setDashTab("attender");
    if (data) loadRequestDonors(data);
  };

  // Donor clicks Accept or Decline on an open request
  const handleDonorDecision = async (requestId, decision) => {
    setBusy(true);
    setBanner("");
    const existing = myResponses[requestId];

    if (existing) {
      await supabase
        .from("request_donors")
        .update({ status: decision })
        .eq("id", existing.id);
    } else {
      const { error } = await supabase.from("request_donors").insert({
        request_id: requestId,
        donor_id: me,
        added_by: me,
        is_external: false,
        status: decision,
      });
      if (error) {
        setBanner("Error saving response: " + error.message);
        setBusy(false);
        return;
      }
    }

    // If accepted, also create the chat thread via teammate's accept_request RPC
    if (decision === "accepted") {
      await supabase.rpc("accept_request", { p_request_id: requestId });
      setBanner("Request accepted! You can now coordinate in Chats.");
    } else {
      setBanner("Request declined.");
    }

    await loadAll();
    setBusy(false);
  };

  // Attender adds a registered platform donor to their request
  const handleInvitePlatformDonor = async (donorId) => {
    if (!selectedReq) return;
    setBusy(true);
    const { error } = await supabase.from("request_donors").insert({
      request_id: selectedReq.id,
      donor_id: donorId,
      added_by: me,
      is_external: false,
      status: "invited",
    });
    if (error) setBanner(error.message);
    await loadRequestDonors(selectedReq);
    setBusy(false);
  };

  // Attender adds an external donor (WhatsApp / personal contact)
  const handleAddExternalDonor = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setBusy(true);
    const { error } = await supabase.from("request_donors").insert({
      request_id: selectedReq.id,
      donor_id: null,
      added_by: me,
      is_external: true,
      external_name: extForm.external_name,
      external_phone: extForm.external_phone,
      external_blood_group: extForm.external_blood_group,
      source_note: extForm.source_note,
      status: "approved",
    });
    if (error) {
      setBanner(error.message);
    } else {
      setExtForm({
        external_name: "",
        external_phone: "",
        external_blood_group: selectedReq.blood_group,
        source_note: "WhatsApp / Personal Contact",
      });
    }
    await loadRequestDonors(selectedReq);
    setBusy(false);
  };

  // Attender approves or declines a donor on their request
  const handleUpdateDonorStatus = async (rowId, newStatus) => {
    setBusy(true);
    await supabase.from("request_donors").update({ status: newStatus }).eq("id", rowId);
    if (selectedReq) await loadRequestDonors(selectedReq);
    setBusy(false);
  };

  // Mark entire blood request fulfilled
  const handleMarkFulfilled = async (reqId) => {
    await supabase.from("blood_requests").update({ status: "fulfilled" }).eq("id", reqId);
    setSelectedReq(null);
    await loadAll();
  };

  // Save Donor Profile / Registration
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setBanner("");
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profForm.full_name,
        phone: profForm.phone,
        area: profForm.area,
        is_donor: profForm.is_donor,
        blood_group: profForm.is_donor ? profForm.blood_group : null,
        is_available: profForm.is_available,
      })
      .eq("id", me);

    setBusy(false);
    if (error) {
      setBanner("Could not save profile: " + error.message);
    } else {
      setBanner("Donor profile saved!");
      if (onRefreshProfile) onRefreshProfile();
      loadAll();
    }
  };

  const linkedDonorIds = new Set(reqDonors.map((d) => d.donor_id).filter(Boolean));
  const unlinkedDonors = availableDonors.filter((d) => !linkedDonorIds.has(d.id));

  return (
    <div className="bb-shell">
      {/* Desktop Sidebar */}
      <aside className="bb-side">
        <div className="brand">
          <span className="rd-drop sm" />
          BloodBridge
        </div>
        <button
          className={`bb-nv ${view === "dashboard" ? "on" : ""}`}
          onClick={() => { setView("dashboard"); setSelectedReq(null); setBanner(""); }}
        >
          Dashboards
        </button>
        <button
          className={`bb-nv ${view === "create" ? "on" : ""}`}
          onClick={() => { setView("create"); setBanner(""); }}
        >
          + Create Request
        </button>
        <button
          className={`bb-nv ${view === "profile" ? "on" : ""}`}
          onClick={() => { setView("profile"); setBanner(""); }}
        >
          Donor Profile
        </button>
        <button
          className={`bb-nv ${view === "chats" ? "on" : ""}`}
          onClick={() => { setView("chats"); setBanner(""); }}
        >
          Chats
        </button>
        <button className="bb-nv out" onClick={onSignOut}>
          Sign Out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className={`bb-main ${view === "chats" ? "no-pad" : ""}`}>
        {view === "chats" ? (
          <ChatApp session={session} onSignOut={onSignOut} />
        ) : (
          <>
            {/* Navy Top Header */}
            <div className="bb-top">
              <div className="bb-top-in">
                <div>
                  <h1>Hi, {profile?.full_name || session.user.email}</h1>
                  <p>
                    {profile?.is_donor
                      ? `Registered Donor (${bgLabel(profile.blood_group)}) • ${
                          profile.is_available ? "Available" : "Unavailable"
                        }`
                      : "Patient Attender Account"}
                  </p>
                </div>
                <div className="bb-actions">
                  <button
                    className="rd-btn sm"
                    onClick={() => { setView("create"); setBanner(""); }}
                  >
                    + Request Blood
                  </button>
                </div>
              </div>
            </div>

            <div className="bb-wrap">
              {banner && <div className="bb-msg-ok">{banner}</div>}

              {/* VIEW 1: DASHBOARDS (ATTENDER & DONOR) */}
              {view === "dashboard" && !selectedReq && (
                <>
                  <div className="bb-grid3">
                    <div className="bb-card">
                      <div className="bb-mu">My Blood Requests</div>
                      <div className="bb-big">{myRequests.length}</div>
                    </div>
                    <div className="bb-card">
                      <div className="bb-mu">Open Requests Nearby</div>
                      <div className="bb-big">{openRequests.length}</div>
                    </div>
                    <div className="bb-card">
                      <div className="bb-mu">My Donor Status</div>
                      <div className="bb-big">
                        {profile?.is_donor ? bgLabel(profile.blood_group) : "Not Set"}
                      </div>
                    </div>
                  </div>

                  <div className="bb-tabs">
                    <button
                      className={dashTab === "attender" ? "on" : ""}
                      onClick={() => setDashTab("attender")}
                    >
                      Attender Dashboard ({myRequests.length})
                    </button>
                    <button
                      className={dashTab === "donor" ? "on" : ""}
                      onClick={() => setDashTab("donor")}
                    >
                      Donor Dashboard ({openRequests.length})
                    </button>
                  </div>

                  {/* ATTENDER DASHBOARD */}
                  {dashTab === "attender" && (
                    <div className="bb-grid2">
                      {myRequests.length === 0 ? (
                        <div className="bb-card">
                          <p className="bb-mu">You haven't created any blood requests yet.</p>
                          <br />
                          <button className="rd-btn sm" onClick={() => setView("create")}>
                            + Create Blood Request
                          </button>
                        </div>
                      ) : (
                        myRequests.map((r) => (
                          <div className="bb-card" key={r.id}>
                            <div className="bb-item">
                              <span className="rd-drop">{bgLabel(r.blood_group)}</span>
                              <div className="m">
                                <b>{r.patient_name || "Emergency Request"}</b>
                                <div className="bb-mu">
                                  {r.units} unit{r.units > 1 ? "s" : ""} • {r.hospital}
                                </div>
                                {r.hospital_area && (
                                  <div className="bb-mu">Area: {r.hospital_area}</div>
                                )}
                              </div>
                              <span className={`rd-pill ${r.status === "open" ? "" : "x"}`}>
                                {r.status}
                              </span>
                            </div>
                            {r.note && <div className="bb-note">Note: {r.note}</div>}
                            <div className="bb-actions" style={{ marginTop: "14px" }}>
                              <button
                                className="rd-btn sm"
                                onClick={() => loadRequestDonors(r)}
                              >
                                Manage / Add Donors
                              </button>
                              {r.status === "open" && (
                                <button
                                  className="bb-btn-ghost"
                                  onClick={() => handleMarkFulfilled(r.id)}
                                >
                                  Mark Fulfilled
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* DONOR DASHBOARD */}
                  {dashTab === "donor" && (
                    <div className="bb-grid2">
                      {openRequests.length === 0 ? (
                        <div className="bb-card">
                          <p className="bb-mu">No open blood requests from other users right now.</p>
                        </div>
                      ) : (
                        openRequests.map((r) => {
                          const resp = myResponses[r.id];
                          const status = resp?.status;
                          return (
                            <div className="bb-card" key={r.id}>
                              <div className="bb-item">
                                <span className="rd-drop">{bgLabel(r.blood_group)}</span>
                                <div className="m">
                                  <b>{r.hospital}</b>
                                  <div className="bb-mu">
                                    Patient: {r.patient_name || r.requester?.full_name || "Patient"} •{" "}
                                    {r.units} unit{r.units > 1 ? "s" : ""}
                                  </div>
                                  {r.hospital_area && (
                                    <div className="bb-mu">Area: {r.hospital_area}</div>
                                  )}
                                </div>
                                {profile?.blood_group === r.blood_group && (
                                  <span className="rd-pill">Match</span>
                                )}
                              </div>

                              {r.note && <div className="bb-note">{r.note}</div>}

                              <div className="bb-actions" style={{ marginTop: "14px" }}>
                                <button
                                  className="bb-btn-ok"
                                  disabled={busy || status === "accepted" || status === "approved"}
                                  onClick={() => handleDonorDecision(r.id, "accepted")}
                                >
                                  {status === "accepted" || status === "approved"
                                    ? "Accepted ✓"
                                    : "Accept"}
                                </button>
                                <button
                                  className="bb-btn-no"
                                  disabled={busy || status === "declined"}
                                  onClick={() => handleDonorDecision(r.id, "declined")}
                                >
                                  {status === "declined" ? "Declined" : "Decline"}
                                </button>
                                {(status === "accepted" || status === "approved") && (
                                  <button
                                    className="bb-btn-ghost"
                                    onClick={() => setView("chats")}
                                  >
                                    Open Chat
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}

              {/* MANAGE DONORS ON A SPECIFIC REQUEST (ADD / ACCEPT / DECLINE) */}
              {view === "dashboard" && selectedReq && (
                <>
                  <div>
                    <button
                      className="bb-btn-ghost"
                      onClick={() => { setSelectedReq(null); setBanner(""); }}
                    >
                      ← Back to Dashboards
                    </button>
                  </div>

                  <div className="bb-card">
                    <div className="bb-item">
                      <span className="rd-drop">{bgLabel(selectedReq.blood_group)}</span>
                      <div className="m">
                        <b>{selectedReq.patient_name || "Emergency Request"}</b>
                        <div className="bb-mu">
                          {selectedReq.units} units needed at {selectedReq.hospital} (
                          {selectedReq.hospital_area || "Bengaluru"})
                        </div>
                      </div>
                      <span className={`rd-pill ${selectedReq.status === "open" ? "" : "x"}`}>
                        {selectedReq.status}
                      </span>
                    </div>
                  </div>

                  {/* Linked Donors List (Approve / Decline) */}
                  <div className="bb-card">
                    <h3>Coordinated Donors ({reqDonors.length})</h3>
                    {reqDonors.length === 0 ? (
                      <p className="bb-mu">
                        No donors linked yet. Add a registered donor or an external WhatsApp donor below.
                      </p>
                    ) : (
                      reqDonors.map((d) => {
                        const name = d.is_external ? d.external_name : d.donor?.full_name;
                        const phone = d.is_external ? d.external_phone : d.donor?.phone;
                        const grp = d.is_external ? d.external_blood_group : d.donor?.blood_group;
                        return (
                          <div className="bb-donor-row" key={d.id}>
                            <div>
                              <b>{name || "Donor"}</b> ({bgLabel(grp)}) {phone ? `• ${phone}` : ""}
                              <div className="bb-mu">
                                Source: {d.is_external ? d.source_note : "BloodBridge App"} • Status:{" "}
                                <b>{d.status.toUpperCase()}</b>
                              </div>
                            </div>
                            <div className="bb-actions">
                              <button
                                className="bb-btn-ok"
                                disabled={busy || d.status === "approved"}
                                onClick={() => handleUpdateDonorStatus(d.id, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                className="bb-btn-no"
                                disabled={busy || d.status === "rejected"}
                                onClick={() => handleUpdateDonorStatus(d.id, "rejected")}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Donors (Platform + External) */}
                  <div className="bb-grid2">
                    <div className="bb-card">
                      <h3>Add Platform Donors</h3>
                      <p className="bb-mu">Invite available donors registered on BloodBridge.</p>
                      {unlinkedDonors.length === 0 ? (
                        <p className="bb-mu" style={{ marginTop: "10px" }}>
                          No other available donors right now.
                        </p>
                      ) : (
                        unlinkedDonors.map((d) => (
                          <div className="bb-donor-row" key={d.id}>
                            <div>
                              <b>{d.full_name}</b> ({bgLabel(d.blood_group)})
                              <div className="bb-mu">{d.area || "Bengaluru"}</div>
                            </div>
                            <button
                              className="rd-btn sm"
                              disabled={busy}
                              onClick={() => handleInvitePlatformDonor(d.id)}
                            >
                              + Add
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="bb-card">
                      <h3>Add External Donor</h3>
                      <p className="bb-mu">
                        Found a donor on WhatsApp or via friends? Log them here to verify commitment.
                      </p>
                      <form className="bb-form" style={{ marginTop: "10px" }} onSubmit={handleAddExternalDonor}>
                        <input
                          className="bb-in"
                          required
                          placeholder="Donor Full Name"
                          value={extForm.external_name}
                          onChange={(e) => setExtForm({ ...extForm, external_name: e.target.value })}
                        />
                        <input
                          className="bb-in"
                          required
                          placeholder="Donor Phone Number"
                          value={extForm.external_phone}
                          onChange={(e) => setExtForm({ ...extForm, external_phone: e.target.value })}
                        />
                        <select
                          className="bb-in"
                          value={extForm.external_blood_group}
                          onChange={(e) =>
                            setExtForm({ ...extForm, external_blood_group: e.target.value })
                          }
                        >
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>
                              Blood Group: {bg}
                            </option>
                          ))}
                        </select>
                        <input
                          className="bb-in"
                          placeholder="Source (e.g. WhatsApp Group, Friend)"
                          value={extForm.source_note}
                          onChange={(e) => setExtForm({ ...extForm, source_note: e.target.value })}
                        />
                        <button type="submit" className="rd-btn sm" disabled={busy}>
                          + Add External Donor
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}

              {/* VIEW 2: CREATE BLOOD REQUEST */}
              {view === "create" && (
                <div className="bb-card" style={{ maxWidth: "600px" }}>
                  <h2>Create Emergency Blood Request</h2>
                  <p className="bb-mu">
                    Share verified hospital details so donors know exact requirements before traveling.
                  </p>
                  <form className="bb-form" style={{ marginTop: "14px" }} onSubmit={handleCreateRequest}>
                    <label className="bb-lbl">
                      Patient Name
                      <input
                        className="bb-in"
                        required
                        placeholder="e.g. Aarav Sharma"
                        value={reqForm.patient_name}
                        onChange={(e) => setReqForm({ ...reqForm, patient_name: e.target.value })}
                      />
                    </label>

                    <div className="bb-row2">
                      <label className="bb-lbl">
                        Blood Group Needed
                        <select
                          className="bb-in"
                          value={reqForm.blood_group}
                          onChange={(e) => setReqForm({ ...reqForm, blood_group: e.target.value })}
                        >
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="bb-lbl">
                        Units Required
                        <input
                          className="bb-in"
                          type="number"
                          min="1"
                          max="10"
                          required
                          value={reqForm.units}
                          onChange={(e) => setReqForm({ ...reqForm, units: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="bb-row2">
                      <label className="bb-lbl">
                        Hospital Name
                        <input
                          className="bb-in"
                          required
                          placeholder="e.g. Manipal Hospital"
                          value={reqForm.hospital}
                          onChange={(e) => setReqForm({ ...reqForm, hospital: e.target.value })}
                        />
                      </label>

                      <label className="bb-lbl">
                        Hospital Area
                        <input
                          className="bb-in"
                          required
                          placeholder="e.g. Old Airport Rd / Yelahanka"
                          value={reqForm.hospital_area}
                          onChange={(e) => setReqForm({ ...reqForm, hospital_area: e.target.value })}
                        />
                      </label>
                    </div>

                    <label className="bb-lbl">
                      Needed By (Optional)
                      <input
                        className="bb-in"
                        type="datetime-local"
                        value={reqForm.needed_by}
                        onChange={(e) => setReqForm({ ...reqForm, needed_by: e.target.value })}
                      />
                    </label>

                    <label className="bb-lbl">
                      Hospital-Specific Criteria / Notes
                      <textarea
                        className="bb-in"
                        rows="3"
                        placeholder="e.g. Blood bank open 9 AM - 5 PM, bring Govt ID, gate number"
                        value={reqForm.note}
                        onChange={(e) => setReqForm({ ...reqForm, note: e.target.value })}
                      />
                    </label>

                    <button type="submit" className="rd-btn w" disabled={busy}>
                      {busy ? "Publishing..." : "Publish Blood Request"}
                    </button>
                  </form>
                </div>
              )}

              {/* VIEW 3: DONOR REGISTRATION & PROFILE */}
              {view === "profile" && (
                <div className="bb-card" style={{ maxWidth: "600px" }}>
                  <h2>Donor Registration & Profile</h2>
                  <p className="bb-mu">
                    Update your blood group, location, and availability status.
                  </p>
                  <form className="bb-form" style={{ marginTop: "14px" }} onSubmit={handleSaveProfile}>
                    <label className="bb-lbl">
                      Full Name
                      <input
                        className="bb-in"
                        required
                        value={profForm.full_name}
                        onChange={(e) => setProfForm({ ...profForm, full_name: e.target.value })}
                      />
                    </label>

                    <div className="bb-row2">
                      <label className="bb-lbl">
                        Phone Number
                        <input
                          className="bb-in"
                          required
                          placeholder="Mobile number"
                          value={profForm.phone}
                          onChange={(e) => setProfForm({ ...profForm, phone: e.target.value })}
                        />
                      </label>

                      <label className="bb-lbl">
                        Area / Locality
                        <input
                          className="bb-in"
                          required
                          placeholder="e.g. Yelahanka"
                          value={profForm.area}
                          onChange={(e) => setProfForm({ ...profForm, area: e.target.value })}
                        />
                      </label>
                    </div>

                    <label className="bb-check">
                      <input
                        type="checkbox"
                        checked={profForm.is_donor}
                        onChange={(e) => setProfForm({ ...profForm, is_donor: e.target.checked })}
                      />
                      Register me as a Blood Donor
                    </label>

                    {profForm.is_donor && (
                      <>
                        <label className="bb-lbl">
                          Blood Group
                          <select
                            className="bb-in"
                            value={profForm.blood_group}
                            onChange={(e) =>
                              setProfForm({ ...profForm, blood_group: e.target.value })
                            }
                          >
                            {BLOOD_GROUPS.map((bg) => (
                              <option key={bg} value={bg}>
                                {bg}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="bb-check">
                          <input
                            type="checkbox"
                            checked={profForm.is_available}
                            onChange={(e) =>
                              setProfForm({ ...profForm, is_available: e.target.checked })
                            }
                          />
                          Currently available to donate blood
                        </label>
                      </>
                    )}

                    <button type="submit" className="rd-btn w" disabled={busy}>
                      {busy ? "Saving..." : "Save Donor Profile"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bb-bot">
        <button
          className={view === "dashboard" ? "on" : ""}
          onClick={() => { setView("dashboard"); setSelectedReq(null); }}
        >
          Dashboards
        </button>
        <button
          className={view === "create" ? "on" : ""}
          onClick={() => setView("create")}
        >
          + Request
        </button>
        <button
          className={view === "profile" ? "on" : ""}
          onClick={() => setView("profile")}
        >
          Profile
        </button>
        <button
          className={view === "chats" ? "on" : ""}
          onClick={() => setView("chats")}
        >
          Chats
        </button>
        <button onClick={onSignOut}>Exit</button>
      </nav>
    </div>
  );
}