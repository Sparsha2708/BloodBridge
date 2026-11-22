import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supbaseClient";
import AuthPortal from "./AuthPortal";
import UserPortal from "./UserPortal";
import "./chat.css";

function HospitalPlaceholder({ session, profile, onSignOut }) {
  return (
    <div className="bb-shell">
      <aside className="bb-side">
        <div className="brand">
          <span className="rd-drop sm" />
          BloodBridge
        </div>
        <button className="bb-nv on">Hospital Dashboard</button>
        <button className="bb-nv out" onClick={onSignOut}>
          Sign Out
        </button>
      </aside>

      <main className="bb-main">
        <div className="bb-top">
          <div className="bb-top-in">
            <div>
              <h1>{profile?.hospital_name || profile?.full_name || "Hospital Portal"}</h1>
              <p>Hospital &amp; Blood Bank Verification Dashboard • {profile?.area || session.user.email}</p>
            </div>
            <button className="rd-btn sm" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        <div className="bb-wrap">
          <div className="bb-card">
            <h2>Hospital &amp; Blood Bank Module (Part 2 Slot)</h2>
            <p className="bb-mu" style={{ marginTop: "8px" }}>
              You are logged into the separate <b>Hospital Portal</b>. Your teammate handling the Hospital module can build donor arrival verification and donation outcome confirmation right here without affecting the Donor &amp; Attender dashboard.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setLoadingProfile(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data || null);
    setLoadingProfile(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = () => supabase.auth.signOut();

  if (session === undefined || (session && loadingProfile)) {
    return null;
  }

  if (!session) {
    return <AuthPortal />;
  }

  if (profile?.role === "hospital") {
    return (
      <HospitalPlaceholder
        session={session}
        profile={profile}
        onSignOut={signOut}
      />
    );
  }

  return (
    <UserPortal
      session={session}
      profile={profile}
      onRefreshProfile={() => loadProfile(session.user.id)}
      onSignOut={signOut}
    />
  );
}