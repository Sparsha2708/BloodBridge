import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supbaseClient.js";
import ChatApp from "./ChatApp";
import HospitalDashboard from "./components/HospitalDashboard.jsx";
import HospitalGuard from "./components/HospitalGuard.jsx";
import ConfirmArrivalModal from "./components/ConfirmArrivalModal.jsx";
import VerifyOutcomeModal from "./components/VerifyOutcomeModal.jsx";
import CloseRequestModal from "./components/CloseRequestModal.jsx";
import {
  fetchHospitalData,
  confirmDonorArrival,
  verifyDonationOutcome,
  closeBloodRequest,
} from "./services/hospitalService.js";
import { ROLES, updateUserRole } from "./services/authService.js";
import "./chat.css";

const drops = Array.from({ length: 16 }, (_, i) => ({
  "--s": `${22 + ((i * 11) % 44)}px`,
  "--x": `${(i * 6.4) % 100}%`,
  "--t": `${9 + (i % 5) * 3}s`,
  "--d": `-${i * 1.9}s`,
}));

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [currentView, setCurrentView] = useState("hospital"); // Default to hospital view!

  // Hospital Dashboard data state
  const [hospitalData, setHospitalData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  // Modals state
  const [arrivalModalDonor, setArrivalModalDonor] = useState(null);
  const [verifyModalDonor, setVerifyModalDonor] = useState(null);
  const [closeModalRequest, setCloseModalRequest] = useState(null);

  // Load user profile from Supabase
  const loadProfile = useCallback(async (userId, userMetadata) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, blood_group, role, hospital_name, phone")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
      } else {
        const fallback = {
          id: userId,
          full_name: userMetadata?.full_name || "Preethi U D",
          role: ROLES.HOSPITAL,
          hospital_name: "Manipal Hospital, Old Airport Rd",
        };
        setProfile(fallback);
      }
    } catch {
      setProfile({
        id: userId,
        full_name: userMetadata?.full_name || "Preethi U D",
        role: ROLES.HOSPITAL,
        hospital_name: "Manipal Hospital, Old Airport Rd",
      });
    }
  }, []);

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        loadProfile(session.user.id, session.user.user_metadata);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user?.id) {
        loadProfile(s.user.id, s.user.user_metadata);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Load Hospital Data from database
  const loadHospitalData = useCallback(async () => {
    try {
      setLoadingData(true);
      setDataError("");
      const hospitalName = profile?.hospital_name || null;
      const result = await fetchHospitalData(hospitalName);
      setHospitalData(result);
    } catch (err) {
      setDataError(err.message || "Failed to load hospital records");
    } finally {
      setLoadingData(false);
    }
  }, [profile?.hospital_name]);

  useEffect(() => {
    if (session && currentView === "hospital") {
      loadHospitalData();
    }
  }, [session, currentView, loadHospitalData]);

  const signInWithGoogle = () => supabase.auth.signInWithOAuth({ provider: "google" });

  const signOut = () => {
    supabase.auth.signOut().catch(() => {});
    setSession(null);
    setProfile(null);
  };

  // Switch role between Hospital Staff and Donor
  const handleSwitchRole = async (newRole, hospitalName = "Manipal Hospital, Old Airport Rd") => {
    if (!session?.user?.id) return;
    try {
      const updated = await updateUserRole(session.user.id, newRole, hospitalName);
      setProfile((prev) => ({
        ...prev,
        ...updated,
        role: newRole,
        hospital_name: newRole === ROLES.HOSPITAL ? hospitalName : null,
      }));

      if (newRole === ROLES.HOSPITAL) {
        setCurrentView("hospital");
        await loadHospitalData();
      } else {
        setCurrentView("chat");
      }
    } catch (err) {
      console.warn("Could not persist role switch to Supabase:", err);
      setProfile((prev) => ({
        ...prev,
        role: newRole,
        hospital_name: newRole === ROLES.HOSPITAL ? hospitalName : null,
      }));
      if (newRole === ROLES.HOSPITAL) {
        setCurrentView("hospital");
      } else {
        setCurrentView("chat");
      }
    }
  };

  const handleOpenHospitalPortal = () => {
    if (profile?.role !== ROLES.HOSPITAL) {
      handleSwitchRole(ROLES.HOSPITAL, profile?.hospital_name || "Manipal Hospital, Old Airport Rd");
    } else {
      setCurrentView("hospital");
      loadHospitalData();
    }
  };

  // Handlers for Task Actions
  const handleConfirmArrival = async (requestId, donorId) => {
    await confirmDonorArrival(requestId, donorId);
    await loadHospitalData();
  };

  const handleVerifyOutcome = async (requestId, donorId, outcome, reason) => {
    await verifyDonationOutcome(requestId, donorId, outcome, reason);
    await loadHospitalData();
  };

  const handleCloseRequest = async (requestId, reason) => {
    await closeBloodRequest(requestId, reason);
    await loadHospitalData();
  };

  if (session === undefined) return null;

  // Sign-in screen without test values
  if (!session) {
    return (
      <div className="rd-auth">
        <div className="rd-fx" aria-hidden="true">
          {drops.map((s, i) => <i key={i} style={s} />)}
        </div>
        <div className="rd-authbox">
          <span className="rd-drop big" />
          <h1>Be a savior</h1>
          <p>Sign in to access BloodBridge.</p>
          <button className="rd-btn" onClick={signInWithGoogle}>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const isHospital = profile?.role === ROLES.HOSPITAL;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Portal Switcher Bar */}
      <div
        style={{
          background: "#0a1324",
          color: "#b9c3dc",
          padding: "8px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          borderBottom: "1px solid #1a2a4a",
          flexWrap: "wrap",
          gap: "10px",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span>Signed in as: <strong style={{ color: "#fff" }}>{profile?.full_name || session.user.email}</strong></span>
          <span>• Active Role:</span>
          <button
            type="button"
            onClick={() => handleSwitchRole(ROLES.HOSPITAL, profile?.hospital_name || "Manipal Hospital, Old Airport Rd")}
            style={{
              background: isHospital ? "var(--red)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              border: isHospital ? "1px solid var(--red)" : "1px solid rgba(255,255,255,0.25)",
              borderRadius: "999px",
              padding: "3px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🏥 Hospital Staff {isHospital ? "✓" : ""}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchRole(ROLES.DONOR)}
            style={{
              background: !isHospital ? "var(--ok)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              border: !isHospital ? "1px solid var(--ok)" : "1px solid rgba(255,255,255,0.25)",
              borderRadius: "999px",
              padding: "3px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🩸 Donor {!isHospital ? "✓" : ""}
          </button>
          {profile?.hospital_name && <span style={{ color: "#ffe3e0" }}>({profile.hospital_name})</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>View:</span>
          <button
            type="button"
            onClick={handleOpenHospitalPortal}
            style={{
              background: currentView === "hospital" ? "var(--red)" : "transparent",
              color: "#fff",
              border: "1px solid var(--red)",
              borderRadius: "999px",
              padding: "3px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Hospital Portal
          </button>
          <button
            type="button"
            onClick={() => setCurrentView("chat")}
            style={{
              background: currentView === "chat" ? "var(--ok)" : "transparent",
              color: "#fff",
              border: "1px solid var(--ok)",
              borderRadius: "999px",
              padding: "3px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Donor & Attender Chat
          </button>
        </div>
      </div>

      {/* Main View: Hospital Module or Part 3 Chat */}
      {currentView === "hospital" ? (
        <HospitalGuard
          session={session}
          profile={profile}
          onSignOut={signOut}
          onAuthorizeHospital={async (hName) => handleSwitchRole(ROLES.HOSPITAL, hName)}
          onNavigateToUserChat={() => setCurrentView("chat")}
        >
          <HospitalDashboard
            hospitalName={profile?.hospital_name || "Hospital"}
            userProfile={profile}
            data={hospitalData}
            loading={loadingData}
            error={dataError}
            onRefresh={loadHospitalData}
            onSignOut={signOut}
            onConfirmArrival={(reqId, donorId) => {
              const item = hospitalData?.expectedDonors?.find(
                (d) => d.request_id === reqId && d.donor_id === donorId
              );
              setArrivalModalDonor(item);
            }}
            onOpenVerifyModal={(donorItem) => setVerifyModalDonor(donorItem)}
            onOpenCloseModal={(reqItem, remaining, verifiedCount) => {
              setCloseModalRequest({ request: reqItem, remaining, verifiedCount });
            }}
          />

          {/* Modal: Confirm Donor Arrival (Task 4) */}
          <ConfirmArrivalModal
            isOpen={Boolean(arrivalModalDonor)}
            donorItem={arrivalModalDonor}
            onClose={() => setArrivalModalDonor(null)}
            onConfirm={handleConfirmArrival}
          />

          {/* Modal: Verify Donation Outcome (Task 5) */}
          <VerifyOutcomeModal
            isOpen={Boolean(verifyModalDonor)}
            donorItem={verifyModalDonor}
            onClose={() => setVerifyModalDonor(null)}
            onVerify={handleVerifyOutcome}
          />

          {/* Modal: Close Blood Request (Task 7) */}
          {closeModalRequest && (
            <CloseRequestModal
              isOpen={Boolean(closeModalRequest)}
              requestItem={closeModalRequest.request}
              remaining={closeModalRequest.remaining}
              verifiedCount={closeModalRequest.verifiedCount}
              onClose={() => setCloseModalRequest(null)}
              onCloseRequest={handleCloseRequest}
            />
          )}
        </HospitalGuard>
      ) : (
        <ChatApp
          session={session}
          onSignOut={signOut}
          onOpenHospitalPortal={handleOpenHospitalPortal}
        />
      )}
    </div>
  );
}
