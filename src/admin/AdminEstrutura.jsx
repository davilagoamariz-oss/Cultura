import Carregando from '../Carregando.jsx';
import { Estrutura } from './telas/apresentacao.jsx';
import { useCadastroDaEmpresa, useCatalogo, useExecutar } from './contexto.js';
import { criarUnidade, alterarUnidade, criarSetor, alterarSetor, criarTalhao, alterarTalhao } from './repositorio.js';
import { lerUnidade, lerSetor, lerTalhao } from './formularios.js';

/** Unidades, setores e talhões da empresa. Cada gravação confere os dados (cadastros.js) antes de ir ao servidor. */
export default function AdminEstrutura() {
  const { db, empresaId, unidades, setores, talhoes, erroTalhoes } = useCadastroDaEmpresa();
  const { catalogo, erroCatalogo } = useCatalogo();
  const { executar, ocupado, erro, aviso } = useExecutar();

  if ((talhoes === null || catalogo === null) && !erroTalhoes && !erroCatalogo) return <Carregando texto="Carregando o cadastro…" />;
  const { culturas = [], fichasPorCultura = {} } = catalogo ?? {};
  const ids = (lista) => lista.map((x) => x.id);
  const fichaDe = (culturaId) => fichasPorCultura[culturaId];

  const acoes = {
    aoCriarUnidade: (fd) => executar(() => criarUnidade(db, empresaId, lerUnidade(fd), ids(unidades)), 'Unidade criada.'),
    aoAlterarUnidade: (id, fd) => executar(() => alterarUnidade(db, empresaId, id, lerUnidade(fd)), 'Unidade atualizada.'),
    aoCriarSetor: (unidadeId, fd) => executar(() => criarSetor(db, empresaId, { ...lerSetor(fd), unidadeId }, ids(setores)), 'Setor criado.'),
    aoAlterarSetor: (s, fd) => executar(() => alterarSetor(db, empresaId, s.id, { ...lerSetor(fd), unidadeId: s.unidadeId }), 'Setor atualizado.'),
    aoCriarTalhao: (unidadeId, fd) => {
      const d = lerTalhao(fd, fichasPorCultura);
      return executar(() => criarTalhao(db, empresaId, { ...d, ficha: fichaDe(d.culturaId), unidadeId }, ids(talhoes ?? [])), 'Talhão criado.');
    },
    aoAlterarTalhao: (t, fd) => {
      const d = lerTalhao(fd, fichasPorCultura);
      return executar(() => alterarTalhao(db, empresaId, t.id, { ...d, ficha: fichaDe(t.culturaId), unidadeId: t.unidadeId, culturaId: t.culturaId }), 'Talhão atualizado.');
    },
  };

  return (
    <Estrutura
      unidades={unidades} setores={setores} talhoes={talhoes ?? []} culturas={culturas} fichasPorCultura={fichasPorCultura}
      ocupado={ocupado} erro={erro ?? erroTalhoes ?? erroCatalogo} aviso={aviso} {...acoes}
    />
  );
}
