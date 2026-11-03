'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { QUESTIONS } from '@/lib/questions';
import { STATUSES, formatPhone, leadWhatsAppLink, statusLabel, type Lead, type LeadStatus } from '@/lib/status';
import { signOut, updateLeadStatus } from '@/app/admin/actions';

const TZ = 'America/Sao_Paulo';
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: 'short' });

const dayKey = (iso: string | Date) => dayKeyFmt.format(new Date(iso)); // YYYY-MM-DD em Brasília
const ESTILOS = QUESTIONS.find((q) => q.id === 'estilo')!.options.map((o) => o.label);

type Period = 'todos' | 'hoje' | '7d' | '30d' | 'mes' | 'custom';

type Props = { leads: Lead[]; loadError: string | null; userEmail: string };

export default function AdminDashboard({ leads: initial, loadError, userEmail }: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [leads, setLeads] = useState<Lead[]>(initial);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'todos' | LeadStatus>('todos');
  const [estilo, setEstilo] = useState('todos');
  const [period, setPeriod] = useState<Period>('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => setLeads(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const stats = useMemo(() => {
    const count = (...s: LeadStatus[]) => leads.filter((l) => s.includes(l.status)).length;
    return [
      { label: 'Total de leads', value: leads.length, accent: true },
      { label: 'Leads novos', value: count('novo') },
      { label: 'Em atendimento', value: count('em_contato', 'negociacao'), hint: 'Em contato + Negociação' },
      { label: 'Propostas enviadas', value: count('proposta_enviada') },
      { label: 'Fechados', value: count('fechado') },
    ];
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const now = Date.now();
    const today = dayKey(new Date());
    const month = today.slice(0, 7);

    const list = leads.filter((l) => {
      if (status !== 'todos' && l.status !== status) return false;
      if (estilo !== 'todos' && l.estilo_video !== estilo) return false;
      if (q) {
        const byName = l.nome.toLowerCase().includes(q);
        const byPhone = qDigits.length >= 3 && l.whatsapp.includes(qDigits);
        if (!byName && !byPhone) return false;
      }
      if (period !== 'todos') {
        const key = dayKey(l.created_at);
        const age = now - new Date(l.created_at).getTime();
        if (period === 'hoje' && key !== today) return false;
        if (period === '7d' && age > 7 * 864e5) return false;
        if (period === '30d' && age > 30 * 864e5) return false;
        if (period === 'mes' && key.slice(0, 7) !== month) return false;
        if (period === 'custom' && ((from && key < from) || (to && key > to))) return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      order === 'desc' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
    );
  }, [leads, query, status, estilo, period, from, to, order]);

  const hasFilters = query || status !== 'todos' || estilo !== 'todos' || period !== 'todos';
  const openLead = leads.find((l) => l.id === openId) ?? null;

  async function changeStatus(lead: Lead, next: LeadStatus) {
    if (next === lead.status || saving) return;
    const prev = lead.status;
    setSaving(lead.id);
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: next } : l)));
    try {
      const res = await updateLeadStatus(lead.id, next);
      if (!res.ok) throw new Error(res.message);
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, ...res.lead } : l)));
      setToast({ kind: 'ok', text: `Status de ${lead.nome.split(' ')[0]} alterado para “${statusLabel(next)}”.` });
    } catch (err) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
      setToast({ kind: 'error', text: (err as Error).message || 'Não foi possível salvar. Tente novamente.' });
    } finally {
      setSaving(null);
    }
  }

  function clearFilters() {
    setQuery('');
    setStatus('todos');
    setEstilo('todos');
    setPeriod('todos');
    setFrom('');
    setTo('');
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">AC</span>
          <div>
            <span className="brand-name">Ana Clara Resende</span>
            <span className="adm-sub">Painel de leads</span>
          </div>
        </div>
        <div className="adm-top-actions">
          <span className="adm-user" title={userEmail}>
            {userEmail}
          </span>
          <button
            type="button"
            className="adm-btn"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
          >
            <RefreshIcon spinning={refreshing} /> <span className="hide-sm">Atualizar</span>
          </button>
          <form action={signOut}>
            <button className="adm-btn">Sair</button>
          </form>
        </div>
      </header>

      <main className="adm-main">
        {loadError && (
          <p className="adm-alert" role="alert">
            {loadError}
          </p>
        )}

        <section className="stats" aria-label="Resumo">
          {stats.map((s) => (
            <div key={s.label} className={`stat ${s.accent ? 'stat-accent' : ''}`} title={s.hint}>
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value}</span>
              {s.hint && <span className="stat-hint">{s.hint}</span>}
            </div>
          ))}
        </section>

        <section className="toolbar" aria-label="Filtros">
          <label className="search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Buscar por nome ou WhatsApp"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar por nome ou WhatsApp"
            />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrar por status">
            <option value="todos">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={estilo} onChange={(e) => setEstilo(e.target.value)} aria-label="Filtrar por tipo de vídeo">
            <option value="todos">Todos os tipos de vídeo</option>
            {ESTILOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Filtrar por período">
            <option value="todos">Todo o período</option>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="mes">Este mês</option>
            <option value="custom">Personalizado…</option>
          </select>
          {period === 'custom' && (
            <div className="date-range">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
              <span>até</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
            </div>
          )}
        </section>

        <div className="list-head">
          <p>
            <strong>{filtered.length}</strong> {filtered.length === 1 ? 'lead' : 'leads'}
            {hasFilters ? ` de ${leads.length}` : ''}
            {hasFilters && (
              <button type="button" className="link-btn" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </p>
          <div className="list-actions">
            <button type="button" className="adm-btn" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>
              {order === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'} ↕
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
            >
              <DownloadIcon /> Exportar CSV
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            {leads.length === 0 ? (
              <>
                <h2>Nenhum lead ainda</h2>
                <p>Assim que alguém enviar o formulário, o contato aparece aqui.</p>
              </>
            ) : (
              <>
                <h2>Nada encontrado</h2>
                <p>Nenhum lead corresponde aos filtros.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Computador: tabela */}
            <div className="table-wrap">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>WhatsApp</th>
                    <th>Serviço solicitado</th>
                    <th>Data de cadastro</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(l.id)}>
                      <td className="cell-name">{l.nome}</td>
                      <td className="cell-phone">{formatPhone(l.whatsapp)}</td>
                      <td>{l.estilo_video}</td>
                      <td className="cell-date">{dateTimeFmt.format(new Date(l.created_at))}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <StatusSelect lead={l} saving={saving === l.id} onChange={changeStatus} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} className="cell-actions">
                        <WhatsAppButton lead={l} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <ul className="lead-cards">
              {filtered.map((l) => (
                <li key={l.id} className="lead-card">
                  <button type="button" className="lead-card-main" onClick={() => setOpenId(l.id)}>
                    <span className="lead-card-top">
                      <strong>{l.nome}</strong>
                      <span className="cell-date">{dateFmt.format(new Date(l.created_at))}</span>
                    </span>
                    <span className="lead-card-sub">
                      {formatPhone(l.whatsapp)} · {l.estilo_video}
                    </span>
                  </button>
                  <div className="lead-card-actions">
                    <StatusSelect lead={l} saving={saving === l.id} onChange={changeStatus} />
                    <WhatsAppButton lead={l} compact />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {openLead && (
        <div className="drawer-backdrop" onClick={() => setOpenId(null)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <p className="drawer-kicker">Lead recebido em {dateTimeFmt.format(new Date(openLead.created_at))}</p>
                <h2 id="drawer-title">{openLead.nome}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpenId(null)} aria-label="Fechar" autoFocus>
                ×
              </button>
            </div>

            <div className="drawer-status">
              <span>Status do atendimento</span>
              <StatusSelect lead={openLead} saving={saving === openLead.id} onChange={changeStatus} />
              {openLead.status_atualizado_em && (
                <small>Atualizado em {dateTimeFmt.format(new Date(openLead.status_atualizado_em))}</small>
              )}
            </div>

            <dl className="drawer-list">
              <Item label="WhatsApp">
                {formatPhone(openLead.whatsapp)}{' '}
                <button type="button" className="link-btn" onClick={() => copy(openLead.whatsapp, setToast)}>
                  copiar
                </button>
              </Item>
              <Item label="E-mail">
                {openLead.email ? <a href={`mailto:${openLead.email}`}>{openLead.email}</a> : <span className="muted">Não informado</span>}
              </Item>
              <Item label={QUESTIONS[0].title}>{openLead.estilo_video}</Item>
              <Item label={QUESTIONS[1].title}>{openLead.objetivo}</Item>
              <Item label={QUESTIONS[2].title}>{openLead.quantidade}</Item>
              <Item label="Data e hora do envio">{dateTimeFmt.format(new Date(openLead.created_at))}</Item>
              <Item label="Consentiu com cookies de rastreamento">{openLead.consentimento_rastreamento ? 'Sim' : 'Não'}</Item>
            </dl>

            <WhatsAppButton lead={openLead} />
          </aside>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function StatusSelect({
  lead,
  saving,
  onChange,
}: {
  lead: Lead;
  saving: boolean;
  onChange: (lead: Lead, s: LeadStatus) => void;
}) {
  return (
    <select
      className={`status-select status-${lead.status}`}
      value={lead.status}
      disabled={saving}
      onChange={(e) => onChange(lead, e.target.value as LeadStatus)}
      aria-label={`Status de ${lead.nome}`}
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function WhatsAppButton({ lead, compact }: { lead: Lead; compact?: boolean }) {
  return (
    <a
      className={`wa-btn ${compact ? 'wa-btn-compact' : ''}`}
      href={leadWhatsAppLink(lead.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir WhatsApp de ${lead.nome}`}
      title="Abrir conversa no WhatsApp"
    >
      <WhatsAppIcon />
      {!compact && 'Conversar no WhatsApp'}
    </a>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function copy(text: string, setToast: (t: { kind: 'ok' | 'error'; text: string }) => void) {
  navigator.clipboard
    ?.writeText(text)
    .then(() => setToast({ kind: 'ok', text: 'Número copiado.' }))
    .catch(() => setToast({ kind: 'error', text: 'Não foi possível copiar.' }));
}

/** CSV com ";" e BOM para abrir certinho no Excel em português. */
function exportCsv(leads: Lead[]) {
  const header = ['Data de cadastro', 'Nome', 'WhatsApp', 'E-mail', 'Estilo de vídeo', 'Objetivo', 'Quantidade', 'Status'];
  const cell = (v: string) => {
    let s = v ?? '';
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmulas maliciosas no Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = leads.map((l) =>
    [
      dateTimeFmt.format(new Date(l.created_at)),
      l.nome,
      formatPhone(l.whatsapp),
      l.email ?? '',
      l.estilo_video,
      l.objetivo,
      l.quantidade,
      statusLabel(l.status),
    ]
      .map(cell)
      .join(';')
  );
  const csv = '﻿' + [header.map(cell).join(';'), ...rows].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${dayKey(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M10 3v10m-4-4l4 4 4-4M4 16h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={spinning ? 'spin' : undefined}>
      <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"
      />
    </svg>
  );
}
