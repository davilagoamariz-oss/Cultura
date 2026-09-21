import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessao } from '../nucleo/Sessao.jsx';
import GestaoDeVinculos from '../gestao/telas/GestaoDeVinculos.jsx';

/** O administrador escolhe um setor da empresa e gerencia os vínculos dele (inclusive promover e ligar pessoas novas). */
export default function AdminVinculos() {
  const { setores, unidades } = useSessao();
  const [escolhido, setEscolhido] = useState(null);
  const lista = Object.entries(setores).map(([setorId, s]) => ({ setorId, nome: s.nome, unidadeId: s.unidadeId, unidadeNome: unidades[s.unidadeId]?.nome ?? null, ativo: s.ativo })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  if (escolhido) {
    return (
      <>
        <button type="button" className="botao botao--contorno" onClick={() => setEscolhido(null)}>
          ‹ Outros setores
        </button>
        <GestaoDeVinculos key={escolhido.setorId} setor={escolhido} titulo="Vínculos" />
      </>
    );
  }
  return (
    <section>
      <h1>Vínculos</h1>
      <p className="lead">Escolha o setor.</p>
      {lista.length === 0 ? (
        <div className="vazio">Ainda não há setores cadastrados nesta empresa.</div>
      ) : (
        <div className="pilha">
          {lista.map((s) => (
            <button key={s.setorId} type="button" className="botao botao--principal botao--cheio" onClick={() => setEscolhido(s)}>
              {s.nome}
              {s.unidadeNome ? ` · ${s.unidadeNome}` : ''}
              {s.ativo ? '' : ' (desativado)'}
            </button>
          ))}
        </div>
      )}
      <p>
        <Link to="/admin">Voltar à administração</Link>
      </p>
    </section>
  );
}
