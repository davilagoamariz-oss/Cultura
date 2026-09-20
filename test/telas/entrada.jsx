// Entrada usada SÓ pelo teste de telas: renderiza as telas reais (src/) no servidor, com uma sessão
// de mentira montada pelas mesmas funções do app (menu, permissões). Não roda no navegador.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SessaoContext } from '../../src/nucleo/Sessao.jsx';
import { montarMenu, escolherSetorDoModulo } from '../../src/nucleo/menu.js';
import Layout from '../../src/Layout.jsx';
import Inicio from '../../src/paginas/Inicio.jsx';
import Fitossanidade from '../../src/modulos/fitossanidade/Fitossanidade.jsx';
import SemAcesso from '../../src/SemAcesso.jsx';

export function sessaoDeMentira({ vinculos = [], setores = {}, unidades = {}, admin = false, plataforma = false, empresas = 1, status = 'ok', setorSalvo = null, nome = 'Fulano' } = {}) {
  const menu = montarMenu({ vinculos, setores, unidades });
  return {
    carregando: false, status, user: { uid: 'u1', email: 'fulano@demo.test' }, nome, ehPlataforma: plataforma,
    empresaId: status === 'ok' ? 'demo-1' : null, empresaNome: 'Fazenda Demonstração',
    membro: { papelEmpresa: admin ? 'admin' : 'membro', ativo: true }, ehAdminEmpresa: admin,
    empresasAtivas: Array.from({ length: empresas }, (_, i) => ({ empresaId: `e${i}`, papelEmpresa: 'membro', ativo: true })),
    estruturaPronta: true, setores, unidades, menu,
    setorDoModulo: (id) => escolherSetorDoModulo(menu.find((e) => e.modulo.id === id), setorSalvo),
    vinculoDoSetor: (sid) => vinculos.find((v) => v.setorId === sid && v.ativo === true) ?? null,
    entrar: () => {}, sair: () => {}, escolherEmpresa: () => {}, trocarEmpresa: () => {}, escolherSetor: () => {}, limparSetor: () => {},
  };
}

const TELAS = { Layout: () => <Layout><p>conteúdo</p></Layout>, Inicio, Fitossanidade, SemAcesso };

export function renderizar(tela, sessao, rota = '/') {
  const Tela = TELAS[tela];
  return renderToString(
    <SessaoContext.Provider value={sessao}>
      <MemoryRouter initialEntries={[rota]}>
        <Tela />
      </MemoryRouter>
    </SessaoContext.Provider>,
  );
}
