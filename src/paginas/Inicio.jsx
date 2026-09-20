import { Link } from 'react-router-dom';
import { useSessao } from '../nucleo/Sessao.jsx';
import { nomeDaFuncao, NOMES_PAPEL_VINCULO } from '../modulos/registro.js';
import Carregando from '../Carregando.jsx';

/** Resumo do que a pessoa é em cada setor do módulo (ex.: "Pragueiro" ou "Gerente"). */
function papeisNoModulo(setores) {
  const nomes = new Set();
  for (const s of setores) {
    if (s.papel === 'gerente') nomes.add(NOMES_PAPEL_VINCULO.gerente);
    for (const f of s.funcoes) nomes.add(nomeDaFuncao(f));
  }
  return [...nomes].join(', ') || NOMES_PAPEL_VINCULO.funcionario;
}

/** Tela inicial: só os módulos dos setores onde a pessoa tem vínculo. */
export default function Inicio() {
  const { estruturaPronta, menu, ehAdminEmpresa, empresaNome } = useSessao();
  if (!estruturaPronta) return <Carregando texto="Carregando…" />;

  return (
    <section>
      <h1>{empresaNome ?? 'Início'}</h1>

      {menu.length === 0 ? (
        <div className="vazio">
          <h2>Nenhum módulo disponível para você</h2>
          <p>
            Você ainda não tem vínculo com um setor que use um módulo já disponível no app. Peça ao
            administrador da empresa ou ao gerente do seu setor para ligar você ao setor certo.
          </p>
        </div>
      ) : (
        <div className="cartoes">
          {menu.map((e) => (
            <Link key={e.modulo.id} to={e.modulo.rota} className="cartao">
              <span className="cartao__titulo">{e.modulo.rotulo}</span>
              <span className="cartao__texto">{e.modulo.descricao}</span>
              <span className="cartao__rodape">
                {papeisNoModulo(e.setores)} · {e.setores.length === 1 ? e.setores[0].nome : `${e.setores.length} setores`}
              </span>
            </Link>
          ))}
        </div>
      )}

      {ehAdminEmpresa && (
        <p className="lead">
          Como administrador, você gerencia unidades, setores, talhões e vínculos em <Link to="/admin">Administração</Link>. Para ver
          dados de um setor, você precisa ter vínculo nele.
        </p>
      )}
    </section>
  );
}
