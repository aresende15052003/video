import MetaPixel from '@/components/MetaPixel';
import ConsentBanner from '@/components/ConsentBanner';

// Roda antes do formulário ser desenhado: se a pessoa recarregou no meio do
// preenchimento (ou na tela de agradecimento), marca o <html> para a etapa
// esperar a restauração. Mantenha as chaves iguais às de components/LeadForm.tsx.
const RESTORE_SCRIPT = `try{var d=JSON.parse(sessionStorage.getItem('acr_form_draft_v1')||'null');if(sessionStorage.getItem('acr_form_done_v1')||(d&&d.step>=0))document.documentElement.classList.add('acr-restoring')}catch(e){}`;

// Páginas públicas: só aqui o banner de cookies e o Meta Pixel são carregados.
// O painel /admin fica de fora, então nada feito nele dispara eventos.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RESTORE_SCRIPT }} />
      {children}
      <ConsentBanner />
      <MetaPixel />
    </>
  );
}
