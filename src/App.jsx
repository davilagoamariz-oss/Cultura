import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessaoProvider, useSessao } from './nucleo/Sessao.jsx';
import { destinoDaRaiz } from './nucleo/acesso.js';
import { RequerEmpresa, RequerModulo, RequerAdminEmpresa, RequerPlataforma } from './rotas.jsx';
import Login from './Login.jsx';
import SemAcesso from './SemAcesso.jsx';
import EscolherEmpresa from './EscolherEmpresa.jsx';
import Carregando from './Carregando.jsx';
import Inicio from './paginas/Inicio.jsx';
import Fitossanidade from './modulos/fitossanidade/Fitossanidade.jsx';
import Frota from './modulos/frota/Frota.jsx';
import Maquinas from './frota/telas/Maquinas.jsx';
import Campo from './campo/telas/Campo.jsx';
import NovaAvaliacao from './campo/telas/NovaAvaliacao.jsx';
import Avaliacao from './campo/telas/Avaliacao.jsx';
import EditorPlanta from './campo/telas/EditorPlanta.jsx';
import Resumo from './campo/telas/Resumo.jsx';
import Acompanhamento from './gestao/telas/Acompanhamento.jsx';
import Comparativo from './gestao/telas/Comparativo.jsx';
import DetalheDaAvaliacao from './gestao/telas/DetalheDaAvaliacao.jsx';
import VinculosDoSetor from './gestao/telas/VinculosDoSetor.jsx';
import AdminVinculos from './admin/AdminVinculos.jsx';
import AdminEstrutura from './admin/AdminEstrutura.jsx';
import AdminLimites from './admin/AdminLimites.jsx';
import AdminMembros from './admin/AdminMembros.jsx';
import AdminMaquinas from './admin/AdminMaquinas.jsx';
import { PendentesProvider } from './offline/PendentesProvider.jsx';
import Admin from './admin/Admin.jsx';
import Plataforma from './plataforma/Plataforma.jsx';

/** "/" decide para onde ir depois do login. */
function Raiz() {
  const destino = destinoDaRaiz(useSessao());
  return destino ? <Navigate to={destino} replace /> : <Carregando />;
}

export default function App() {
  return (
    <SessaoProvider>
      <PendentesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Raiz />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sem-acesso" element={<SemAcesso />} />
          <Route path="/escolher-empresa" element={<EscolherEmpresa />} />

          <Route element={<RequerEmpresa />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route element={<RequerModulo modulo="fitossanidade" />}>
              <Route path="/fitossanidade" element={<Fitossanidade />} />
              <Route path="/fitossanidade/campo" element={<Campo />} />
              <Route path="/fitossanidade/campo/novo/:talhaoId" element={<NovaAvaliacao />} />
              <Route path="/fitossanidade/campo/:aid" element={<Avaliacao />} />
              <Route path="/fitossanidade/campo/:aid/planta/:n" element={<EditorPlanta />} />
              <Route path="/fitossanidade/campo/:aid/resumo" element={<Resumo />} />
              <Route path="/fitossanidade/acompanhamento" element={<Acompanhamento />} />
              <Route path="/fitossanidade/acompanhamento/comparativo" element={<Comparativo />} />
              <Route path="/fitossanidade/acompanhamento/:aid" element={<DetalheDaAvaliacao />} />
              <Route path="/fitossanidade/vinculos" element={<VinculosDoSetor />} />
            </Route>
            <Route element={<RequerModulo modulo="frota" />}>
              <Route path="/frota" element={<Frota />} />
              <Route path="/frota/maquinas" element={<Maquinas />} />
            </Route>
            <Route element={<RequerAdminEmpresa />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/vinculos" element={<AdminVinculos />} />
              <Route path="/admin/estrutura" element={<AdminEstrutura />} />
              <Route path="/admin/limites" element={<AdminLimites />} />
              <Route path="/admin/membros" element={<AdminMembros />} />
              <Route path="/admin/maquinas" element={<AdminMaquinas />} />
            </Route>
          </Route>

          <Route element={<RequerPlataforma />}>
            <Route path="/plataforma" element={<Plataforma />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </PendentesProvider>
    </SessaoProvider>
  );
}
