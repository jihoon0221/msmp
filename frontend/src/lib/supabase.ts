import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasPlaceholderConfig =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-project") ||
  supabaseAnonKey === "your-anon-key";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !hasPlaceholderConfig);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

