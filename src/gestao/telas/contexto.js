import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useSessao } from '../../nucleo/Sessao.jsx';
import { podeAcompanhar, podeDecidir, ehGerenteDoSetor } from '../../nucleo/permissoes.js';
import { db } from '../../nucleo/firebase.js';
import { resolverNomes, consultaAvaliacoesFinalizadasDoSetor, consultaDecisoesDoSetor } from '../repositorio.js';
import { nomeParaMostrar } from '../vinculos.js';
import { contarPendencias } from '../pendencias.js';

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
 * Quantas coisas esperam a ação da pessoa no setor de Fitossanidade em uso (para o selo na aba). Sem
 * vínculo que dê nisso (nem agrônomo, nem gerente), nem chega a ouvir nada: fica sempre em 0.
 */
export function useContagemPendencias() {
  const { empresaId, setor, podeDecidir, ehGerente } = useContextoGestao();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [decisoes, setDecisoes] = useState([]);

  useEffect(() => {
    if (!setor || !(podeDecidir || ehGerente)) {
      setAvaliacoes([]);
      setDecisoes([]);
      return undefined;
    }
    const parar = [
      onSnapshot(consultaDecisoesDoSetor(db, empresaId, setor.setorId), (s) => setDecisoes(s.docs.map((d) => d.data())), () => setDecisoes([])),
    ];
    if (podeDecidir) {
      parar.push(onSnapshot(consultaAvaliacoesFinalizadasDoSetor(db, empresaId, setor.setorId), (s) => setAvaliacoes(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setAvaliacoes([])));
    }
    return () => parar.forEach((f) => f());
  }, [empresaId, setor, podeDecidir, ehGerente]);

  return contarPendencias({ avaliacoes, decisoes, podeDecidir, ehGerente });
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
