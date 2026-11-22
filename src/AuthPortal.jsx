import { useState } from "react";
import { supabase } from "../supbaseClient";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const drops = Array.from({ length: 16 }, (_, i) => ({
  "--s": `${22 + ((i * 11) % 44)}px`,
  "--x": `${(i * 6.4) % 100}%`,
  "--t": `${9 + (i % 5) * 3}s`,
  "--d": `-${i * 1.9}s`,
}));

export default function AuthPortal() {
  const [portal, setPortal] = useState("user"); // 'user' | 'hospital'
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    area: "",
    is_donor: true,
    blood_group: "O+",
    hospital_name: "",
  });

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleGoogleSignIn = () => {
    supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      if (mode === "signup") {
        const displayName =
          portal === "hospital" ? form.hospital_name : form.full_name;

        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: displayName } },
        });
        if (signUpErr) throw signUpErr;

        if (data?.user) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              role: portal,
              full_name: displayName,
              phone: form.phone,
              area: form.area,
              is_donor: portal === "user" ? form.is_donor : false,
              blood_group:
                portal === "user" && form.is_donor ? form.blood_group : null,
              hospital_name: portal === "hospital" ? form.hospital_name : null,
            },
            { onConflict: "id" }
          );

          if (!data.session) {
            setInfo(
              "Account created! Check your email to confirm, or switch to Sign In."
            );
          }
        }
      } else {
        const { data, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
        if (signInErr) throw signInErr;

        if (data?.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .maybeSingle();

          if (prof?.role && prof.role !== portal) {
            await supabase.auth.signOut();
            throw new Error(
              prof.role === "hospital"
                ? "This is a Hospital account. Please switch to the 'Hospital Login' tab above."
                : "This is a Donor/Attender account. Please switch to the 'Donor / Attender' tab above."
            );
          }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rd-auth">
      <div className="rd-fx" aria-hidden="true">
        {drops.map((s, i) => (
          <i key={i} style={s} />
        ))}
      </div>

      <div className="rd-authbox">
        <span className="rd-drop big" />
        <h1>BloodBridge</h1>
        <p>
          {portal === "user"
            ? "Trusted coordination for donors & patient attenders"
            : "Hospital & Blood Bank verification portal"}
        </p>

        <div className="bb-auth-card">
          {/* Separate Portal Switcher */}
          <div className="bb-tabs">
            <button
              type="button"
              className={portal === "user" ? "on" : ""}
              onClick={() => {
                setPortal("user");
                setError("");
                setInfo("");
              }}
            >
              Donor / Attender
            </button>
            <button
              type="button"
              className={portal === "hospital" ? "on" : ""}
              onClick={() => {
                setPortal("hospital");
                setError("");
                setInfo("");
              }}
            >
              Hospital Login
            </button>
          </div>

          {error && <div className="bb-msg-err">{error}</div>}
          {info && <div className="bb-msg-ok">{info}</div>}

          <form className="bb-form" onSubmit={handleSubmit}>
            {mode === "signup" && portal === "user" && (
              <>
                <label className="bb-lbl">
                  Full Name
                  <input
                    className="bb-in"
                    required
                    placeholder="e.g. Milind H G"
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                  />
                </label>

                <div className="bb-row2">
                  <label className="bb-lbl">
                    Phone Number
                    <input
                      className="bb-in"
                      required
                      placeholder="10-digit mobile"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </label>
                  <label className="bb-lbl">
                    Area / Locality
                    <input
                      className="bb-in"
                      required
                      placeholder="e.g. Yelahanka"
                      value={form.area}
                      onChange={(e) => update("area", e.target.value)}
                    />
                  </label>
                </div>

                <label className="bb-check">
                  <input
                    type="checkbox"
                    checked={form.is_donor}
                    onChange={(e) => update("is_donor", e.target.checked)}
                  />
                  Register me as a Blood Donor too
                </label>

                {form.is_donor && (
                  <label className="bb-lbl">
                    Your Blood Group
                    <select
                      className="bb-in"
                      value={form.blood_group}
                      onChange={(e) => update("blood_group", e.target.value)}
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {mode === "signup" && portal === "hospital" && (
              <>
                <label className="bb-lbl">
                  Hospital / Blood Bank Name
                  <input
                    className="bb-in"
                    required
                    placeholder="e.g. Manipal Hospital"
                    value={form.hospital_name}
                    onChange={(e) => update("hospital_name", e.target.value)}
                  />
                </label>

                <div className="bb-row2">
                  <label className="bb-lbl">
                    Blood Bank Phone
                    <input
                      className="bb-in"
                      required
                      placeholder="Desk number"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </label>
                  <label className="bb-lbl">
                    Area
                    <input
                      className="bb-in"
                      required
                      placeholder="e.g. Hebbal"
                      value={form.area}
                      onChange={(e) => update("area", e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            <label className="bb-lbl">
              Email
              <input
                className="bb-in"
                type="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>

            <label className="bb-lbl">
              Password
              <input
                className="bb-in"
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </label>

            <button type="submit" className="rd-btn w" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "signin"
                ? `Sign in as ${portal === "hospital" ? "Hospital" : "User"}`
                : "Create Account"}
            </button>
          </form>

          {portal === "user" && mode === "signin" && (
            <button
              type="button"
              className="bb-btn-ghost"
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </button>
          )}

          <div style={{ textAlign: "center", fontSize: "13px" }}>
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="bb-link-btn"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setInfo("");
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}