// Componentes de apresentação do acompanhamento e da gestão de vínculos: recebem tudo por propriedades
// (sem Firebase), então podem ser renderizados e testados sozinhos.
import { Link } from 'react-router-dom';
import { BlocoResultado, Faixa } from '../../campo/telas/apresentacao.jsx';
import { ROTULO_STATUS_DECISAO } from '../decisao.js';
import { FUNCOES, NOMES_FUNCAO } from '../vinculos.js';
import { NOMES_PAPEL_VINCULO } from '../../modulos/registro.js';
import { grupoDaLinha, resumirSemana } from '../acompanhamento.js';

export const rotaAcompanhamento = (...partes) => ['/fitossanidade/acompanhamento', ...partes].join('/');

/** Selo com o total de itens que esperam a ação da pessoa (aguardando decisão ou execução), na aba do módulo. */
export function SeloPendencias({ total }) {
  if (!total) return null;
  return (
    <span className="selo selo--alerta" aria-label={`${total} aguardando você`}>
      {total}
    </span>
  );
}

// ---------------------------------------------------------------- lista da semana

const GRUPOS = [
  { chave: 'aguardando_decisao', titulo: 'Aguardando decisão do agrônomo' },
  { chave: 'aprovada', titulo: 'Aprovadas, aguardando execução' },
  { chave: 'concluida', titulo: 'Concluídas' },
  { chave: 'em_andamento', titulo: 'Em andamento (o pragueiro ainda está avaliando)' },
];

const ROTULO_RESUMO = {
  aguardando_decisao: 'aguardando decisão', aprovada: 'aguardando execução', concluida: 'concluída', em_andamento: 'em andamento',
};

function ResumoDaSemana({ resumo }) {
  const partes = ['aguardando_decisao', 'aprovada', 'em_andamento', 'concluida'].filter((chave) => resumo[chave] > 0);
  return (
    <p className="lead" aria-label="Resumo da semana">
      <b>{resumo.total}</b> avaliaç{resumo.total === 1 ? 'ão' : 'ões'}
      {partes.length > 0 ? ': ' : ''}
      {partes.map((chave, i) => (
        <span key={chave}>
          {i > 0 ? ' · ' : ''}
          <b>{resumo[chave]}</b> {ROTULO_RESUMO[chave]}
        </span>
      ))}
    </p>
  );
}

