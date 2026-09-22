// Componentes de apresentação do módulo de campo: recebem tudo por propriedades (sem Firebase), então
// podem ser renderizados e testados sozinhos. Os contêineres (Campo, Avaliacao...) os ligam aos dados.
import { Link } from 'react-router-dom';
import { agruparPorOrgao, quadrantesDoItem, itemCompleto, grupoCompleto, LEGENDA_INTENSIDADE } from '../ficha-campo.js';
import { rotaCampo } from './contexto.js';

export function Faixa({ tipo = 'info', children }) {
  return (
    <div className={`faixa faixa--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- lista de talhões

const ROTULO_ATRIBUTOS = { adulto: 'pomar adulto', novo: 'pomar novo' };

export function ListaTalhoes({ semana, talhoes, porTalhao, rascunhos, pendentesPorId = {} }) {
  const emAndamento = rascunhos.filter((r) => r.semanaISO !== semana);
  return (
    <section>
      <h1>Avaliar plantas</h1>
      <p className="lead">Semana {semana}. Escolha o talhão.</p>

      {emAndamento.length > 0 && (
        <>
          <h2>Em andamento de outras semanas</h2>
          <div className="pilha">
            {emAndamento.map((r) => (
              <Link key={r.id} to={rotaCampo(r.id)} className="cartao cartao--linha">
                <span className="cartao__titulo">{r.talhaoId}</span>
                <span className="cartao__texto">Semana {r.semanaISO} · continuar</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2>Talhões</h2>
      {talhoes.length === 0 ? (
        <div className="vazio">Nenhum talhão ativo nesta unidade. Peça ao administrador para cadastrar.</div>
      ) : (
        <div className="pilha">
          {talhoes.map((t) => {
            const av = porTalhao[t.id];
            const destino = !av ? `${rotaCampo('novo', t.id)}` : av.status === 'rascunho' ? rotaCampo(av.id) : rotaCampo(av.id, 'resumo');
            const selo = !av ? null : av.status === 'rascunho' ? 'Em andamento' : 'Finalizada';
            return (
              <Link key={t.id} to={destino} className={`cartao cartao--linha${av?.status === 'finalizada' ? ' cartao--feito' : ''}`}>
                <span className="cartao__titulo">{t.nome}</span>
                <span className="cartao__texto">
                  {[t.areaHa ? `${String(t.areaHa).replace('.', ',')} ha` : null, ROTULO_ATRIBUTOS[t.atributos?.tipoPomar]].filter(Boolean).join(' · ')}
                </span>
                <span className="cartao__rodape">
                  {selo ?? 'Avaliar'}
                  {av && pendentesPorId[av.id] ? ' · aguardando envio' : ''}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- começar uma avaliação

export function FormNovaAvaliacao({ talhao, opcoesFase, selecionadas, aoAlternarFase, aviso, aoComecar, iniciando, erro, semana, data }) {
  const grupos = [...new Set(opcoesFase.map((f) => f.grupo))];
  const bloqueado = aviso?.tipo === 'finalizada';
  return (
    <section>
      <h1>{talhao.nome}</h1>
      <p className="lead">
        Semana {semana} · {data}
      </p>

      {aviso?.tipo === 'continuar' && (
        <Faixa tipo="aviso">
          {aviso.texto}{' '}
          <Link to={rotaCampo(aviso.id)} className="botao botao--principal">
            Continuar
          </Link>
        </Faixa>
      )}
      {aviso?.tipo === 'finalizada' && <Faixa tipo="aviso">{aviso.texto}</Faixa>}
      {erro && <Faixa tipo="erro">{erro}</Faixa>}

      {!bloqueado && aviso?.tipo !== 'continuar' && (
        <>
          <h2>Fase da cultura</h2>
          <p className="lead">Marque a fase predominante (pode marcar mais de uma).</p>
          {grupos.map((g) => (
            <fieldset key={g} className="chips">
              <legend>{g}</legend>
              {opcoesFase.filter((f) => f.grupo === g).map((f) => (
                <label key={f.id} className={`chip${selecionadas.includes(f.id) ? ' chip--ligado' : ''}`}>
                  <input type="checkbox" checked={selecionadas.includes(f.id)} onChange={() => aoAlternarFase(f.id)} />
                  {f.nome}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="botao botao--principal botao--cheio" type="button" onClick={aoComecar} disabled={iniciando}>
            {iniciando ? 'Abrindo…' : 'Começar a avaliação'}
          </button>
        </>
      )}
      <p>
        <Link to={rotaCampo()}>Voltar aos talhões</Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- grade das 30 plantas

const ROTULO_STATUS = { completa: 'completa', parcial: 'em andamento', vazia: 'não começou' };

export function GradePlantas({ aid, titulo, semana, progresso, pendentes, finalizada, proxima }) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p className="lead">
        Semana {semana} · {progresso.completas} de {progresso.total} plantas completas
        {pendentes > 0 ? ` · ${pendentes} aguardando envio` : ''}
      </p>
      {finalizada && <Faixa tipo="ok">Avaliação finalizada. Só leitura.</Faixa>}

      <div className="grade" role="list">
        {Array.from({ length: progresso.total }, (_, i) => i + 1).map((n) => (
          <Link key={n} role="listitem" to={rotaCampo(aid, 'planta', n)} className={`ladrilho ladrilho--${progresso.porPlanta[n]}`} aria-label={`Planta ${n}: ${ROTULO_STATUS[progresso.porPlanta[n]]}`}>
            {n}
          </Link>
        ))}
      </div>

      <div className="pilha">
        {!finalizada && proxima && (
          <Link to={rotaCampo(aid, 'planta', proxima)} className="botao botao--principal botao--cheio">
            {progresso.completas === 0 ? 'Começar pela planta 1' : `Continuar na planta ${proxima}`}
          </Link>
        )}
        <Link to={rotaCampo(aid, 'resumo')} className="botao botao--contorno botao--cheio">
          {finalizada ? 'Ver resultado' : 'Resumo e finalizar'}
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- uma planta

const TEXTO_CELULA = (v) => (v === undefined ? '' : v === null ? '–' : String(v));
const CLASSE_CELULA = (v) => (v === undefined ? 'vazio' : v === null ? 'nulo' : `v${v}`);

export function FormularioPlanta({
  ficha, obs, n, total, notas, fotos, somenteLeitura, semFotos, aoQuadrante, aoItemNulo, aoGrupo, aoNotas, aoFoto, aviso, proximaIncompleta, aid,
  aoCopiarAnterior,
}) {
  const grupos = agruparPorOrgao(ficha);
  return (
    <section className="planta">
      <div className="planta__topo">
        <h1>Planta {n}</h1>
        <Link to={rotaCampo(aid)} className="botao botao--contorno">
          Ver as {total}
        </Link>
      </div>
      <p className="legenda" aria-label="Legenda">
        Toque para mudar: <b>0</b> ausente · <b>1</b> {LEGENDA_INTENSIDADE[1]} · <b>2</b> {LEGENDA_INTENSIDADE[2]} · <b>3</b> {LEGENDA_INTENSIDADE[3]} pragas · <b>–</b> não avaliável
      </p>
      {aoCopiarAnterior && (
        <button type="button" className="botao botao--contorno botao--cheio" onClick={aoCopiarAnterior}>
          Repetir planta {n - 1} (ajuste só as diferenças)
        </button>
      )}
      {aviso && <Faixa tipo="erro">{aviso}</Faixa>}
      {somenteLeitura && <Faixa tipo="ok">Avaliação finalizada. Só leitura.</Faixa>}

      {grupos.map((g) => (
        <fieldset key={g.orgao} className="grupo">
          <legend className="grupo__titulo">
            {g.rotulo} {grupoCompleto(g, obs) ? <span className="selo">completo</span> : null}
          </legend>
          {!somenteLeitura && (
            <div className="grupo__acoes">
              <button type="button" className="botao botao--contorno" onClick={() => aoGrupo(g, 0)}>
                Tudo ausente
              </button>
              <button type="button" className="botao botao--contorno" onClick={() => aoGrupo(g, null)}>
                Sem {g.rotulo.toLowerCase()} (–)
              </button>
            </div>
          )}
          {g.itens.map((item) => {
            const quadrantes = quadrantesDoItem(item);
            const feito = itemCompleto(item, obs?.[item.id]);
            return (
              <div key={item.id} className={`linha-item${feito ? ' linha-item--feito' : ''}`}>
                <div className="linha-item__nome">
                  <span>{item.nome}</span>
                  {item.tipo === 'lado_unico' && <span className="linha-item__dica">só o lado da armadilha</span>}
                  {item.criterio && <span className="linha-item__dica">{item.criterio.texto}</span>}
                </div>
                <div className="celulas">
                  {['A', 'B'].map((q) => {
                    const ativa = quadrantes.includes(q);
                    const v = obs?.[item.id]?.[q];
                    return ativa ? (
                      <button
                        key={q}
                        type="button"
                        className={`celula celula--${CLASSE_CELULA(v)}`}
                        onClick={() => aoQuadrante(item, q)}
                        disabled={somenteLeitura}
                        aria-label={`${item.nome}, lado ${q}: ${v === undefined ? 'não respondido' : v === null ? 'não avaliável' : v}`}
                      >
                        <span className="celula__lado">{q}</span>
                        {TEXTO_CELULA(v)}
                      </button>
                    ) : (
                      <span key={q} className="celula celula--inativa" aria-hidden="true">
                        <span className="celula__lado">{q}</span>—
                      </span>
                    );
                  })}
                  {!somenteLeitura && (
                    <button type="button" className="celula celula--nulo celula--pequena" onClick={() => aoItemNulo(item)} aria-label={`${item.nome}: marcar como não avaliável`}>
                      –
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}

      <label className="campo">
        <span>Notas da planta</span>
        <textarea rows={3} maxLength={1000} value={notas} onChange={(e) => aoNotas(e.target.value)} disabled={somenteLeitura} />
      </label>

      {!somenteLeitura && !semFotos && (
        <div className="campo">
          <span>Fotos</span>
          <label className="botao botao--contorno">
            Tirar ou escolher foto
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => aoFoto(e.target.files?.[0])} />
          </label>
          <p className="lead">{fotos.length === 0 ? 'Nenhuma foto nesta planta.' : `${fotos.length} foto(s) guardada(s) neste aparelho (o envio ainda não está ligado).`}</p>
        </div>
      )}

      <nav className="barra-fixa" aria-label="Trocar de planta">
        {n > 1 ? (
          <Link to={rotaCampo(aid, 'planta', n - 1)} className="botao botao--contorno">
            ‹ {n - 1}
          </Link>
        ) : (
          <span />
        )}
        <span className="barra-fixa__meio">
          {n} / {total}
        </span>
        {n < total ? (
          <Link to={rotaCampo(aid, 'planta', n + 1)} className="botao botao--principal">
            {n + 1} ›
          </Link>
        ) : (
          <Link to={rotaCampo(aid, 'resumo')} className="botao botao--principal">
            Resumo ›
          </Link>
        )}
      </nav>
      {proximaIncompleta && proximaIncompleta !== n && (
        <p className="lead">
          Próxima planta incompleta: <Link to={rotaCampo(aid, 'planta', proximaIncompleta)}>{proximaIncompleta}</Link>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- resumo e finalização

const SELO_STATUS = { acao: 'ação', limite_nao_definido: 'revisar', abaixo: 'abaixo', sem_dados: 'sem dados', informativo: 'informativo', nao_aplicavel: 'não se aplica' };

/** Manchete, TDs, aviso de produto seletivo e tabelas por situação. Usado no resumo do campo e no acompanhamento. */
export function BlocoResultado({ modelo }) {
  return (
    <>
      <Faixa tipo={modelo.manchete.tipo === 'revisar' ? 'aviso' : modelo.manchete.tipo === 'acao' ? 'acao' : 'ok'}>
        <b>{modelo.manchete.texto}</b>
      </Faixa>

      <div className="tds" aria-label="Tomada de decisão sugerida">
        {modelo.tds.map((t) => (
          <span key={t.codigo} className={`td td--${t.codigo}`}>
            <b>{t.codigo}</b> {t.texto}
          </span>
        ))}
      </div>
      {modelo.avisoSeletivo && <Faixa tipo="info">{modelo.avisoSeletivo}</Faixa>}

      {modelo.secoes.map((s) => (
        <div key={s.chave} className="secao-resumo">
          <h2>{s.titulo}</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th>NI</th>
                <th>Limite</th>
              </tr>
            </thead>
            <tbody>
              {s.itens.map((i) => (
                <tr key={i.id} className={`linha--${i.status}`}>
                  <td>
                    {i.nome}
                    <span className="linha-item__dica">
                      {i.orgao} · {SELO_STATUS[i.status]}
                      {i.td ? ` · ${i.td}` : ''}
                    </span>
                  </td>
                  <td>
                    {i.niTexto}
                    <span className="linha-item__dica">
                      {i.positivas}/{i.avaliadas}
                    </span>
                  </td>
                  <td>{i.limiteTexto ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

    </>
  );
}

export function ResumoAvaliacao({ titulo, semana, aid, modelo, progresso, incompletas, finalizada, formulario, aoMudarFormulario, aoFinalizar, finalizando, erro, confirmando, aoConfirmar }) {
  return (
    <section>
      <h1>Resumo · {titulo}</h1>
      <p className="lead">
        Semana {semana} · {progresso.completas} de {progresso.total} plantas completas
      </p>
      {erro && <Faixa tipo="erro">{erro}</Faixa>}
      {!finalizada && <Faixa tipo="aviso">Prévia: o cálculo definitivo usa os dados finalizados. O agrônomo decide o que fazer.</Faixa>}

      <BlocoResultado modelo={modelo} />

      {finalizada ? (
        <Faixa tipo="ok">Avaliação finalizada. O agrônomo vai analisar.</Faixa>
      ) : incompletas.length > 0 ? (
        <>
          <Faixa tipo="aviso">
            Ainda não dá para finalizar: {incompletas.length} planta(s) sem todos os itens respondidos. Responda tudo (use "Tudo ausente" ou "–" quando for o caso).
          </Faixa>
          <div className="grade" role="list">
            {incompletas.map((p) => (
              <Link key={p.n} role="listitem" to={rotaCampo(aid, 'planta', p.n)} className={`ladrilho ladrilho--${p.status}`} aria-label={`Planta ${p.n}: faltam ${p.faltam} itens`}>
                {p.n}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <form
          className="finalizar"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmando) aoFinalizar();
            else aoConfirmar();
          }}
        >
          <h2>Finalizar</h2>
          <label className="campo">
            <span>Adultos de bicho-furão na armadilha (opcional)</span>
            <input type="number" inputMode="numeric" min="0" max="1000" value={formulario.adultosArmadilha} onChange={(e) => aoMudarFormulario({ adultosArmadilha: e.target.value })} />
          </label>
          <label className="campo">
            <span>Outras pragas ou observações do talhão (opcional)</span>
            <textarea rows={3} maxLength={2000} value={formulario.outrasPragas} onChange={(e) => aoMudarFormulario({ outrasPragas: e.target.value })} />
          </label>
          {confirmando && <Faixa tipo="aviso">Depois de finalizar, a avaliação não pode mais ser editada. Confirma?</Faixa>}
          <button className="botao botao--principal botao--cheio" type="submit" disabled={finalizando}>
            {finalizando ? 'Finalizando…' : confirmando ? 'Sim, finalizar agora' : 'Finalizar avaliação'}
          </button>
        </form>
      )}
      <p>
        <Link to={rotaCampo(aid)}>Voltar às plantas</Link>
      </p>
    </section>
  );
}
