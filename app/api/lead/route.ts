import { NextResponse, after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/service';
import { rateLimit } from '@/lib/rate-limit';
import { isCapiEnabled, sendLeadToCapi } from '@/lib/meta-capi';
import { labelFor } from '@/lib/questions';
import {
  normalizeEmail,
  normalizeName,
  normalizeWhatsApp,
  validateContact,
  type ContactErrors,
} from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8 * 1024;
const MIN_FILL_MS = 2500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function clientIp(req: Request): string | null {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

function readCookie(req: Request, name: string): string | null {
  const m = req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function POST(req: Request) {
  // 1. Mesma origem
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json(403, { ok: false, message: 'Origem não permitida.' });
    } catch {
      return json(403, { ok: false, message: 'Origem não permitida.' });
    }
  }

  // 2. Limite de requisições por IP
  const ip = clientIp(req);
  if (!rateLimit(ip ?? 'unknown')) {
    return json(429, { ok: false, message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.' });
  }

  // 3. Corpo da requisição
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: 'Requisição muito grande.' });
  }
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, message: 'Requisição muito grande.' });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object') throw new Error();
  } catch {
    return json(400, { ok: false, message: 'Dados inválidos.' });
  }

  // 4. Antispam: honeypot preenchido ou envio rápido demais → finge sucesso, não grava.
  if (str(body.website) || Number(body.elapsedMs) < MIN_FILL_MS) {
    return json(200, { ok: true });
  }

  // 5. Validação (o servidor nunca confia no navegador)
  const contact = { nome: str(body.nome, 200), whatsapp: str(body.whatsapp, 40), email: str(body.email, 300) };
  const errors: ContactErrors = validateContact(contact);
  if (Object.keys(errors).length) {
    return json(422, { ok: false, errors, message: 'Confira os campos destacados.' });
  }
  const estilo = labelFor('estilo', body.estilo);
  const objetivo = labelFor('objetivo', body.objetivo);
  const quantidade = labelFor('quantidade', body.quantidade);
  if (!estilo || !objetivo || !quantidade) {
    return json(422, { ok: false, message: 'Responda todas as perguntas antes de enviar.' });
  }
  const submissionId = str(body.submissionId, 64);
  if (!UUID_RE.test(submissionId)) return json(400, { ok: false, message: 'Dados inválidos.' });

  // 6. Gravação no Supabase
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[lead] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.');
    return json(500, { ok: false, message: 'Não foi possível enviar agora. Tente novamente em instantes.' });
  }

  const nome = normalizeName(contact.nome);
  const whatsapp = normalizeWhatsApp(contact.whatsapp)!;
  const email = normalizeEmail(contact.email) || null;

  const row = {
    nome,
    whatsapp,
    email,
    estilo_video: estilo,
    objetivo,
    quantidade,
    submission_id: submissionId,
    consentimento_rastreamento: body.consent === true,
    user_agent: str(req.headers.get('user-agent'), 400) || null,
  };

  let leadId: string | null = null;
  let duplicate = false;

  const { data, error } = await supabase.from('leads').insert(row).select('id').single();
  if (!error) {
    leadId = data.id;
  } else if (error.code === '23505') {
    // Envio duplicado (duplo clique / nova tentativa): devolve o lead já salvo.
    duplicate = true;
    const existing = await supabase.from('leads').select('id').eq('submission_id', submissionId).single();
    if (existing.error) {
      console.error('[lead] erro ao buscar duplicado', existing.error);
      return json(500, { ok: false, message: 'Não foi possível enviar agora. Tente novamente em instantes.' });
    }
    leadId = existing.data.id;
  } else {
    console.error('[lead] erro ao gravar no Supabase', error);
    return json(500, { ok: false, message: 'Não foi possível enviar agora. Tente novamente em instantes.' });
  }

  const eventId = `lead_${leadId}`;

  // 7. API de Conversões (opcional, só com consentimento, roda depois da resposta)
  if (!duplicate && isCapiEnabled() && body.consent === true) {
    after(() =>
      sendLeadToCapi({
        eventId,
        sourceUrl: req.headers.get('referer'),
        ip,
        userAgent: req.headers.get('user-agent'),
        fbp: readCookie(req, '_fbp'),
        fbc: readCookie(req, '_fbc'),
        email,
        whatsapp,
        nome,
      })
    );
  }

  return json(duplicate ? 200 : 201, { ok: true, leadId, eventId });
}

export function GET() {
  return json(405, { ok: false, message: 'Método não permitido.' });
}
