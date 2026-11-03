import type { Metadata } from 'next';
import Link from 'next/link';
import CookieControls from '@/components/CookieControls';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Ana Clara Resende',
  robots: { index: false, follow: true },
};

// ─────────────────────────────────────────────────────────────
// TEXTO EDITÁVEL — revise os campos entre [colchetes].
// Recomendo uma revisão jurídica antes de publicar.
// ─────────────────────────────────────────────────────────────
const POLICY = {
  responsavel: 'Ana Clara Resende',
  documento: '[CPF ou CNPJ]',
  emailContato: '[seu-email@dominio.com]',
  cidade: '[Cidade/UF]',
  atualizadoEm: '[DD/MM/AAAA]',
  prazoRetencao: '24 meses após o último contato',
};

export default function PrivacyPolicy() {
  const p = POLICY;
  return (
    <div className="shell is-ready">
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="brand-mark" aria-hidden="true">AC</span>
          <span className="brand-name">Ana Clara Resende</span>
        </Link>
      </header>

      <article className="policy">
        <h1>Política de Privacidade</h1>
        <p className="updated">Última atualização: {p.atualizadoEm}</p>

        <p>
          Esta política explica como {p.responsavel} ({p.documento}), prestadora de serviços de edição de vídeo e motion
          design, trata os dados pessoais enviados por meio deste formulário de orçamento, em conformidade com a Lei Geral
          de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>

        <h2>1. Quais dados coletamos</h2>
        <ul>
          <li>Nome completo, número de WhatsApp e, se você quiser informar, e-mail;</li>
          <li>Suas respostas sobre estilo, objetivo e quantidade de vídeos;</li>
          <li>Data e hora do envio e informações técnicas do navegador (user agent);</li>
          <li>Se você autorizar, dados de navegação coletados pelo Meta Pixel (veja a seção Cookies).</li>
        </ul>

        <h2>2. Para que usamos</h2>
        <ul>
          <li>Entrar em contato com você sobre o seu projeto e enviar uma proposta;</li>
          <li>Entender melhor a demanda dos clientes e melhorar os serviços;</li>
          <li>Medir o resultado dos anúncios, apenas com o seu consentimento.</li>
        </ul>
        <p>
          A base legal é a execução de procedimentos preliminares a um contrato, a pedido do titular (art. 7º, V, da LGPD),
          e o consentimento (art. 7º, I) para cookies de rastreamento.
        </p>

        <h2>3. Com quem compartilhamos</h2>
        <p>Seus dados não são vendidos. Eles são tratados por fornecedores que viabilizam o serviço:</p>
        <ul>
          <li>Supabase — armazenamento seguro do banco de dados;</li>
          <li>Vercel — hospedagem do site;</li>
          <li>Meta Platforms — medição de anúncios, somente se você aceitar os cookies.</li>
        </ul>
        <p>Alguns desses fornecedores podem armazenar dados fora do Brasil, com salvaguardas adequadas.</p>

        <h2>4. Por quanto tempo guardamos</h2>
        <p>
          Os dados ficam armazenados por até {p.prazoRetencao}, ou até que você peça a exclusão — o que acontecer
          primeiro.
        </p>

        <h2 id="cookies">5. Cookies e Meta Pixel</h2>
        <p>
          Este site usa o Meta Pixel para medir a eficácia dos anúncios. Ele só é ativado se você clicar em
          &quot;Aceitar&quot;. Nenhum dado que você digita no formulário (nome, WhatsApp, e-mail ou respostas) é enviado
          ao Pixel pelo navegador. Você pode mudar sua escolha quando quiser:
        </p>
        <CookieControls />

        <h2>6. Seus direitos</h2>
        <p>
          Você pode, a qualquer momento, solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade
          ou exclusão dos seus dados, além de revogar o consentimento (art. 18 da LGPD). Basta escrever para{' '}
          <a href={`mailto:${p.emailContato}`}>{p.emailContato}</a>.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Os dados trafegam com criptografia (HTTPS) e ficam em banco de dados com acesso restrito. As credenciais de acesso
          ficam apenas no servidor.
        </p>

        <h2>8. Contato</h2>
        <p>
          {p.responsavel} — {p.cidade}
          <br />
          <a href={`mailto:${p.emailContato}`}>{p.emailContato}</a>
        </p>

        <p style={{ marginTop: 48 }}>
          <Link href="/">← Voltar ao formulário</Link>
        </p>
      </article>
    </div>
  );
}
