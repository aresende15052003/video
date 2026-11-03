export const WHATSAPP_MESSAGE =
  'Olá, Ana! Acabei de preencher o formulário de orçamento de vídeos e gostaria de conversar sobre meu projeto.';

/** Número comercial configurável em NEXT_PUBLIC_WHATSAPP_NUMBER (ex.: 5511987654321). */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

export function buildWhatsAppLink(): string {
  const text = encodeURIComponent(WHATSAPP_MESSAGE);
  return WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}` : `https://wa.me/?text=${text}`;
}

/**
 * Abre uma aba em branco AGORA, ainda dentro do clique da pessoa.
 * Navegadores (principalmente o Safari do iPhone) bloqueiam abas abertas depois
 * de esperar uma resposta do servidor; por isso a aba nasce no clique e só é
 * enviada ao WhatsApp quando o lead estiver salvo. Retorna null se for bloqueada.
 */
export function openPendingWhatsAppTab(): Window | null {
  try {
    const tab = window.open('', '_blank');
    if (!tab) return null;
    tab.opener = null;
    tab.document.title = 'Abrindo o WhatsApp…';
    tab.document.body.innerHTML =
      '<p style="font:16px/1.5 system-ui,sans-serif;color:#3a302c;text-align:center;margin-top:40vh">Abrindo o WhatsApp…</p>';
    return tab;
  } catch {
    return null;
  }
}
