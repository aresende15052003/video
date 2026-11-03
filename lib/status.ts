// Status do atendimento. Os valores precisam bater com a constraint
// leads_status_check em supabase/schema.sql.

export const STATUSES = [
  { value: 'novo', label: 'Novo lead' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'proposta_enviada', label: 'Proposta enviada' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'perdido', label: 'Perdido' },
] as const;

export type LeadStatus = (typeof STATUSES)[number]['value'];

export function isLeadStatus(v: unknown): v is LeadStatus {
  return STATUSES.some((s) => s.value === v);
}

export function statusLabel(v: string): string {
  return STATUSES.find((s) => s.value === v)?.label ?? v;
}

export type Lead = {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  estilo_video: string;
  objetivo: string;
  quantidade: string;
  status: LeadStatus;
  status_atualizado_em: string | null;
  consentimento_rastreamento: boolean;
};

export const LEAD_COLUMNS =
  'id, created_at, nome, whatsapp, email, estilo_video, objetivo, quantidade, status, status_atualizado_em, consentimento_rastreamento';

export const ADMIN_WHATSAPP_MESSAGE =
  'Olá, tudo bem? Aqui é a Ana Clara. Recebi suas informações sobre o projeto de vídeo e gostaria de conversar um pouquinho com você.';

/** wa.me abre o app no celular e o WhatsApp Web/Desktop no computador. */
export function leadWhatsAppLink(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(ADMIN_WHATSAPP_MESSAGE)}`;
}

/** 5511987654321 → (11) 98765-4321 */
export function formatPhone(whatsapp: string): string {
  const d = whatsapp.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return whatsapp;
}
