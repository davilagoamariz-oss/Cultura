import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { consultaTalhoes, consultaMinhasDaSemana, consultaMeusRascunhos, comId } from '../repositorio.js';
import { semanaISO } from '../semana.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import Carregando from '../../Carregando.jsx';
import { useContextoCampo } from './contexto.js';
import { ListaTalhoes, Faixa } from './apresentacao.jsx';

/** Tela de entrada do campo: os talhões da unidade do setor, com a situação de cada um nesta semana. */
export default function Campo() {
  const { db, empresaId, uid, setor, pode } = useContextoCampo();
  const semana = useMemo(() => semanaISO(), []);
  const [talhoes, setTalhoes] = useState(null);
  const [daSemana, setDaSemana] = useState(null);
  const [rascunhos, setRascunhos] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!pode) return undefined;
    const falha = (e) => setErro(e.code ?? 'erro');
    const opcoes = { includeMetadataChanges: true };
    const cancelar = [
      onSnapshot(consultaTalhoes(db, empresaId, setor.unidadeId), (s) => setTalhoes(s.docs.map(comId)), falha),
      onSnapshot(consultaMinhasDaSemana(db, empresaId, setor.setorId, uid, semana), opcoes, (s) => setDaSemana(s.docs.map((d) => ({ ...comId(d), pendente: d.metadata.hasPendingWrites }))), falha),
      onSnapshot(consultaMeusRascunhos(db, empresaId, setor.setorId, uid), (s) => setRascunhos(s.docs.map(comId)), falha),
    ];
    return () => cancelar.forEach((f) => f());
  }, [db, empresaId, uid, setor, pode, semana]);

  const pendentesPorId = useMemo(() => Object.fromEntries((daSemana ?? []).filter((a) => a.pendente).map((a) => [a.id, true])), [daSemana]);
  useRegistrarPendentes('avaliacoes', Object.keys(pendentesPorId).length);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não tem a função de pragueiro neste setor, então não avalia plantas aqui.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível carregar os talhões ({erro}). Tente de novo.</Faixa>;
  if (talhoes === null || daSemana === null || rascunhos === null) return <Carregando texto="Carregando talhões…" />;

  const porTalhao = Object.fromEntries(daSemana.map((a) => [a.talhaoId, a]));
  const ordenados = [...talhoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  return <ListaTalhoes semana={semana} talhoes={ordenados} porTalhao={porTalhao} rascunhos={rascunhos} pendentesPorId={pendentesPorId} />;
}

export function SemSetor() {
  return (
    <Faixa tipo="aviso">
      Escolha o setor primeiro, em <Link to="/fitossanidade">Fitossanidade</Link>.
    </Faixa>
  );
}
