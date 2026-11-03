// Validação compartilhada entre navegador e servidor.
// O servidor SEMPRE revalida — a validação do navegador é só para a experiência.

export type ContactInput = { nome: string; whatsapp: string; email: string };
export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

const NAME_RE = /^[\p{L}][\p{L}'’.\- ]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validateName(raw: string): string | null {
  const name = normalizeName(raw);
  if (!name) return 'Informe seu nome completo.';
  if (name.length < 3 || name.length > 120 || !NAME_RE.test(name)) return 'Digite um nome válido.';
  if (name.split(' ').filter((p) => p.length > 0).length < 2) return 'Informe nome e sobrenome.';
  return null;
}

/**
 * Normaliza um WhatsApp brasileiro para o formato 55 + DDD + número.
 * Aceita celular (9 dígitos começando com 9) ou fixo (8 dígitos começando com 2–5).
 * Retorna null se for inválido.
 */
export function normalizeWhatsApp(raw: string): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const [ddd1, ddd2] = [d[0], d[1]];
  if (ddd1 === '0' || ddd2 === '0') return null;
  const local = d.slice(2);
  if (local.length === 9 && local[0] !== '9') return null;
  if (local.length === 8 && !/[2-5]/.test(local[0])) return null;
  if (/^(\d)\1+$/.test(local)) return null; // 99999-9999, 11111-1111…
  return '55' + d;
}

export function validateWhatsApp(raw: string): string | null {
  if (!String(raw ?? '').replace(/\D/g, '')) return 'Informe seu WhatsApp com DDD.';
  return normalizeWhatsApp(raw) ? null : 'Confira o número: use DDD + número, ex.: (11) 98765-4321.';
}

export function normalizeEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return null; // opcional
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'Este e-mail não parece válido.';
  return null;
}

export function validateContact(c: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const n = validateName(c.nome);
  const w = validateWhatsApp(c.whatsapp);
  const e = validateEmail(c.email);
  if (n) errors.nome = n;
  if (w) errors.whatsapp = w;
  if (e) errors.email = e;
  return errors;
}

/** Máscara de digitação: (11) 98765-4321 / (11) 3456-7890 */
export function formatWhatsAppInput(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