export function ListaAcompanhamento({ semana, rotuloSemana, semanaAnterior, semanaSeguinte, ehSemanaAtual, linhas, aoExportar }) {
  return (
    <section>
      <h1>Acompanhar avaliações</h1>
      <nav className="semana-nav" aria-label="Semana">
        <Link to={`?semana=${semanaAnterior}`} className="botao botao--contorno">
          ‹ Anterior
        </Link>
        <span className="semana-nav__meio">
          <b>{semana}</b>
          <span className="linha-item__dica">{rotuloSemana}{ehSemanaAtual ? ' · esta semana' : ''}</span>
        </span>
        <Link to={`?semana=${semanaSeguinte}`} className="botao botao--contorno">
          Próxima ›
        </Link>
      </nav>
      {linhas.length > 0 && (
        <>
          <ResumoDaSemana resumo={resumirSemana(linhas)} />
          <button type="button" className="botao botao--contorno" onClick={aoExportar}>
            Exportar esta semana (CSV)
          </button>
        </>
      )}

      {linhas.length === 0 ? (
        <div className="vazio">Nenhuma avaliação neste setor nesta semana.</div>
      ) : (
        GRUPOS.map((g) => {
          const doGrupo = linhas.filter((l) => grupoDaLinha(l) === g.chave);
          if (doGrupo.length === 0) return null;
          return (
            <div key={g.chave} className="secao-resumo">
              <h2>
                {g.titulo} ({doGrupo.length})
              </h2>
              <div className="pilha">
                {doGrupo.map((l) => (
                  <Link key={l.id} to={rotaAcompanhamento(l.id)} className="cartao cartao--linha">
                    <span className="cartao__titulo">{l.talhaoNome}</span>
                    <span className="cartao__texto">
                      {l.pragueiro} · inspeção em {l.dataTexto}
                    </span>
                    <span className="cartao__rodape">
                      {l.status !== 'finalizada' ? 'Em andamento' : l.decisaoStatus ? ROTULO_STATUS_DECISAO[l.decisaoStatus] : 'Finalizada'}
                      {l.pendente ? ' · aguardando envio' : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

// ---------------------------------------------------------------- detalhe, decisão e execução

function Armadilha({ armadilha }) {
  const { atual, anterior, semanaAnterior } = armadilha;
  const texto = (v) => (v === null || v === undefined ? 'não informado' : String(v));
  return (
    <div className="faixa faixa--info">
      <b>Armadilha do bicho-furão (adultos):</b> esta semana {texto(atual)} · semana anterior ({semanaAnterior}) {texto(anterior)}.
      <span className="linha-item__dica">A regra do bicho-furão (6 adultos em duas semanas seguidas, ou 10) ainda não foi confirmada: os números ficam aqui para você cruzar; não entram no cálculo.</span>
    </div>
  );
}

function DecisaoRegistrada({ decisao, tdsTexto, nomes }) {
  return (
    <div className="faixa faixa--ok">
      <b>
        {ROTULO_STATUS_DECISAO[decisao.status]}
        {decisao.pendente ? ' (aguardando envio)' : ''}
      </b>
      <div>
        Tomadas de decisão: {decisao.tds.map((t) => `${t}${tdsTexto[t] ? ` (${tdsTexto[t]})` : ''}`).join(', ')}
      </div>
      {decisao.observacao && <div>Observação do agrônomo: {decisao.observacao}</div>}
      <span className="linha-item__dica">
        Decidida por {nomes[decisao.decididoPor]} {decisao.decididoQuando ? `em ${decisao.decididoQuando}` : ''}
      </span>
      {decisao.executadoPor && (
        <div>
          Executada por {nomes[decisao.executadoPor]} {decisao.executadoQuando ? `em ${decisao.executadoQuando}` : ''}
          {decisao.observacaoExecucao ? `: ${decisao.observacaoExecucao}` : ''}
        </div>
      )}
    </div>
  );
}

function FormularioDecisao({ modelo, tdsDisponiveis, formulario, aoMudar, aoDecidir, decidindo, confirmando, aoConfirmar }) {
  const pediuRevisao = modelo.tds.some((t) => t.codigo === 'REVISAR');
  const alternarTd = (codigo) => {
    const tem = formulario.tds.includes(codigo);
    aoMudar({ tds: tem ? formulario.tds.filter((t) => t !== codigo) : [...formulario.tds, codigo] });
  };
  return (
    <form
      className="finalizar"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmando) aoDecidir();
        else aoConfirmar();
      }}
    >
      <h2>Sua decisão</h2>
      {pediuRevisao && <Faixa tipo="aviso">O cálculo pediu revisão: há praga detectada sem limite definido. Escolha você as tomadas de decisão.</Faixa>}

      <fieldset className="chips">
        <legend>Decisão</legend>
        {[['aprovada', 'Aprovar: executar as tomadas de decisão abaixo'], ['rejeitada', 'Rejeitar a sugestão (explique na observação)']].map(([valor, rotulo]) => (
          <label key={valor} className={`chip${formulario.status === valor ? ' chip--ligado' : ''}`}>
            <input type="radio" name="status-decisao" checked={formulario.status === valor} onChange={() => aoMudar({ status: valor })} />
            {rotulo}
          </label>
        ))}
      </fieldset>

      <fieldset className="chips">
        <legend>Tomadas de decisão</legend>
        {tdsDisponiveis.map((t) => (
          <label key={t.codigo} className={`chip${formulario.tds.includes(t.codigo) ? ' chip--ligado' : ''}`}>
            <input type="checkbox" checked={formulario.tds.includes(t.codigo)} onChange={() => alternarTd(t.codigo)} />
            {t.codigo} · {t.texto}
          </label>
        ))}
      </fieldset>

      <label className="campo">
        <span>Observação {formulario.status === 'rejeitada' ? '(obrigatória para rejeitar)' : '(opcional)'}</span>
        <textarea rows={3} maxLength={1000} value={formulario.observacao} onChange={(e) => aoMudar({ observacao: e.target.value })} />
      </label>
      {confirmando && <Faixa tipo="aviso">A decisão fica registrada e não pode ser alterada depois. Confirma?</Faixa>}
      <button className="botao botao--principal botao--cheio" type="submit" disabled={decidindo}>
        {decidindo ? 'Registrando…' : confirmando ? 'Sim, registrar a decisão' : 'Registrar decisão'}
      </button>
    </form>
  );
}

function FormularioExecucao({ observacao, aoMudar, aoExecutar, executando, confirmando, aoConfirmar }) {
  return (
    <form
      className="finalizar"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmando) aoExecutar();
        else aoConfirmar();
      }}
    >
      <h2>Execução</h2>
      <label className="campo">
        <span>O que foi feito (opcional)</span>
        <textarea rows={3} maxLength={1000} value={observacao} onChange={(e) => aoMudar(e.target.value)} />
      </label>
      {confirmando && <Faixa tipo="aviso">Depois de marcar como executada, não dá para desfazer. Confirma?</Faixa>}
      <button className="botao botao--principal botao--cheio" type="submit" disabled={executando}>
        {executando ? 'Registrando…' : confirmando ? 'Sim, marcar como executada' : 'Marcar como executada'}
      </button>
    </form>
  );
}

export function DetalheAvaliacao({
  titulo, semana, dataTexto, pragueiro, fichaVersao, avaliacao, modelo, prazo, armadilha, situacao, decisao, tdsDisponiveis, tdsTexto, nomes,
  formulario, aoMudarFormulario, aoDecidir, decidindo, confirmandoDecisao, aoConfirmarDecisao,
  execObservacao, aoMudarExecObservacao, aoExecutar, executando, confirmandoExecucao, aoConfirmarExecucao, erro,
}) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p className="lead">
        Semana {semana} · inspeção em {dataTexto} · pragueiro: {pragueiro} · ficha v{fichaVersao}
      </p>
      {erro && <Faixa tipo="erro">{erro}</Faixa>}
      {prazo && situacao.fase !== 'executada' && situacao.fase !== 'rejeitada' && situacao.fase !== 'em_andamento' && <Faixa tipo={prazo.atrasado ? 'aviso' : 'info'}>{prazo.texto}</Faixa>}
      {situacao.fase === 'em_andamento' && <Faixa tipo="aviso">O pragueiro ainda não finalizou esta avaliação. O resultado abaixo é uma prévia.</Faixa>}

      <BlocoResultado modelo={modelo} />
      <Armadilha armadilha={armadilha} />
      {avaliacao.outrasPragas && <Faixa tipo="info"><b>Outras pragas informadas:</b> {avaliacao.outrasPragas}</Faixa>}
      {avaliacao.notas && <Faixa tipo="info"><b>Observações do pragueiro:</b> {avaliacao.notas}</Faixa>}

      {situacao.fase === 'aguardando_decisao' && !situacao.podeDecidir && <Faixa tipo="aviso">Aguardando a decisão do agrônomo.</Faixa>}
      {situacao.fase === 'aguardando_decisao' && situacao.podeDecidir && (
        <FormularioDecisao modelo={modelo} tdsDisponiveis={tdsDisponiveis} formulario={formulario} aoMudar={aoMudarFormulario} aoDecidir={aoDecidir} decidindo={decidindo} confirmando={confirmandoDecisao} aoConfirmar={aoConfirmarDecisao} />
      )}
      {decisao && <DecisaoRegistrada decisao={decisao} tdsTexto={tdsTexto} nomes={nomes} />}
      {situacao.fase === 'aprovada' && !situacao.podeExecutar && <Faixa tipo="aviso">Aguardando a execução pelo gerente do setor.</Faixa>}
      {situacao.fase === 'aprovada' && situacao.podeExecutar && (
        <FormularioExecucao observacao={execObservacao} aoMudar={aoMudarExecObservacao} aoExecutar={aoExecutar} executando={executando} confirmando={confirmandoExecucao} aoConfirmar={aoConfirmarExecucao} />
      )}
      <p>
        <Link to={`${rotaAcompanhamento()}?semana=${semana}`}>Voltar à lista da semana</Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- vínculos

export function GestaoVinculos({
  titulo, setorNome, linhas, podeAdicionar, motivoSemAdicionar, candidatos, formNovo, aoMudarFormNovo, aoLigar, ligando, podeEscolherPapel,
  historicoAberto, aoAbrirHistorico, aoAlterar, ocupado, erro,
}) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p className="lead">{setorNome}</p>
      {erro && <Faixa tipo="erro">{erro}</Faixa>}

      {linhas.length === 0 ? (
        <div className="vazio">Ninguém está ligado a este setor.</div>
      ) : (
        <div className="pilha">
          {linhas.map((l) => (
            <article key={l.id} className={`vinculo${l.ativo ? '' : ' vinculo--inativo'}`}>
              <header className="vinculo__topo">
                <b>{l.nome}</b>
                <span className="selo">{NOMES_PAPEL_VINCULO[l.papel]}</span>
                {!l.ativo && <span className="selo selo--alerta">Desativado</span>}
                <span className="linha-item__dica">versão {l.versao}</span>
              </header>

              <fieldset className="chips" disabled={!l.pode || ocupado}>
                <legend>Funções</legend>
                {FUNCOES.map((f) => (
                  <label key={f} className={`chip${l.funcoes.includes(f) ? ' chip--ligado' : ''}`}>
                    <input
                      type="checkbox"
                      checked={l.funcoes.includes(f)}
                      onChange={() => aoAlterar(l, { funcoes: l.funcoes.includes(f) ? l.funcoes.filter((x) => x !== f) : [...l.funcoes, f] })}
                    />
                    {NOMES_FUNCAO[f]}
                  </label>
                ))}
              </fieldset>

              {l.pode ? (
                <div className="grupo__acoes">
                  <button type="button" className="botao botao--contorno" disabled={ocupado} onClick={() => aoAlterar(l, { ativo: !l.ativo })}>
                    {l.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                  {l.podeMudarPapel && (
                    <button type="button" className="botao botao--contorno" disabled={ocupado} onClick={() => aoAlterar(l, { papel: l.papel === 'gerente' ? 'funcionario' : 'gerente' })}>
                      {l.papel === 'gerente' ? 'Passar a funcionário' : 'Promover a gerente'}
                    </button>
                  )}
                  <button type="button" className="botao botao--contorno" onClick={() => aoAbrirHistorico(l)}>
                    {historicoAberto?.id === l.id ? 'Esconder histórico' : 'Ver histórico'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="linha-item__dica">{l.motivo}</p>
                  <div className="grupo__acoes">
                    <button type="button" className="botao botao--contorno" onClick={() => aoAbrirHistorico(l)}>
                      {historicoAberto?.id === l.id ? 'Esconder histórico' : 'Ver histórico'}
                    </button>
                  </div>
                </>
              )}

              {historicoAberto?.id === l.id && (
                <ol className="historico" aria-label={`Histórico de ${l.nome}`}>
                  {historicoAberto.linhas.length === 0 ? <li>Carregando…</li> : historicoAberto.linhas.map((h) => (
                    <li key={h.versao}>
                      <b>Versão {h.versao}</b> · {h.quandoTexto || 'aguardando envio'} · {h.quemNome}
                      <ul>
                        {h.mudancas.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="finalizar">
        <h2>Ligar uma pessoa a este setor</h2>
        {!podeAdicionar ? (
          <Faixa tipo="aviso">{motivoSemAdicionar}</Faixa>
        ) : candidatos.length === 0 ? (
          <p className="lead">Todos os membros ativos da empresa já estão ligados a este setor.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              aoLigar();
            }}
          >
            <label className="campo">
              <span>Pessoa</span>
              <select value={formNovo.pessoaUid} onChange={(e) => aoMudarFormNovo({ pessoaUid: e.target.value })}>
                <option value="">Escolha…</option>
                {candidatos.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.nome ?? c.uid}
                  </option>
                ))}
              </select>
            </label>
            {podeEscolherPapel && (
              <label className="campo">
                <span>Papel</span>
                <select value={formNovo.papel} onChange={(e) => aoMudarFormNovo({ papel: e.target.value })}>
                  <option value="funcionario">Funcionário</option>
                  <option value="gerente">Gerente</option>
                </select>
              </label>
            )}
            <fieldset className="chips">
              <legend>Funções</legend>
              {FUNCOES.map((f) => (
                <label key={f} className={`chip${formNovo.funcoes.includes(f) ? ' chip--ligado' : ''}`}>
                  <input type="checkbox" checked={formNovo.funcoes.includes(f)} onChange={() => aoMudarFormNovo({ funcoes: formNovo.funcoes.includes(f) ? formNovo.funcoes.filter((x) => x !== f) : [...formNovo.funcoes, f] })} />
                  {NOMES_FUNCAO[f]}
                </label>
              ))}
            </fieldset>
            <button className="botao botao--principal botao--cheio" type="submit" disabled={ligando || !formNovo.pessoaUid}>
              {ligando ? 'Ligando…' : 'Ligar ao setor'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
