import { useEffect, useState } from 'react';

/** true quando o aparelho tem conexão. O contador de envios pendentes entra na Fase 2. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const ligou = () => setOnline(true);
    const caiu = () => setOnline(false);
    window.addEventListener('online', ligou);
    window.addEventListener('offline', caiu);
    return () => {
      window.removeEventListener('online', ligou);
      window.removeEventListener('offline', caiu);
    };
  }, []);

  return online;
}
