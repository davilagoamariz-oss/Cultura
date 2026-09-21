import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useSessao } from '../nucleo/Sessao.jsx';
import { db } from '../nucleo/firebase.js';
import { caminhos } from '../nucleo/caminhos.js';
import { useOnline } from '../offline/useOnline.js';
import { carregarFicha, comId } from '../campo/repositorio.js';
import { listarCulturas } from './repositorio.js';

const comIds = (mapa) => Object.entries(mapa ?? {}).map(([id, d]) => ({ ...d, id }));

/**
 * Culturas do catálogo e a ficha vigente de cada uma. Só leitura; devolve `null` enquanto carrega.
 * (Cada cultura tem a sua ficha: o formulário de talhão pede os atributos que ela usa.)
 */
export function useCatalogo() {
  const [catalogo, setCatalogo] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const culturas = await listarCulturas(db);
        const fichasPorCultura = {};
        for (const c of culturas) {
          if (c.fichaAtual) fichasPorCultura[c.id] = await carregarFicha(db, c.fichaAtual.fichaId, c.fichaAtual.versao);
        }
        if (vivo) setCatalogo({ culturas, fichasPorCultura });
      } catch (e) {
        if (vivo) setErro(`Não foi possível carregar o catálogo (${e.code ?? 'erro'}).`);
      }
    })();
    return () => { vivo = false; };
  }, []);
  return { catalogo, erroCatalogo: erro };
}

/** Executa uma gravação: só com conexão (a administração confirma no servidor), mostra o aviso ou o erro. */
export function useExecutar() {
  const online = useOnline();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const executar = useCallback(async (acao, textoOk) => {
    setErro(null);
    setAviso(null);
    if (!online) {
      setErro('Sem conexão. A administração precisa de internet para gravar.');
      return false;
    }
    setOcupado(true);
    try {
      await acao();
      setAviso(textoOk);
      return true;
    } catch (e) {
      setErro(e.code === 'permission-denied' ? 'O servidor recusou. Confira se você ainda é administrador da empresa.' : e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }, [online]);
  return { executar, ocupado, erro, aviso, setErro, online };
}

/** O que as telas de cadastro da empresa precisam da sessão: unidades e setores (ao vivo) e os talhões (ao vivo). */
export function useCadastroDaEmpresa() {
  const s = useSessao();
  const empresaId = s.empresaId;
  const [talhoes, setTalhoes] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    setTalhoes(null);
    return onSnapshot(
      collection(db, ...caminhos.talhoes(empresaId)),
      (snap) => setTalhoes(snap.docs.map(comId)),
      (e) => setErro(`Não foi possível carregar os talhões (${e.code ?? 'erro'}).`),
    );
  }, [empresaId]);
  const unidades = useMemo(() => comIds(s.unidades), [s.unidades]);
  const setores = useMemo(() => comIds(s.setores), [s.setores]);
  return { db, empresaId, uid: s.user?.uid ?? null, unidades, setores, talhoes, erroTalhoes: erro };
}
