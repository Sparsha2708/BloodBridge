import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supbaseClient";

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const bg = (g) => (g || "?").replace("-", "\u2212");
const QUICK = ["I am on my way", "Which gate should I use?", "Can you come earlier?", "Thank you"];

export default function ChatApp({ session, onSignOut, onOpenHospitalPortal }) {
  const me = session.user.id;
  const [convos, setConvos] = useState([]);
  const [openReqs, setOpenReqs] = useState([]);
  const [msgs, setMsgs] = useState({});
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(false); // mobile: show thread pane
  const [online, setOnline] = useState([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const endRef = useRef(null);

  const addMsg = useCallback((m) => setMsgs((p) => {
    const l = p[m.conversation_id] || [];
    return l.some((x) => x.id === m.id) ? p : { ...p, [m.conversation_id]: [...l, m].sort((a, b) => a.id - b.id) };
  }), []);

  const loadConvos = useCallback(async () => {
    const { data, error } = await supabase.from("conversations")
      .select("id,request_id,requester_id,donor_id,created_at,request:blood_requests(*),requester:profiles!requester_id(full_name,avatar_url),donor:profiles!donor_id(full_name,avatar_url)")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setConvos(data);
    if (data.length) {
      const { data: last } = await supabase.from("messages").select("*")
        .in("conversation_id", data.map((c) => c.id)).order("id", { ascending: false }).limit(200);
      (last || []).forEach(addMsg);
    }
  }, [addMsg]);

  const loadOpen = useCallback(async () => {
    const { data } = await supabase.from("blood_requests").select("*, requester:profiles!requester_id(full_name)")
      .eq("status", "open").neq("requester_id", me).order("created_at", { ascending: false }).limit(10);
    setOpenReqs(data || []);
  }, [me]);

  // Live feed: new messages, new conversations, request status changes (all filtered by RLS)
  useEffect(() => {
    loadConvos(); loadOpen();
    const ch = supabase.channel("feed:" + me)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => addMsg(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, loadConvos)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "blood_requests" }, () => { loadConvos(); loadOpen(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, loadConvos, loadOpen, addMsg]);

  // Open conversation: load full history + presence (who is online in this chat)
  useEffect(() => {
    if (!active) return;
    supabase.from("messages").select("*").eq("conversation_id", active).order("id")
      .then(({ data }) => (data || []).forEach(addMsg));
    const ch = supabase.channel("presence:" + active, { config: { presence: { key: me } } });
    ch.on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState())))
      .subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ at: Date.now() }); });
    return () => { supabase.removeChannel(ch); setOnline([]); };
  }, [active, me, addMsg]);

  const list = msgs[active] || [];
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [list.length, active]);

  const cur = convos.find((c) => c.id === active);
  const other = cur && (cur.requester_id === me ? cur.donor : cur.requester);
  const isOpen = cur?.request?.status === "open";
  const mine = cur?.requester_id === me;

  const last = (c) => { const l = msgs[c.id]; return l && l[l.length - 1]; };
  const rows = useMemo(() => convos
    .filter((c) => {
      const o = c.requester_id === me ? c.donor : c.requester;
      return ((o?.full_name || "") + c.request?.hospital).toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => new Date(last(b)?.created_at || b.created_at) - new Date(last(a)?.created_at || a.created_at)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [convos, msgs, q, me]);

  const send = async (e, preset) => {
    e?.preventDefault();
    const body = (preset ?? text).trim();
    if (!body || !active || !isOpen) return;
    setText(""); setErr("");
    const { data, error } = await supabase.from("messages")
      .insert({ conversation_id: active, sender_id: me, body }).select().single();
    if (error) { setErr(error.message); setText(body); return; }
    addMsg(data);
  };

  const accept = async (id) => {
    setErr("");
    const { data, error } = await supabase.rpc("accept_request", { p_request_id: id });
    if (error) return setErr(error.message);
    await loadConvos(); setActive(data); setThread(true);
  };

  const fulfil = async () => {
    const { error } = await supabase.from("blood_requests").update({ status: "fulfilled" }).eq("id", cur.request_id);
    if (error) setErr(error.message);
  };

  const acceptedIds = new Set(convos.map((c) => c.request_id));
  const fresh = openReqs.filter((r) => !acceptedIds.has(r.id));

  return (
    <div className={`rd-app ${thread ? "in-thread" : ""}`}>
      <aside className="rd-list">
        <div className="rd-head">
          <div className="rd-brand">
            <span className="rd-drop sm" />Red Drop
            {onOpenHospitalPortal && (
              <button
                type="button"
                className="rd-btn sm"
                onClick={onOpenHospitalPortal}
                style={{ marginLeft: "10px", fontSize: "11px", padding: "4px 10px !important", cursor: "pointer" }}
              >
                🏥 Hospital Portal
              </button>
            )}
            <button className="rd-link" onClick={onSignOut}>Sign out</button>
          </div>
          <p>Chats with donors and requesters</p>
          <input className="rd-search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or hospital" aria-label="Search chats" />
        </div>
        <div className="rd-scroll">
          {fresh.length > 0 && <>
            <h3 className="rd-h">Open requests</h3>
            {fresh.map((r) => (
              <div className="rd-row" key={r.id}>
                <span className="rd-drop sm">{bg(r.blood_group)}</span>
                <span className="rd-meta"><b>{r.requester?.full_name || "Requester"}</b>
                  <small>{r.units} unit{r.units > 1 ? "s" : ""} at {r.hospital}</small></span>
                <button className="rd-btn sm" onClick={() => accept(r.id)}>Respond</button>
              </div>))}
            <h3 className="rd-h">Conversations</h3>
          </>}
          {rows.map((c) => {
            const o = c.requester_id === me ? c.donor : c.requester, l = last(c);
            return (
              <button key={c.id} className="rd-row" aria-current={c.id === active}
                onClick={() => { setActive(c.id); setThread(true); }}>
                <span className="rd-drop sm">{bg(c.request?.blood_group)}</span>
                <span className="rd-meta"><b>{o?.full_name || "Unknown"}</b>
                  <small>{l ? (l.sender_id === me ? "You: " : "") + l.body : "No messages yet"}</small></span>
                {l && <time>{time(l.created_at)}</time>}
              </button>);
          })}
          {!rows.length && !fresh.length && <p className="rd-empty">No chats yet. When a donor responds to a request, the conversation appears here.</p>}
        </div>
      </aside>

      <main className="rd-chat">
        {!cur ? (
          <div className="rd-ph"><div><span className="rd-drop big" /><p><b>Pick a conversation</b><br />Chats open when a donor accepts a blood request.</p></div></div>
        ) : (<>
          <header className="rd-ch">
            <button className="rd-back" onClick={() => setThread(false)} aria-label="Back to chats">&#8249;</button>
            <div className="rd-meta"><b>{other?.full_name || "Unknown"}</b>
              <small><i className={`rd-dot ${online.includes(other && (mine ? cur.donor_id : cur.requester_id)) ? "on" : ""}`} />
                {online.includes(mine ? cur.donor_id : cur.requester_id) ? "Online" : "Offline"}</small></div>
            {mine && isOpen && <button className="rd-btn sm" onClick={fulfil}>Mark fulfilled</button>}
          </header>
          <section className="rd-req">
            <span className="rd-drop sm">{bg(cur.request.blood_group)}</span>
            <span className="rd-meta"><b>{cur.request.units} unit{cur.request.units > 1 ? "s" : ""} of {bg(cur.request.blood_group)} needed</b>
              <small>{cur.request.hospital}{cur.request.needed_by && `, by ${new Date(cur.request.needed_by).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}</small></span>
            <span className={`rd-pill ${isOpen ? "" : "x"}`}>{isOpen ? "Open" : "Fulfilled"}</span>
          </section>
          <div className="rd-msgs" aria-live="polite">
            {list.map((m) => (
              <div key={m.id} className={`rd-m ${m.sender_id === me ? "me" : "them"}`}>{m.body}<small>{time(m.created_at)}</small></div>))}
            <div ref={endRef} />
          </div>
          {isOpen && <div className="rd-quick">{QUICK.map((t) => <button key={t} onClick={() => send(null, t)}>{t}</button>)}</div>}
          {err && <p className="rd-err" role="alert">{err}</p>}
          <form className="rd-comp" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} disabled={!isOpen} maxLength={2000} autoComplete="off"
              placeholder={isOpen ? "Type a message" : "This request is fulfilled, chat is closed"} aria-label="Message" />
            <button className="rd-send" disabled={!isOpen || !text.trim()} aria-label="Send message">&#10148;</button>
          </form>
        </>)}
      </main>
    </div>
  );
}
