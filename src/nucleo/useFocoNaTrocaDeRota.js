import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Move o foco para o conteúdo principal a cada troca de rota. Numa SPA o navegador não recarrega a
 * página, então quem usa leitor de tela não é avisado de que a tela mudou; focar o `<main>` (que tem
 * `tabIndex={-1}` só para isto, fora da ordem normal de Tab) faz o leitor anunciar o título da tela
 * nova a partir dali. Pula a primeira renderização, para não roubar o foco de quem acabou de entrar.
 */
export function useFocoNaTrocaDeRota() {
  const ref = useRef(null);
  const primeira = useRef(true);
  const { pathname } = useLocation();

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    ref.current?.focus();
  }, [pathname]);

  return ref;
}
