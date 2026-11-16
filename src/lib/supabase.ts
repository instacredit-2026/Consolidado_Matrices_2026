import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let cliente: SupabaseClient | null = null;

/** Cliente único de Supabase (solo navegador). La sesión se guarda en localStorage y se renueva sola. */
export function supabase(): SupabaseClient {
  if (!URL || !CLAVE) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env");
  }
  cliente ??= createClient(URL, CLAVE, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cliente;
}
