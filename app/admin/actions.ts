'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isLeadStatus, type LeadStatus } from '@/lib/status';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UpdateStatusResult =
  | { ok: true; lead: { id: string; status: LeadStatus; status_atualizado_em: string | null } }
  | { ok: false; message: string };

/**
 * Altera o status de um lead usando a sessão da administradora.
 * O RLS do banco garante que só administradores conseguem, e só na coluna status.
 * Não dispara nenhum evento do Meta Pixel.
 */
export async function updateLeadStatus(id: string, status: string): Promise<UpdateStatusResult> {
  if (typeof id !== 'string' || !UUID_RE.test(id) || !isLeadStatus(status)) {
    return { ok: false, message: 'Dados inválidos.' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sua sessão expirou. Entre novamente.' };

  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
    .select('id, status, status_atualizado_em')
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[admin] erro ao atualizar status', error);
    return { ok: false, message: 'Não foi possível salvar o status. Tente novamente.' };
  }
  return { ok: true, lead: data as { id: string; status: LeadStatus; status_atualizado_em: string | null } };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
