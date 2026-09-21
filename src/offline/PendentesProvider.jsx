import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Soma o que está gravado no aparelho e ainda não chegou ao servidor (documentos e fotos), vindo de
// várias telas. O cabeçalho mostra "N itens aguardando envio".
const Contexto = createContext({ total: 0, definir: () => {} });
export const PendentesContext = Contexto; // exportado para os testes de tela

export function PendentesProvider({ children }) {
  const [fontes, setFontes] = useState({});
  const definir = useCallback((chave, n) => setFontes((f) => (f[chave] === n ? f : { ...f, [chave]: n })), []);
  const total = useMemo(() => Object.values(fontes).reduce((a, b) => a + b, 0), [fontes]);
  const valor = useMemo(() => ({ total, definir }), [total, definir]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const usePendentes = () => useContext(Contexto).total;

/** Uma tela informa quantos itens dela aguardam envio; ao sair da tela, zera. */
export function useRegistrarPendentes(chave, n) {
  const { definir } = useContext(Contexto);
  useEffect(() => {
    definir(chave, n);
    return () => definir(chave, 0);
  }, [chave, n, definir]);
}

export { textoPendentes } from './pendentes.js';
