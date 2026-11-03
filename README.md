# Orçamento de vídeo — Ana Clara Resende

Formulário de captação (estilo Typeform) + painel privado de leads em `/admin`.
Next.js 15 · Supabase (banco + login) · Meta Pixel · pronto para a Vercel.

```
app/
  (site)/page.tsx                    → formulário (/)
  (site)/politica-de-privacidade/    → política editável
  (site)/layout.tsx                  → banner de cookies + Meta Pixel (só no site público)
  api/lead/route.ts                  → ÚNICA rota pública: recebe e grava um novo lead
  admin/login/page.tsx               → login (Supabase Auth)
  admin/page.tsx                     → painel de leads
  admin/actions.ts                   → alterar status / sair
middleware.ts                        → bloqueia /admin sem login
components/LeadForm.tsx              → formulário
components/admin/AdminDashboard.tsx  → cartões, filtros, tabela, detalhes, CSV
lib/                                 → perguntas, status, validação, Pixel, consentimento, Supabase
supabase/schema.sql                  → tabelas + segurança (rode no Supabase)
```

---

## Passo a passo de configuração

### 1. Criar o projeto no Supabase
1. Acesse <https://supabase.com> → **New project**. Escolha a região **South America (São Paulo)**.
2. Guarde a senha do banco num lugar seguro.

### 2. Criar as tabelas e a segurança
1. No Supabase: **SQL Editor → New query**.
2. Cole **todo** o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Deve aparecer "Success. No rows returned". Pode rodar de novo no futuro sem perder dados.

Isso cria a tabela `leads` (com status), a tabela `admins`, as regras de segurança (RLS) e a
visualização `leads_brasilia` (mesmos dados com horário de Brasília, para olhar no Table Editor).

### 3. Bloquear cadastros públicos
**Authentication → Sign In / Providers** (ou *Authentication → Settings*, conforme a versão do painel):
- Desligue **Allow new users to sign up**.
- Mantenha o provedor **Email** ligado (é ele que permite o login com senha).

> Mesmo que alguém consiga criar uma conta, ela não vê nada: só quem está na tabela `admins` tem acesso.

### 4. Criar o seu usuário de administradora
1. **Authentication → Users → Add user → Create new user**.
2. Informe seu e-mail e uma senha forte. Marque **Auto Confirm User**.
3. Volte ao **SQL Editor** e rode (trocando o e-mail):

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'seu-email@dominio.com'
on conflict (user_id) do nothing;
```

4. Confira: `select * from public.admins;` deve mostrar 1 linha.

### 5. Pegar as chaves
**Project Settings → Data API** (URL) e **Project Settings → API Keys**:

| Variável | Onde encontrar | Pode ir ao navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **anon** / **publishable** | Sim (protegida pelo RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** / **secret** | **NUNCA** |

### 6. Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub.
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório (detecta Next.js sozinho).
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre:

```
NEXT_PUBLIC_SUPABASE_URL       = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = (chave anon/publishable)
SUPABASE_SERVICE_ROLE_KEY      = (chave service_role/secret)
NEXT_PUBLIC_META_PIXEL_ID      = 1679747500352196
NEXT_PUBLIC_WHATSAPP_NUMBER    = 55DDDNUMERO   ← seu WhatsApp comercial, só números
NEXT_PUBLIC_SITE_URL           = https://seu-dominio.com.br   (opcional)
```

4. **Deploy**. Sempre que mudar uma variável `NEXT_PUBLIC_*`, faça um novo deploy (*Deployments → ⋯ → Redeploy*),
   porque elas são gravadas no site no momento da publicação.

### 7. Configurar a URL no Supabase Auth
**Authentication → URL Configuration → Site URL**: coloque o endereço do site (ex.: `https://seu-dominio.com.br`).

### 8. Checklist pós-publicação (faça você mesma — só assim dá para afirmar que funciona em produção)
1. Abra o site, aceite os cookies, responda tudo e envie com seus próprios dados.
2. Supabase → **Table Editor → leads**: a linha deve estar lá com status `novo`.
3. Acesse `https://seu-dominio/admin`, entre com seu e-mail e senha: o lead aparece na tabela.
4. Mude o status, recarregue a página: o status deve continuar alterado.
5. Clique no botão do WhatsApp do lead: deve abrir a conversa com a mensagem pronta.
6. Meta → **Gerenciador de Eventos → seu Pixel → Testar eventos**: abra o site pelo campo de teste,
   envie o formulário e confira **PageView** e **Lead** (um único Lead por envio).
7. Abra `/admin` numa janela anônima: deve ir direto para o login.

---

## Como funciona a segurança

- **Formulário → `/api/lead`** (servidor): valida tudo de novo, tem honeypot, tempo mínimo de preenchimento,
  limite por IP, checagem de origem e ID único por envio (um duplo clique não cria dois leads).
  Grava com a chave secreta, que só existe no servidor.
- A rota pública **só aceita POST de um novo lead**. GET/PATCH/DELETE respondem 405. Não existe forma
  pública de listar, alterar ou excluir leads.
- **Banco (RLS)**: visitantes (chave pública) não têm nenhuma permissão na tabela. Usuários logados só
  enxergam leads se estiverem na tabela `admins`, e mesmo a administradora só consegue alterar a coluna
  `status` pelo painel — nada de apagar ou editar outros dados pela API.
- **Painel**: o middleware exige sessão válida em `/admin`; a página confere de novo se é admin; o
  banco confere uma terceira vez (RLS). O painel lê os dados **com a sessão da administradora**, não com a
  chave secreta.
- **Login**: Supabase Auth, cadastro público desligado, limite de tentativas nativo do Supabase.

## Meta Pixel

- Carrega **somente depois** que o visitante clica em "Aceitar" no banner de cookies.
- **PageView**: ao abrir a página (ou no momento em que o visitante aceita).
- **Lead**: só depois que a API confirma a gravação no Supabase; uma vez por lead (protegido contra
  atualização da página); com `eventID = lead_<id>` para deduplicar com a API de Conversões.
- Coleta automática do Pixel (cliques em botões/textos) **desligada** — ela enviaria o texto das respostas.
- Nenhum nome, WhatsApp, e-mail ou resposta é enviado pelo navegador.
- O painel `/admin` não carrega o Pixel: alterar status não dispara nenhum evento.

### API de Conversões (opcional, futuro)
Já está pronta em `lib/meta-capi.ts`, **desligada**. Para ligar, crie o token no Gerenciador de Eventos
(*Configurações → API de Conversões → Gerar token*) e cadastre na Vercel `META_CAPI_ACCESS_TOKEN`
(e, para testar, `META_CAPI_TEST_EVENT_CODE`). Só envia para quem aceitou os cookies, com dados
criptografados (SHA-256) a partir do servidor. Não foi testada contra a Meta.

## Personalizações comuns

| O que | Onde |
|---|---|
| Textos das perguntas/opções | `lib/questions.ts` |
| Nomes dos status | `lib/status.ts` (os valores precisam bater com `schema.sql`) |
| Mensagem do WhatsApp (visitante) | `lib/whatsapp.ts` |
| Mensagem do WhatsApp (painel) | `lib/status.ts` → `ADMIN_WHATSAPP_MESSAGE` |
| Política de Privacidade | `app/(site)/politica-de-privacidade/page.tsx` → objeto `POLICY` |
| Cores | topo de `app/globals.css` |

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000  e  http://localhost:3000/admin
```
