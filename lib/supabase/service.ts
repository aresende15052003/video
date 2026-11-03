import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente com a chave secreta: usado SOMENTE na rota de API (servidor).
// O import 'server-only' faz o build falhar se alguém importar isto no navegador.

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
