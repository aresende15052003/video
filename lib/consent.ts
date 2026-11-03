// Consentimento para rastreamento (LGPD). O Meta Pixel só é carregado
// depois que o visitante clica em "Aceitar".

export type ConsentValue = 'granted' | 'denied';

const KEY = 'acr_tracking_consent_v1';
const EVENT = 'acr:consent-change';

export function getConsent(): ConsentValue | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function hasConsent(): boolean {
  return typeof window !== 'undefined' && getConsent() === 'granted';
}

export function setConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* modo privado: vale só para esta visita */
  }
  window.dispatchEvent(new CustomEvent<ConsentValue>(EVENT, { detail: value }));
}

export function resetConsent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onConsentChange(cb: (v: ConsentValue | null) => void) {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? null);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
