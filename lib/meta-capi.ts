import 'server-only';
import { createHash } from 'node:crypto';

// API de Conversões da Meta (servidor → Meta).
// DESATIVADA enquanto META_CAPI_ACCESS_TOKEN não estiver definido.
// O token fica só no servidor (variável de ambiente da Vercel), nunca no navegador.
// Usa o mesmo event_id do Pixel para a Meta deduplicar os dois envios.

const GRAPH_VERSION = 'v21.0';

type LeadEvent = {
  eventId: string;
  sourceUrl: string | null;
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  email: string | null;
  whatsapp: string; // 55 + DDD + número
  nome: string;
};

const sha256 = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

export function isCapiEnabled() {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export async function sendLeadToCapi(ev: LeadEvent): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixelId) return;

  const [firstName, ...rest] = ev.nome.split(' ');
  const user_data: Record<string, unknown> = {
    ph: [sha256(ev.whatsapp)],
    fn: [sha256(firstName)],
    ...(rest.length ? { ln: [sha256(rest[rest.length - 1])] } : {}),
    ...(ev.email ? { em: [sha256(ev.email)] } : {}),
    country: [sha256('br')],
    ...(ev.ip ? { client_ip_address: ev.ip } : {}),
    ...(ev.userAgent ? { client_user_agent: ev.userAgent } : {}),
    ...(ev.fbp ? { fbp: ev.fbp } : {}),
    ...(ev.fbc ? { fbc: ev.fbc } : {}),
  };

  const body = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: 'website',
        ...(ev.sourceUrl ? { event_source_url: ev.sourceUrl } : {}),
        user_data,
        custom_data: { content_name: 'orcamento_edicao_video' },
      },
    ],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('[meta-capi] falha', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('[meta-capi] erro de rede', err);
  }
}
