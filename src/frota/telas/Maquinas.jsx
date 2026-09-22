import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import Carregando from '../../Carregando.jsx';
import { ouvirMaquinasDaUnidade, iniciarUso, encerrarUso, sugerirManutencao } from '../repositorio.js';
import { useContextoFrota } from './contexto.js';
import { Maquinas as TelaMaquinas } from './apresentacao.jsx';

/** Máquinas da fazenda do setor em uso: quem tem vínculo vê e sinaliza problema; o operador começa e encerra o uso. */
export default function Maquinas() {
  const { db, empresaId, uid, setor, ehOperador } = useContextoFrota();
  const [maquinas, setMaquinas] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!setor) return undefined;
    setMaquinas(null);
    return ouvirMaquinasDaUnidade(db, empresaId, setor.unidadeId, setMaquinas, (e) => setErro(e.code ?? 'erro'));
  }, [db, empresaId, setor]);

  if (!setor) {
    return (
      <Faixa tipo="aviso">
        Escolha o setor primeiro, em <Link to="/frota">Frota</Link>.
      </Faixa>
    );
  }
  if (erro) return <Faixa tipo="erro">Não foi possível carregar as máquinas ({erro}).</Faixa>;
  if (maquinas === null) return <Carregando texto="Carregando máquinas…" />;

  const executar = async (acao) => {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      return true;
    } catch (e) {
      setErro(e.code === 'permission-denied' ? 'O servidor recusou. Confira se você ainda tem a função de operador aqui.' : e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return (
    <TelaMaquinas
      maquinas={[...maquinas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))}
      ehOperador={ehOperador}
      meuUid={uid}
      ocupado={ocupado}
      erro={erro}
      aoIniciar={(m) => executar(() => iniciarUso(db, empresaId, { maquina: m, maquinaId: m.id, uid, setorId: setor.setorId }))}
      aoEncerrar={(m, fd) => executar(() => encerrarUso(db, empresaId, { maquina: m, maquinaId: m.id, uid, combustivel: String(fd.get('combustivel') ?? '') }))}
      aoSugerir={(m, fd) => executar(() => sugerirManutencao(db, empresaId, { maquina: m, maquinaId: m.id, uid, descricao: String(fd.get('descricao') ?? '') }))}
    />
  );
}
