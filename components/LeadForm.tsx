'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QUESTIONS, type QuestionId } from '@/lib/questions';
import {
  formatWhatsAppInput,
  validateContact,
  validateEmail,
  validateName,
  validateWhatsApp,
  type ContactErrors,
  type ContactInput,
} from '@/lib/validation';
import { hasConsent } from '@/lib/consent';
import { trackLead } from '@/lib/pixel';
import { buildWhatsAppLink, openPendingWhatsAppTab } from '@/lib/whatsapp';

const WELCOME = -1;
const CONTACT = QUESTIONS.length;
const DONE = QUESTIONS.length + 1;
const TOTAL_STEPS = QUESTIONS.length + 1;

const DRAFT_KEY = 'acr_form_draft_v1';
const DONE_KEY = 'acr_form_done_v1';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ADVANCE_DELAY = 360;
const LEAVE_DURATION = 200;

type Answers = Partial<Record<QuestionId, string>>;
type Draft = { step: number; answers: Answers; contact: ContactInput; submissionId: string; startedAt: number };

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function LeadForm() {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(WELCOME);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [leaving, setLeaving] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [contact, setContact] = useState<ContactInput>({ nome: '', whatsapp: '', email: '' });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const submissionId = useRef<string>('');
  const startedAt = useRef<number>(0);
  const transitioning = useRef(false);
  const advancing = useRef(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Restaura o rascunho (ou a tela de agradecimento) ao recarregar a página.
  useEffect(() => {
    if (readSession<{ leadId: string }>(DONE_KEY)) {
      setStep(DONE);
      submitting.current = true;
    } else {
      const draft = readSession<Draft>(DRAFT_KEY);
      if (draft) {
        setAnswers(draft.answers ?? {});
        setContact(draft.contact ?? { nome: '', whatsapp: '', email: '' });
        setStep(Math.min(Math.max(draft.step, WELCOME), CONTACT));
        submissionId.current = draft.submissionId;
        startedAt.current = draft.startedAt;
      }
    }
    if (!submissionId.current) submissionId.current = uuid();
    setHydrated(true);
  }, []);

  // Salva o rascunho localmente (nada é enviado ao servidor antes da última etapa).
  useEffect(() => {
    if (!hydrated || step === DONE) return;
    writeSession(DRAFT_KEY, {
      step,
      answers,
      contact,
      submissionId: submissionId.current,
      startedAt: startedAt.current,
    } satisfies Draft);
  }, [hydrated, step, answers, contact]);

  useEffect(() => {
    if (hydrated && step !== WELCOME) headingRef.current?.focus({ preventScroll: true });
  }, [step, hydrated]);

  const goTo = useCallback((next: number) => {
    if (transitioning.current) return;
    transitioning.current = true;
    setDirection(next > step ? 'forward' : 'back');
    setLeaving(true);
    window.setTimeout(() => {
      setStep(next);
      setLeaving(false);
      transitioning.current = false;
    }, LEAVE_DURATION);
  }, [step]);

  const start = useCallback(() => {
    if (!startedAt.current) startedAt.current = Date.now();
    goTo(0);
  }, [goTo]);

  const choose = useCallback(
    (qid: QuestionId, value: string, index: number) => {
      if (transitioning.current || advancing.current) return;
      advancing.current = true;
      setAnswers((a) => ({ ...a, [qid]: value }));
      window.setTimeout(() => {
        advancing.current = false;
        goTo(index + 1);
      }, ADVANCE_DELAY);
    },
    [goTo]
  );

  // Atalhos de teclado: A–D escolhem, Enter começa.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (step === WELCOME && e.key === 'Enter') {
        e.preventDefault();
        start();
        return;
      }
      if (step >= 0 && step < CONTACT) {
        const idx = LETTERS.indexOf(e.key.toUpperCase());
        const q = QUESTIONS[step];
        if (idx >= 0 && idx < q.options.length) choose(q.id, q.options[idx].value, step);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, start, choose]);

  function updateField(field: keyof ContactInput, value: string) {
    const v = field === 'whatsapp' ? formatWhatsAppInput(value) : value;
    setContact((c) => ({ ...c, [field]: v }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function blurField(field: keyof ContactInput) {
    const v = contact[field];
    if (!v && field !== 'email') return; // não acusa erro antes da pessoa tentar
    const msg =
      field === 'nome' ? validateName(v) : field === 'whatsapp' ? validateWhatsApp(v) : validateEmail(v);
    setErrors((e) => ({ ...e, [field]: msg ?? undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;

    const missing = QUESTIONS.findIndex((q) => !answers[q.id]);
    if (missing >= 0) {
      goTo(missing);
      return;
    }

    const errs = validateContact(contact);
    setErrors(errs);
    if (errs.nome) return nameRef.current?.focus();
    if (errs.whatsapp) return phoneRef.current?.focus();
    if (errs.email) return emailRef.current?.focus();

    submitting.current = true;
    setStatus('submitting');
    setSubmitError(null);

    // Aba aberta ainda no clique; só vai para o WhatsApp depois do salvamento confirmado.
    const waTab = openPendingWhatsAppTab();

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...answers,
          ...contact,
          submissionId: submissionId.current,
          elapsedMs: startedAt.current ? Date.now() - startedAt.current : 0,
          consent: hasConsent(),
          website: honeypot,
        }),
      });
      window.clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.message || 'Não foi possível enviar agora. Tente novamente em instantes.');
      }

      // Lead só é disparado aqui: depois que o backend confirmou a gravação.
      if (data.leadId && data.eventId) trackLead(data.leadId, data.eventId);

      writeSession(DONE_KEY, { leadId: data.leadId ?? null });
      writeSession(DRAFT_KEY, null);
      setStatus('idle');
      goTo(DONE);

      // Lead salvo: agora sim abre o WhatsApp. Se a aba foi bloqueada ou fechada,
      // a tela de agradecimento oferece o botão "Abrir WhatsApp".
      if (waTab && !waTab.closed) waTab.location.href = buildWhatsAppLink();
    } catch (err) {
      waTab?.close(); // erro: não abre o WhatsApp
      submitting.current = false;
      setStatus('error');
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setSubmitError(
        aborted
          ? 'A conexão demorou demais. Verifique sua internet e tente novamente.'
          : err instanceof TypeError
            ? 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
            : (err as Error).message
      );
    }
  }

  const progress = step < 0 ? 0 : step >= CONTACT ? 1 : (step + 1) / TOTAL_STEPS;
  const showChrome = step >= 0 && step <= CONTACT;

  return (
    <div className={`shell ${hydrated ? 'is-ready' : ''}`}>
      <header className="topbar">
        <div className="brand" aria-label="Ana Clara Resende">
          <span className="brand-mark" aria-hidden="true">AC</span>
          <span className="brand-name">Ana Clara Resende</span>
        </div>
        {showChrome && (
          <span className="step-count" aria-live="polite">
            {Math.min(step + 1, TOTAL_STEPS)} <span>/ {TOTAL_STEPS}</span>
          </span>
        )}
      </header>

      <div
        className={`progress ${showChrome ? 'is-visible' : ''}`}
        role="progressbar"
        aria-label="Progresso do formulário"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ transform: `scaleX(${step === DONE ? 1 : progress})` }} />
      </div>

      <main className="stage-wrap">
        <div key={step} className={`stage stage-${direction} ${leaving ? 'is-leaving' : ''}`}>
          {step === WELCOME && (
            <section className="welcome">
              <p className="eyebrow">Edição de vídeo &amp; motion design</p>
              <h1 className="display">
                Vamos dar vida à <em>sua ideia?</em>
              </h1>
              <p className="lead">
                Me conte um pouquinho sobre os vídeos que você precisa. São só 3 perguntas rápidas para eu entender
                seu projeto e preparar uma proposta alinhada ao que você procura.
              </p>
              <div className="cta-row">
                <button type="button" className="btn-primary" onClick={start} autoFocus>
                  Começar
                  <Arrow />
                </button>
                <span className="hint-key">
                  ou pressione <kbd>Enter ↵</kbd>
                </span>
              </div>
              <p className="helper">Leva cerca de 1 minuto • Sem compromisso</p>
            </section>
          )}

          {step >= 0 && step < CONTACT && (
            <section className="question">
              <p className="q-number">
                Pergunta {step + 1} de {QUESTIONS.length}
              </p>
              <h2 className="q-title" ref={headingRef} tabIndex={-1}>
                {QUESTIONS[step].title}
              </h2>
              <div className="options" role="radiogroup" aria-label={QUESTIONS[step].title}>
                {QUESTIONS[step].options.map((opt, i) => {
                  const selected = answers[QUESTIONS[step].id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`option ${selected ? 'is-selected' : ''}`}
                      onClick={() => choose(QUESTIONS[step].id, opt.value, step)}
                    >
                      <span className="option-key" aria-hidden="true">
                        {LETTERS[i]}
                      </span>
                      <span className="option-label">{opt.label}</span>
                      <Check />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === CONTACT && (
            <section className="contact">
              <p className="q-number">Última etapa</p>
              <h2 className="q-title" ref={headingRef} tabIndex={-1}>
                Agora me conta como posso falar com você.
              </h2>

              <form onSubmit={submit} noValidate className="fields">
                <Field
                  id="nome"
                  label="Nome completo"
                  error={errors.nome}
                  inputRef={nameRef}
                  value={contact.nome}
                  onChange={(v) => updateField('nome', v)}
                  onBlur={() => blurField('nome')}
                  autoComplete="name"
                  placeholder="Seu nome e sobrenome"
                  maxLength={120}
                  required
                />
                <Field
                  id="whatsapp"
                  label="WhatsApp com DDD"
                  error={errors.whatsapp}
                  inputRef={phoneRef}
                  value={contact.whatsapp}
                  onChange={(v) => updateField('whatsapp', v)}
                  onBlur={() => blurField('whatsapp')}
                  autoComplete="tel-national"
                  inputMode="tel"
                  type="tel"
                  placeholder="(11) 98765-4321"
                  required
                />
                <Field
                  id="email"
                  label="E-mail"
                  optional
                  error={errors.email}
                  inputRef={emailRef}
                  value={contact.email}
                  onChange={(v) => updateField('email', v)}
                  onBlur={() => blurField('email')}
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  placeholder="voce@email.com"
                  maxLength={254}
                />

                {/* Armadilha para robôs: invisível para pessoas */}
                <div className="hp" aria-hidden="true">
                  <label htmlFor="website">Site</label>
                  <input
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {status === 'error' && submitError && (
                  <p className="alert" role="alert">
                    {submitError}
                  </p>
                )}

                <button type="submit" className="btn-primary btn-block" disabled={status === 'submitting'}>
                  {status === 'submitting' ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Enviando…
                    </>
                  ) : (
                    <>
                      Enviar e continuar
                      <Arrow />
                    </>
                  )}
                </button>

                <p className="privacy-note">
                  Seus dados serão usados apenas para entrar em contato sobre o seu projeto e enviar a proposta. Nada
                  de spam. Veja a{' '}
                  <Link href="/politica-de-privacidade" target="_blank" rel="noopener">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>
            </section>
          )}

          {step === DONE && (
            <section className="done">
              <span className="done-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28">
                  <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="display display-sm" ref={headingRef} tabIndex={-1}>
                Tudo certo! <em>Recebi suas informações.</em>
              </h2>
              <p className="lead">Agora você pode falar diretamente comigo para conversarmos sobre seu projeto.</p>
              <a className="btn-primary btn-whatsapp" href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon />
                Abrir WhatsApp
              </a>
              <p className="helper">Se o WhatsApp não abriu sozinho, toque no botão acima.</p>
            </section>
          )}
        </div>
      </main>

      <footer className="footer">
        {step >= 0 && step <= CONTACT ? (
          <button
            type="button"
            className="back"
            onClick={() => goTo(step - 1)}
            disabled={status === 'submitting'}
            aria-label={step === 0 ? 'Voltar para a apresentação' : 'Voltar para a pergunta anterior'}
          >
            <Arrow left /> Voltar
          </button>
        ) : (
          <span />
        )}
        <Link href="/politica-de-privacidade" className="footer-link">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  optional?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onBlur: () => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value' | 'id'>;

function Field({ id, label, value, error, optional, inputRef, onChange, onBlur, ...rest }: FieldProps) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label} {optional ? <span className="optional">(opcional)</span> : <span className="req" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        name={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function Arrow({ left }: { left?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style={left ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="option-check" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"
      />
    </svg>
  );
}
