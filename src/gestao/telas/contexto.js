import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessao } from '../../nucleo/Sessao.jsx';
import { podeAcompanhar, podeDecidir, ehGerenteDoSetor } from '../../nucleo/permissoes.js';
import { db } from '../../nucleo/firebase.js';
import { resolverNomes } from '../repositorio.js';
import { nomeParaMostrar } from '../vinculos.js';

const MODULO = 'fitossanidade';

/** O que as telas de gestão precisam saber da sessão: empresa, setor em uso e o que a pessoa pode fazer nele. */
export function useContextoGestao() {
  const s = useSessao();
  const setor = s.setorDoModulo(MODULO);
  const vinculo = setor ? s.vinculoDoSetor(setor.setorId) : null;
  return {
    db,
    empresaId: s.empresaId,
    uid: s.user?.uid ?? null,
    meuNome: s.nome,
    setor,
    vinculo,
    podeAcompanhar: podeAcompanhar(vinculo),
    podeDecidir: podeDecidir(vinculo),
    ehGerente: ehGerenteDoSetor(vinculo),
    ehAdminEmpresa: s.ehAdminEmpresa,
    setores: s.setores,
    unidades: s.unidades,
  };
}

/**
 * Nomes para mostrar: { [uid]: nome }. Lê o que as regras deixam (hoje só o admin lê o nome dos colegas; cada
 * um lê o próprio) e, para os demais, mostra um trecho do código. `conhecidos` acrescenta nomes que a tela já tem.
 */
export function useNomes(db, empresaId, uids, meuUid, meuNome, conhecidos = {}) {
  const [lidos, setLidos] = useState({});
  const pedidos = useRef(new Set());
  const chave = [...new Set(uids.filter(Boolean))].sort().join('|');

  useEffect(() => {
    const faltam = chave.split('|').filter((u) => u && !pedidos.current.has(u));
    if (faltam.length === 0) return undefined;
    faltam.forEach((u) => pedidos.current.add(u));
    let vivo = true;
    resolverNomes(db, empresaId, faltam).then((n) => vivo && setLidos((l) => ({ ...l, ...n })));
    return () => { vivo = false; };
  }, [db, empresaId, chave]);

  return useMemo(() => {
    const sabidos = { ...lidos, ...conhecidos, ...(meuUid && meuNome ? { [meuUid]: meuNome } : {}) };
    return Object.fromEntries(chave.split('|').filter(Boolean).map((u) => [u, nomeParaMostrar(u, sabidos)]));
  }, [lidos, conhecidos, meuUid, meuNome, chave]);
}
