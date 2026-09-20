import { useSessao } from '../../nucleo/Sessao.jsx';
import { podeAvaliar, podeAcompanhar, ehGerenteDoSetor } from '../../nucleo/permissoes.js';
import { nomeDaFuncao, NOMES_PAPEL_VINCULO } from '../registro.js';

const ID = 'fitossanidade';

/** Módulo Fitossanidade: escolha do setor e as áreas permitidas pela função no setor. */
export default function Fitossanidade() {
  const { menu, setorDoModulo, escolherSetor, limparSetor, vinculoDoSetor } = useSessao();
  const entrada = menu.find((e) => e.modulo.id === ID);
  const setor = setorDoModulo(ID);

  if (!setor) {
    return (
      <section>
        <h1>Fitossanidade</h1>
        <h2>Escolha o setor</h2>
        <div className="pilha">
          {entrada.setores.map((s) => (
            <button key={s.setorId} className="botao botao--principal botao--cheio" type="button" onClick={() => escolherSetor(s.setorId)}>
              {s.nome}
              {s.unidadeNome ? ` · ${s.unidadeNome}` : ''}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const vinculo = vinculoDoSetor(setor.setorId);
  const funcoes = setor.funcoes.map(nomeDaFuncao);
  const quem = [setor.papel === 'gerente' ? NOMES_PAPEL_VINCULO.gerente : null, ...funcoes].filter(Boolean).join(', ') || NOMES_PAPEL_VINCULO.funcionario;

  return (
    <section>
      <h1>Fitossanidade</h1>
      <p className="lead">
        {setor.nome}
        {setor.unidadeNome ? ` · ${setor.unidadeNome}` : ''} · você é: {quem}
      </p>

      <div className="cartoes">
        {podeAvaliar(vinculo) && (
          <div className="cartao cartao--espera" aria-disabled="true">
            <span className="cartao__titulo">Avaliar plantas</span>
            <span className="cartao__texto">Ficha de campo por planta, funciona sem internet.</span>
            <span className="selo">Próxima fase</span>
          </div>
        )}
        {podeAcompanhar(vinculo) && (
          <div className="cartao cartao--espera" aria-disabled="true">
            <span className="cartao__titulo">Acompanhar avaliações</span>
            <span className="cartao__texto">Avaliações da semana, nível de infestação e decisão de controle.</span>
            <span className="selo">Próxima fase</span>
          </div>
        )}
        {ehGerenteDoSetor(vinculo) && (
          <div className="cartao cartao--espera" aria-disabled="true">
            <span className="cartao__titulo">Vínculos do setor</span>
            <span className="cartao__texto">Quem trabalha neste setor e o que cada pessoa faz.</span>
            <span className="selo">Próxima fase</span>
          </div>
        )}
      </div>

      {entrada.setores.length > 1 && (
        <button className="botao botao--contorno" type="button" onClick={limparSetor}>
          Trocar de setor
        </button>
      )}
    </section>
  );
}
