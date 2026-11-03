'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(
          authError.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : authError.status === 400 || authError.status === 401
              ? 'E-mail ou senha incorretos.'
              : 'Não foi possível conectar ao servidor de login. Tente novamente em instantes.'
        );
        return;
      }
      const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
      if (rpcError || !isAdmin) {
        await supabase.auth.signOut();
        setError('Esta conta não tem acesso ao painel.');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Não foi possível conectar. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">AC</span>
          <div>
            <p className="login-kicker">Área restrita</p>
            <h1>Painel de leads</h1>
          </div>
        </div>

        {!configured && (
          <p className="adm-alert" role="alert">
            Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        )}

        <label className="adm-field">
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="adm-field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary btn-block" disabled={loading || !configured}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Entrando…
            </>
          ) : (
            'Entrar'
          )}
        </button>
        <p className="login-note">Acesso exclusivo da administração. Não há cadastro público.</p>
      </form>
    </main>
  );
}
