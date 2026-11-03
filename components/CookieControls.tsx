'use client';

import { useEffect, useState } from 'react';
import { getConsent, onConsentChange, setConsent, type ConsentValue } from '@/lib/consent';

export default function CookieControls() {
  const [value, setValue] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setValue(getConsent());
    return onConsentChange(setValue);
  }, []);

  const label = value === 'granted' ? 'aceitos' : value === 'denied' ? 'recusados' : 'ainda não escolhidos';

  return (
    <div>
      <p style={{ margin: 0, fontSize: 14 }}>
        Status atual: <strong>{label}</strong>
      </p>
      <div className="policy-actions">
        <button type="button" onClick={() => setConsent('granted')}>
          Aceitar cookies
        </button>
        <button type="button" onClick={() => setConsent('denied')}>
          Recusar cookies
        </button>
      </div>
    </div>
  );
}
