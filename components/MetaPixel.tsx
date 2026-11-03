'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getConsent, onConsentChange } from '@/lib/consent';
import { revokePixel, trackPageView } from '@/lib/pixel';

/**
 * Dispara PageView ao abrir cada página — somente com consentimento.
 * Se o consentimento for dado depois, dispara o PageView da página atual nesse momento.
 */
export default function MetaPixel() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (getConsent() === 'granted' && lastTracked.current !== pathname) {
      lastTracked.current = pathname;
      trackPageView();
    }
  }, [pathname]);

  useEffect(
    () =>
      onConsentChange((value) => {
        if (value === 'granted' && lastTracked.current !== pathname) {
          lastTracked.current = pathname;
          trackPageView();
        }
        if (value !== 'granted') revokePixel();
      }),
    [pathname]
  );

  return null;
}
