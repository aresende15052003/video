// Meta Pixel — código base oficial (fbevents.js) carregado somente com consentimento.
// Nenhum dado pessoal (nome, WhatsApp, e-mail ou respostas) é enviado pelo navegador.

import { hasConsent } from './consent';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
const LEAD_TRACKED_PREFIX = 'acr_lead_tracked_';

let initialized = false;

/** Equivalente tipado do snippet oficial do Meta Pixel. */
function loadBaseCode() {
  if (window.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Fbq;
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
}

function ensurePixel(): boolean {
  if (typeof window === 'undefined' || !PIXEL_ID || !hasConsent()) return false;
  if (!initialized) {
    loadBaseCode();
    window.fbq!('consent', 'grant');
    // Desliga a coleta automática do Pixel (cliques em botões, textos e metadados da página),
    // que enviaria o texto das alternativas escolhidas. Precisa vir antes do 'init'.
    window.fbq!('set', 'autoConfig', false, PIXEL_ID);
    window.fbq!('init', PIXEL_ID);
    initialized = true;
  }
  return true;
}

export function trackPageView() {
  if (!ensurePixel()) return;
  window.fbq!('track', 'PageView');
}

/** Chamado quando o visitante revoga o consentimento depois de aceitar. */
export function revokePixel() {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('consent', 'revoke');
}

/**
 * Dispara o evento Lead UMA única vez por lead salvo.
 * Só deve ser chamado depois que a API confirmou a gravação no Supabase.
 * O eventID é o mesmo usado pela API de Conversões (deduplicação).
 */
export function trackLead(leadId: string, eventId: string): boolean {
  const key = LEAD_TRACKED_PREFIX + leadId;
  try {
    if (window.localStorage.getItem(key)) return false;
  } catch {}
  if (!ensurePixel()) return false;
  window.fbq!('track', 'Lead', { content_name: 'orcamento_edicao_video' }, { eventID: eventId });
  try {
    window.localStorage.setItem(key, '1');
  } catch {}
  return true;
}
