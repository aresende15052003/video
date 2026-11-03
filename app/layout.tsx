
import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'Orçamento de vídeo | Ana Clara Resende',
  description:
    'Edição de vídeo e motion design. Responda 3 perguntas rápidas e receba uma proposta alinhada ao seu projeto.',
  openGraph: {
    title: 'Vamos dar vida à sua ideia? | Ana Clara Resende',
    description:
      'Edição de vídeo e motion design. Leva cerca de 1 minuto • Sem compromisso.',
    type: 'website',
    locale: 'pt_BR',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5EFE6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap"
        />
        <style>{`
          :root {
            --font-display: 'Cormorant Garamond';
            --font-sans: 'Manrope';
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
