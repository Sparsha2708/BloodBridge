import { useEffect, useState } from "react";
import { supabase } from "../supbaseClient";
import ChatApp from "./ChatApp";
import "./chat.css";

const drops = Array.from({ length: 16 }, (_, i) => ({
  "--s": `${22 + ((i * 11) % 44)}px`,
  "--x": `${(i * 6.4) % 100}%`,
  "--t": `${9 + (i % 5) * 3}s`,
  "--d": `-${i * 1.9}s`,
}));

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const signIn = () => supabase.auth.signInWithOAuth({ provider: "google" });
  const signOut = () => supabase.auth.signOut();

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="rd-auth">
        <div className="rd-fx" aria-hidden="true">
          {drops.map((s, i) => <i key={i} style={s} />)}
        </div>
        <div className="rd-authbox">
          <span className="rd-drop big" />
          <h1>Be a savior</h1>
          <p>Sign in to chat with donors and requesters.</p>
          <button className="rd-btn" onClick={signIn}>Continue with Google</button>
        </div>
      </div>
    );
  }
  return <ChatApp session={session} onSignOut={signOut} />;
}
