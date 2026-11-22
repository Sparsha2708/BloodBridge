# Red Drop chat (React + Vite + Supabase)

1. Supabase Dashboard > SQL Editor: run `supabase/schema.sql` once.
2. Authentication > Providers: enable Google. Add your dev URL (http://localhost:5173) under URL Configuration.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key.
4. `npm install && npm run dev`
5. Sign in with two Google accounts, insert a test request (snippet at the bottom of schema.sql), and click Respond as the other account.

How it works: messages are rows in Postgres (so history survives refresh) and arrive live through Supabase Realtime `postgres_changes`.
Row-level security means only the requester and the accepting donor can read or write a conversation, and sending stops once the request is fulfilled.
Presence (the Online dot) is a per-conversation channel. To start a chat from another screen call `supabase.rpc('accept_request', { p_request_id })`.
