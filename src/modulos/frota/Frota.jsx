import { Link } from 'react-router-dom';
import { useSessao } from '../../nucleo/Sessao.jsx';
import { nomeDaFuncao, NOMES_PAPEL_VINCULO } from '../registro.js';

const ID = 'frota';

/** Módulo Frota: escolha do setor e o maquinário da fazenda dele. */
export default function Frota() {
  const { menu, setorDoModulo, escolherSetor, limparSetor, vinculoDoSetor } = useSessao();
  const entrada = menu.find((e) => e.modulo.id === ID);
  const setor = setorDoModulo(ID);

  if (!setor) {
    return (
      <section>
        <h1>Frota</h1>
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
      <h1>Frota</h1>
      <p className="lead">
        {setor.nome}
        {setor.unidadeNome ? ` · ${setor.unidadeNome}` : ''} · você é: {quem}
      </p>

      <div className="cartoes">
        <Link to="/frota/maquinas" className="cartao">
          <span className="cartao__titulo">Máquinas</span>
          <span className="cartao__texto">Disponibilidade, combustível e manutenção do maquinário da fazenda.</span>
        </Link>
      </div>

      {entrada.setores.length > 1 && (
        <button className="botao botao--contorno" type="button" onClick={limparSetor}>
          Trocar de setor
        </button>
      )}
    </section>
  );
}
