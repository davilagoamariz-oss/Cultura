import { useEffect, useState } from 'react';
import Carregando from '../Carregando.jsx';
import { Maquinas } from './telas/apresentacao.jsx';
import { useCadastroDaEmpresa, useExecutar } from './contexto.js';
import { listarMaquinas, criarMaquina, editarMaquina, alterarStatusManutencao } from '../frota/repositorio.js';
import { lerMaquina, lerDescricao } from './formularios.js';

/** Cadastro do maquinário (Frota): admin cria/edita a máquina e cuida da manutenção (marcar urgente, concluir). */
export default function AdminMaquinas() {
  const { db, empresaId, unidades, uid } = useCadastroDaEmpresa();
  const { executar, ocupado, erro, aviso } = useExecutar();
  const [maquinas, setMaquinas] = useState(null);
  const [erroLista, setErroLista] = useState(null);

  const carregar = () => listarMaquinas(db, empresaId).then(setMaquinas).catch((e) => setErroLista(`Não foi possível carregar as máquinas (${e.code ?? 'erro'}).`));
  useEffect(() => { carregar(); }, [db, empresaId]);

  if (maquinas === null && !erroLista) return <Carregando texto="Carregando o maquinário…" />;
  const ids = (maquinas ?? []).map((m) => m.id);
  const depois = async (ok) => { if (ok) await carregar(); return ok; };

  return (
    <Maquinas
      unidades={unidades}
      maquinas={maquinas ?? []}
      ocupado={ocupado}
      erro={erro ?? erroLista}
      aviso={aviso}
      aoCriar={(unidadeId, fd) => depois(executar(() => criarMaquina(db, empresaId, { ...lerMaquina(fd), unidadeId }, ids), 'Máquina cadastrada.'))}
      aoAlterar={(m, fd) => depois(executar(() => editarMaquina(db, empresaId, m.id, lerMaquina(fd)), 'Máquina atualizada.'))}
      aoMarcarUrgente={(m, fd) => depois(executar(() => alterarStatusManutencao(db, empresaId, { maquina: m, maquinaId: m.id, uid, novoStatus: 'precisa_manutencao', descricao: lerDescricao(fd) }), 'Máquina marcada como precisa de manutenção.'))}
      aoConcluir={(m, fd) => depois(executar(() => alterarStatusManutencao(db, empresaId, { maquina: m, maquinaId: m.id, uid, novoStatus: 'operacional', descricao: lerDescricao(fd) }), 'Manutenção concluída: a máquina volta a operacional.'))}
    />
  );
}
