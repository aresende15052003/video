import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LEAD_COLUMNS, type Lead } from '@/lib/status';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) {
    return (
      <main className="login-wrap">
        <div className="login-card">
          <h1>Acesso negado</h1>
          <p className="login-note">A conta {user.email} não tem permissão para acessar o painel.</p>
          <form action={signOut}>
            <button className="btn-primary btn-block">Sair</button>
          </form>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) console.error('[admin] erro ao carregar leads', error);

  return (
    <AdminDashboard
      leads={(data ?? []) as Lead[]}
      loadError={error ? 'Não foi possível carregar os leads. Atualize a página.' : null}
      userEmail={user.email ?? ''}
    />
  );
}
