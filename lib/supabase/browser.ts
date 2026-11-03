import { createBrowserClient } from '@supabase/ssr';

// Usado só na tela de login do /admin. A chave pública (anon/publishable) é
// feita para ficar no navegador: sem login de administradora, o RLS não libera nada.
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
