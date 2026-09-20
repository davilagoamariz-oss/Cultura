import { useEffect, useState } from 'react';

// Só é offline quando o navegador diz explicitamente que não há conexão (onLine === false).
// Se a informação não existir, assume online: melhor não alarmar sem motivo.
const estaOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/** true quando o aparelho tem conexão. O contador de envios pendentes entra na Fase 3. */
export function useOnline() {
  const [online, setOnline] = useState(estaOnline);

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
