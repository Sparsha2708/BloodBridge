import { createClient } from "@supabase/supabase-js";

const env = typeof import.meta !== "undefined" && import.meta.env 
  ? import.meta.env 
  : (typeof process !== "undefined" && process.env ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "https://szrihnuhpvhmbmieozhc.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_seHzubpd064LQVAW5Ck0OA_rkQ0vZ9e";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey &&
  !String(supabaseUrl).includes("placeholder")
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
