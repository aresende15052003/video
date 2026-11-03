'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getConsent, onConsentChange, setConsent } from '@/lib/consent';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
    return onConsentChange((v) => setVisible(v === null));
  }, []);

  if (!visible) return null;

  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Preferências de cookies">
      <p>
        Uso cookies e o Meta Pixel para medir meus anúncios. Você escolhe.{' '}
        <Link href="/politica-de-privacidade#cookies">Saiba mais</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn-ghost" onClick={() => setConsent('denied')}>
          Recusar
        </button>
        <button type="button" className="btn-small" onClick={() => setConsent('granted')}>
          Aceitar
        </button>
      </div>
    </div>
  );
}
