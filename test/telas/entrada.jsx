// Entrada usada SÓ pelo teste de telas: renderiza as telas reais (src/) no servidor, com uma sessão
// de mentira montada pelas mesmas funções do app (menu, permissões). Não roda no navegador.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SessaoContext } from '../../src/nucleo/Sessao.jsx';
import { montarMenu, escolherSetorDoModulo } from '../../src/nucleo/menu.js';
import Layout from '../../src/Layout.jsx';
import Inicio from '../../src/paginas/Inicio.jsx';
import Fitossanidade from '../../src/modulos/fitossanidade/Fitossanidade.jsx';
import Frota from '../../src/modulos/frota/Frota.jsx';
import SemAcesso from '../../src/SemAcesso.jsx';
import Admin from '../../src/admin/Admin.jsx';
import { ListaTalhoes, FormNovaAvaliacao, GradePlantas, FormularioPlanta, ResumoAvaliacao } from '../../src/campo/telas/apresentacao.jsx';
import { PendentesContext } from '../../src/offline/PendentesProvider.jsx';
import { ListaAcompanhamento, DetalheAvaliacao, GestaoVinculos, SeloPendencias } from '../../src/gestao/telas/apresentacao.jsx';
import { Estrutura, Limites, Membros, PublicarFicha, FormTalhao, Maquinas as MaquinasAdmin, FormMaquina, ImportarTalhoes } from '../../src/admin/telas/apresentacao.jsx';
import { Maquinas as MaquinasFrota } from '../../src/frota/telas/apresentacao.jsx';

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

const TELAS = { Layout: () => <Layout><p>conteúdo</p></Layout>, Inicio, Fitossanidade, Frota, SemAcesso, Admin };

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

// ---- telas de campo (apresentação): recebem tudo por propriedades
export const COMPONENTES_CAMPO = { ListaTalhoes, FormNovaAvaliacao, GradePlantas, FormularioPlanta, ResumoAvaliacao };

export function renderizarCampo(nome, props, rota = '/') {
  const Componente = COMPONENTES_CAMPO[nome];
  return renderToString(
    <MemoryRouter initialEntries={[rota]}>
      <Componente {...props} />
    </MemoryRouter>,
  );
}

export function renderizarLayoutComPendentes(sessao, total) {
  return renderToString(
    <SessaoContext.Provider value={sessao}>
      <PendentesContext.Provider value={{ total, definir: () => {} }}>
        <MemoryRouter>
          <Layout><p>conteúdo</p></Layout>
        </MemoryRouter>
      </PendentesContext.Provider>
    </SessaoContext.Provider>,
  );
}

// ---- telas de gestão (apresentação)
export const COMPONENTES_GESTAO = { ListaAcompanhamento, DetalheAvaliacao, GestaoVinculos, SeloPendencias };

export function renderizarGestao(nome, props, rota = '/') {
  const Componente = COMPONENTES_GESTAO[nome];
  return renderToString(
    <MemoryRouter initialEntries={[rota]}>
      <Componente {...props} />
    </MemoryRouter>,
  );
}

// ---- telas de administração do cadastro (apresentação)
export const COMPONENTES_ADMIN = { Estrutura, Limites, Membros, PublicarFicha, FormTalhao, Maquinas: MaquinasAdmin, FormMaquina, ImportarTalhoes };

export function renderizarAdmin(nome, props, rota = '/') {
  const Componente = COMPONENTES_ADMIN[nome];
  return renderToString(
    <MemoryRouter initialEntries={[rota]}>
      <Componente {...props} />
    </MemoryRouter>,
  );
}

// ---- telas da Frota (apresentação)
export const COMPONENTES_FROTA = { Maquinas: MaquinasFrota };

export function renderizarFrota(nome, props, rota = '/') {
  const Componente = COMPONENTES_FROTA[nome];
  return renderToString(
    <MemoryRouter initialEntries={[rota]}>
      <Componente {...props} />
    </MemoryRouter>,
  );
}
