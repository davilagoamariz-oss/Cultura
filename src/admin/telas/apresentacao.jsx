// Telas de administração do cadastro (apresentação): recebem tudo por propriedades, sem Firebase. Os formulários
// não guardam estado (o navegador guarda o que foi digitado; `Formulario` lê no envio e limpa se deu certo).
import { Link } from 'react-router-dom';
import { MODULOS } from '../../modulos/registro.js';
import { atributosDaFicha, ROTULOS_OPCAO } from '../cadastros.js';
import { Faixa } from '../../campo/telas/apresentacao.jsx';

/** Formulário sem estado: `aoEnviar(FormData)` devolve true (ou uma promessa de true) para limpar os campos. */
export function Formulario({ aoEnviar, ocupado, rotuloEnviar = 'Salvar', children }) {
  const enviar = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (await aoEnviar(new FormData(form))) form.reset();
  };
  return (
    <form className="pilha" onSubmit={enviar}>
      {children}
      <button type="submit" className="botao botao--principal botao--cheio" disabled={ocupado}>
        {ocupado ? 'Salvando…' : rotuloEnviar}
      </button>
    </form>
  );
}

const Campo = ({ rotulo, dica, children }) => (
  <label className="campo">
    <span>{rotulo}</span>
    {children}
    {dica ? <small className="legenda">{dica}</small> : null}
  </label>
);

const Ativo = ({ nome, ligado, rotulo }) => (
  <label className="chip">
    <input type="checkbox" name={nome} value="sim" defaultChecked={ligado} /> {rotulo}
  </label>
);

const Recolhido = ({ titulo, children, aberto = false }) => (
  <details className="cartao" open={aberto}>
    <summary className="cartao__titulo">{titulo}</summary>
    <div className="pilha">{children}</div>
  </details>
);

const ROTULO_ATIVO = (ativo) => (ativo ? null : <span className="selo selo--alerta">Desativado</span>);

// ---------------------------------------------------------------- unidades, setores e talhões

export function FormUnidade({ inicial = {}, aoEnviar, ocupado, rotuloEnviar }) {
  return (
    <Formulario aoEnviar={aoEnviar} ocupado={ocupado} rotuloEnviar={rotuloEnviar}>
      <Campo rotulo="Nome da unidade (fazenda)">
        <input name="nome" required maxLength={120} defaultValue={inicial.nome ?? ''} />
      </Campo>
      <Campo rotulo="Município (opcional)">
        <input name="municipio" maxLength={120} defaultValue={inicial.municipio ?? ''} />
      </Campo>
      <Ativo nome="ativa" ligado={inicial.ativa ?? true} rotulo="Unidade ativa" />
    </Formulario>
  );
}

export function FormSetor({ inicial = {}, aoEnviar, ocupado, rotuloEnviar }) {
  return (
    <Formulario aoEnviar={aoEnviar} ocupado={ocupado} rotuloEnviar={rotuloEnviar}>
      <Campo rotulo="Nome do setor">
        <input name="nome" required maxLength={120} defaultValue={inicial.nome ?? ''} />
      </Campo>
      <fieldset className="chips">
        <legend>Módulos deste setor</legend>
        {Object.values(MODULOS).map((m) => (
          <label key={m.id} className="chip">
            <input type="checkbox" name="modulos" value={m.id} defaultChecked={(inicial.modulos ?? []).includes(m.id)} /> {m.rotulo}
          </label>
        ))}
      </fieldset>
      <Ativo nome="ativo" ligado={inicial.ativo ?? true} rotulo="Setor ativo" />
    </Formulario>
  );
}

const rotuloOpcao = (o) => ROTULOS_OPCAO[o] ?? String(o);

export function FormTalhao({ inicial = {}, culturas, fichasPorCultura, aoEnviar, ocupado, rotuloEnviar, culturaFixa = false }) {
  const culturaAtual = inicial.culturaId ?? culturas[0]?.id ?? '';
  return (
    <Formulario aoEnviar={aoEnviar} ocupado={ocupado} rotuloEnviar={rotuloEnviar}>
      <Campo rotulo="Nome do talhão">
        <input name="nome" required maxLength={120} defaultValue={inicial.nome ?? ''} />
      </Campo>
      <Campo rotulo="Cultura">
        <select name="culturaId" defaultValue={culturaAtual} disabled={culturaFixa}>
          {culturas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome ?? c.id}
            </option>
          ))}
        </select>
        {culturaFixa ? <input type="hidden" name="culturaId" value={culturaAtual} /> : null}
      </Campo>
      <Campo rotulo="Variedade (opcional)">
        <input name="variedade" maxLength={80} defaultValue={inicial.variedade ?? ''} />
      </Campo>
      <Campo rotulo="Área em hectares (opcional)" dica="Pode usar vírgula: 7,5">
        <input name="areaHa" inputMode="decimal" defaultValue={inicial.areaHa ?? ''} />
      </Campo>
      {culturas.map((c) => {
        const atributos = atributosDaFicha(fichasPorCultura[c.id] ?? {});
        if (atributos.length === 0) return null;
        return (
          <fieldset key={c.id} className="pilha">
            <legend>{culturas.length > 1 ? `Características (${c.nome ?? c.id})` : 'Características do talhão'}</legend>
            {atributos.map((a) => {
              const nome = `atributo:${c.id}:${a.chave}`;
              const atual = inicial.atributos?.[a.chave];
              return a.tipo === 'booleano' ? (
                <Ativo key={a.chave} nome={nome} ligado={atual === true} rotulo={a.rotulo} />
              ) : (
                <Campo key={a.chave} rotulo={a.rotulo}>
                  <select name={nome} required defaultValue={atual ?? ''}>
                    <option value="" disabled>
                      Escolha…
                    </option>
                    {a.opcoes.map((o) => (
                      <option key={o} value={o}>
                        {rotuloOpcao(o)}
                      </option>
                    ))}
                  </select>
                </Campo>
              );
            })}
          </fieldset>
        );
      })}
      <Ativo nome="ativo" ligado={inicial.ativo ?? true} rotulo="Talhão ativo" />
    </Formulario>
  );
}

function ResumoTalhao({ t, culturas, fichasPorCultura }) {
  const cultura = culturas.find((c) => c.id === t.culturaId);
  const attrs = atributosDaFicha(fichasPorCultura[t.culturaId] ?? {})
    .map((a) => (a.tipo === 'booleano' ? (t.atributos?.[a.chave] ? a.rotulo : null) : t.atributos?.[a.chave] ? rotuloOpcao(t.atributos[a.chave]) : null))
    .filter(Boolean);
  return [cultura?.nome ?? t.culturaId, t.variedade, t.areaHa ? `${String(t.areaHa).replace('.', ',')} ha` : null, ...attrs].filter(Boolean).join(' · ');
}

export function Estrutura({ unidades, setores, talhoes, culturas, fichasPorCultura, aoCriarUnidade, aoAlterarUnidade, aoCriarSetor, aoAlterarSetor, aoCriarTalhao, aoAlterarTalhao, ocupado, erro, aviso }) {
  const porNome = (a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
  return (
    <section>
      <h1>Unidades, setores e talhões</h1>
      <p className="lead">A estrutura da empresa. Nada é apagado: para tirar algo de uso, desative.</p>
      {erro ? <Faixa tipo="erro">{erro}</Faixa> : null}
      {aviso ? <Faixa tipo="ok">{aviso}</Faixa> : null}

      {unidades.length === 0 ? <div className="vazio">Ainda não há unidades. Cadastre a primeira abaixo.</div> : null}
      {[...unidades].sort(porNome).map((u) => {
        const seus = setores.filter((s) => s.unidadeId === u.id).sort(porNome);
        const tals = talhoes.filter((t) => t.unidadeId === u.id).sort(porNome);
        return (
          <article key={u.id} className="cartao" aria-label={`Unidade ${u.nome}`}>
            <h2 className="cartao__titulo">
              {u.nome} {ROTULO_ATIVO(u.ativa)}
            </h2>
            {u.municipio ? <p className="cartao__texto">{u.municipio}</p> : null}
            <Recolhido titulo="Editar unidade">
              <FormUnidade inicial={u} ocupado={ocupado} aoEnviar={(fd) => aoAlterarUnidade(u.id, fd)} />
            </Recolhido>

            <h3>Setores</h3>
            {seus.length === 0 ? <div className="vazio">Sem setores.</div> : null}
            {seus.map((s) => (
              <div key={s.id} className="cartao cartao--linha">
                <strong>
                  {s.nome} {ROTULO_ATIVO(s.ativo)}
                </strong>
                <span className="cartao__texto">{s.modulos?.length ? s.modulos.map((m) => MODULOS[m]?.rotulo ?? m).join(', ') : 'Nenhum módulo ligado'}</span>
                <Recolhido titulo={`Editar ${s.nome}`}>
                  <FormSetor inicial={s} ocupado={ocupado} aoEnviar={(fd) => aoAlterarSetor(s, fd)} />
                </Recolhido>
              </div>
            ))}
            <Recolhido titulo="+ Novo setor">
              <FormSetor ocupado={ocupado} rotuloEnviar="Criar setor" aoEnviar={(fd) => aoCriarSetor(u.id, fd)} />
            </Recolhido>

            <h3>Talhões</h3>
            {tals.length === 0 ? <div className="vazio">Sem talhões.</div> : null}
            {tals.map((t) => (
              <div key={t.id} className="cartao cartao--linha">
                <strong>
                  {t.nome} {ROTULO_ATIVO(t.ativo)}
                </strong>
                <span className="cartao__texto">
                  <ResumoTalhao t={t} culturas={culturas} fichasPorCultura={fichasPorCultura} />
                </span>
                <Recolhido titulo={`Editar ${t.nome}`}>
                  <FormTalhao inicial={t} culturas={culturas} fichasPorCultura={fichasPorCultura} culturaFixa ocupado={ocupado} aoEnviar={(fd) => aoAlterarTalhao(t, fd)} />
                  <p className="legenda">A mudança vale para as avaliações novas; as já feitas guardam as características de quando foram feitas.</p>
                </Recolhido>
              </div>
            ))}
            <Recolhido titulo="+ Novo talhão">
              <FormTalhao culturas={culturas} fichasPorCultura={fichasPorCultura} ocupado={ocupado} rotuloEnviar="Criar talhão" aoEnviar={(fd) => aoCriarTalhao(u.id, fd)} />
            </Recolhido>
          </article>
        );
      })}

      <Recolhido titulo="+ Nova unidade" aberto={unidades.length === 0}>
        <FormUnidade ocupado={ocupado} rotuloEnviar="Criar unidade" aoEnviar={aoCriarUnidade} />
      </Recolhido>
      <p>
        <Link to="/admin">Voltar à administração</Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- limites de ação

const ROTULO_ORIGEM = { ficha: 'Da ficha', ajuste: 'Ajustado pela empresa', pendente: 'Sem limite (o agrônomo decide)' };

export function Limites({ linhas, historico, formatarQuando, nomeDe, aoAjustar, ocupado, erro, aviso }) {
  const porItem = [];
  for (const l of linhas) {
    let g = porItem.find((x) => x.itemId === l.itemId);
    if (!g) porItem.push((g = { itemId: l.itemId, itemNome: l.itemNome, linhas: [] }));
    g.linhas.push(l);
  }
  return (
    <section>
      <h1>Limites de ação</h1>
      <p className="lead">
        Os limites vêm da ficha da cultura. Um ajuste vale a partir de agora, para as avaliações novas; o histórico nunca é reescrito.
      </p>
      {erro ? <Faixa tipo="erro">{erro}</Faixa> : null}
      {aviso ? <Faixa tipo="ok">{aviso}</Faixa> : null}
      {porItem.map((g) => (
        <article key={g.itemId} className="cartao" aria-label={g.itemNome}>
          <h2 className="cartao__titulo">{g.itemNome}</h2>
          {g.linhas.map((l) => {
            const antigos = historico(l.itemId, l.nivelId);
            return (
              <div key={l.chave} className="cartao cartao--linha">
                <strong>{l.condicao ? `Quando: ${l.condicao}` : 'Limite'}</strong>
                <span className="cartao__texto">
                  Vale hoje: <b>{l.textoVigente}</b> · {ROTULO_ORIGEM[l.origem]}
                  {l.origem === 'ajuste' ? ` (a ficha diz ${l.textoFicha})` : ''}
                </span>
                {l.ajustavel ? (
                  <Recolhido titulo="Ajustar">
                    <Formulario ocupado={ocupado} rotuloEnviar="Salvar novo limite" aoEnviar={(fd) => aoAjustar(l, fd)}>
                      <Campo rotulo={`Novo limite (${l.rotuloUnidade})`} dica={l.opcoes.length ? `Opções da ficha: ${l.opcoes.map((o) => o.texto).join(', ')}` : undefined}>
                        <input name="entrada" required inputMode="decimal" />
                      </Campo>
                      <Campo rotulo="Motivo (opcional)">
                        <textarea name="motivo" rows={2} maxLength={500} />
                      </Campo>
                    </Formulario>
                  </Recolhido>
                ) : (
                  <span className="legenda">Este limite não é ajustado por aqui.</span>
                )}
                {antigos.length > 0 ? (
                  <details>
                    <summary>Histórico de ajustes ({antigos.length})</summary>
                    <ul>
                      {antigos.map((a) => (
                        <li key={a.id}>
                          {l.metrica === 'percent_plantas' ? `${Math.round(a.limite * 10000) / 100}%` : a.limite} desde {formatarQuando(a.vigenteDe)} · por {nomeDe(a.criadoPor)}
                          {a.motivo ? ` · ${a.motivo}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            );
          })}
        </article>
      ))}
      <p>
        <Link to="/admin">Voltar à administração</Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- membros

export function FormMembro({ inicial = {}, aoEnviar, ocupado, rotuloEnviar, novo = false }) {
  return (
    <Formulario aoEnviar={aoEnviar} ocupado={ocupado} rotuloEnviar={rotuloEnviar}>
      {novo ? (
        <Campo rotulo="Código do usuário (UID)" dica="Crie o usuário no Firebase (Authentication) e copie o código dele.">
          <input name="uid" required maxLength={128} autoComplete="off" />
        </Campo>
      ) : null}
      <Campo rotulo="Nome (como aparece para os colegas)">
        <input name="nome" maxLength={80} defaultValue={inicial.nome ?? ''} />
      </Campo>
      <Campo rotulo="Papel na empresa">
        <select name="papelEmpresa" defaultValue={inicial.papelEmpresa ?? 'membro'}>
          <option value="membro">Membro</option>
          <option value="admin">Administrador da empresa</option>
        </select>
      </Campo>
      {novo ? null : <Ativo nome="ativo" ligado={inicial.ativo ?? true} rotulo="Membro ativo" />}
    </Formulario>
  );
}

export function Membros({ membros, meuUid, aoCriar, aoAlterar, ocupado, erro, aviso }) {
  const ordenados = [...membros].sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.nome ?? a.id).localeCompare(b.nome ?? b.id, 'pt-BR'));
  return (
    <section>
      <h1>Membros da empresa</h1>
      <p className="lead">Quem pode entrar nesta empresa. O que cada um faz em cada setor é definido em Vínculos.</p>
      {erro ? <Faixa tipo="erro">{erro}</Faixa> : null}
      {aviso ? <Faixa tipo="ok">{aviso}</Faixa> : null}
      {ordenados.map((m) => (
        <article key={m.id} className="cartao" aria-label={m.nome ?? m.id}>
          <h2 className="cartao__titulo">
            {m.nome ?? `Sem nome (${m.id.slice(0, 6)}…)`} {ROTULO_ATIVO(m.ativo)}
          </h2>
          <span className="cartao__texto">{m.papelEmpresa === 'admin' ? 'Administrador da empresa' : 'Membro'}</span>
          {m.id === meuUid ? (
            <p className="legenda">Você não altera o próprio registro (é uma proteção do sistema).</p>
          ) : (
            <Recolhido titulo="Editar">
              <FormMembro inicial={m} ocupado={ocupado} aoEnviar={(fd) => aoAlterar(m, fd)} />
            </Recolhido>
          )}
        </article>
      ))}
      <Recolhido titulo="+ Adicionar membro" aberto={membros.length === 0}>
        <FormMembro novo ocupado={ocupado} rotuloEnviar="Adicionar" aoEnviar={aoCriar} />
      </Recolhido>
      <p>
        <Link to="/admin">Voltar à administração</Link>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- plataforma: ficha

export function PublicarFicha({ culturas, resumo, aoLerArquivo, aoPublicar, ocupado, erro, aviso }) {
  return (
    <section>
      <h1>Fichas do catálogo</h1>
      <p className="lead">Publica uma versão nova da ficha de uma cultura. Uma ficha publicada nunca é alterada: a versão nova passa a ser a vigente.</p>
      {erro ? <Faixa tipo="erro">{erro}</Faixa> : null}
      {aviso ? <Faixa tipo="ok">{aviso}</Faixa> : null}
      <div className="pilha">
        {culturas.map((c) => (
          <div key={c.id} className="cartao cartao--linha">
            <strong>{c.nome ?? c.id}</strong>
            <span className="cartao__texto">{c.fichaAtual ? `Ficha vigente: versão ${c.fichaAtual.versao}` : 'Sem ficha publicada'}</span>
          </div>
        ))}
      </div>
      <label className="campo">
        <span>Arquivo da ficha (.json)</span>
        <input type="file" accept="application/json,.json" onChange={aoLerArquivo} />
      </label>
      {resumo ? (
        <div className="cartao" aria-label="Ficha lida">
          <strong>{resumo.culturaId}</strong>
          <span className="cartao__texto">
            {resumo.itens} itens · {resumo.regras} regras · {resumo.pendentes} limites pendentes
          </span>
          <button type="button" className="botao botao--principal botao--cheio" disabled={ocupado} onClick={aoPublicar}>
            {ocupado ? 'Publicando…' : 'Publicar como versão nova'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- máquinas (Frota)

export const ROTULO_DISPONIBILIDADE = { disponivel: 'Disponível', em_uso: 'Em uso' };
export const ROTULO_STATUS_MAQUINA = { operacional: 'Operacional', precisa_manutencao: 'Precisa de manutenção', manutencao_sugerida: 'Manutenção sugerida' };

export function FormMaquina({ inicial = {}, aoEnviar, ocupado, rotuloEnviar, novo = false }) {
  return (
    <Formulario aoEnviar={aoEnviar} ocupado={ocupado} rotuloEnviar={rotuloEnviar}>
      <Campo rotulo="Nome">
        <input name="nome" required maxLength={120} defaultValue={inicial.nome ?? ''} />
      </Campo>
      <Campo rotulo="Modelo (opcional)">
        <input name="modelo" maxLength={120} defaultValue={inicial.modelo ?? ''} />
      </Campo>
      <Campo rotulo="Tipo (opcional)" dica="Ex.: trator, pulverizador, caminhão">
        <input name="tipo" maxLength={60} defaultValue={inicial.tipo ?? ''} />
      </Campo>
      <Campo rotulo="Documento (opcional)" dica="Nota fiscal, placa, patrimônio...">
        <input name="documento" maxLength={200} defaultValue={inicial.documento ?? ''} />
      </Campo>
      {novo && (
        <Campo rotulo="Combustível inicial (%)">
          <input name="combustivel" required inputMode="decimal" defaultValue="100" />
        </Campo>
      )}
      <Ativo nome="ativo" ligado={inicial.ativo ?? true} rotulo="Máquina ativa" />
    </Formulario>
  );
}

function ManutencaoAdmin({ m, aoMarcarUrgente, aoConcluir, ocupado }) {
  return (
    <Recolhido titulo="Manutenção">
      <p className="cartao__texto">
        Status atual: <b>{ROTULO_STATUS_MAQUINA[m.status]}</b>
      </p>
      {m.status !== 'precisa_manutencao' && (
        <Formulario ocupado={ocupado} rotuloEnviar="Marcar urgente" aoEnviar={(fd) => aoMarcarUrgente(m, fd)}>
          <Campo rotulo="Descrição (opcional)">
            <textarea name="descricao" rows={2} maxLength={1000} />
          </Campo>
        </Formulario>
      )}
      {m.status !== 'operacional' && (
        <Formulario ocupado={ocupado} rotuloEnviar="Concluir manutenção" aoEnviar={(fd) => aoConcluir(m, fd)}>
          <Campo rotulo="O que foi feito">
            <textarea name="descricao" required rows={2} maxLength={1000} />
          </Campo>
        </Formulario>
      )}
    </Recolhido>
  );
}

export function Maquinas({ unidades, maquinas, aoCriar, aoAlterar, aoMarcarUrgente, aoConcluir, ocupado, erro, aviso }) {
  const porNome = (a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
  return (
    <section>
      <h1>Frota (maquinário)</h1>
      <p className="lead">O maquinário é da fazenda (unidade): qualquer setor com o módulo Frota o usa. Nada é apagado: para tirar de uso, desative.</p>
      {erro ? <Faixa tipo="erro">{erro}</Faixa> : null}
      {aviso ? <Faixa tipo="ok">{aviso}</Faixa> : null}

      {unidades.length === 0 ? <div className="vazio">Ainda não há unidades. Cadastre uma em Unidades, setores e talhões.</div> : null}
      {[...unidades].sort(porNome).map((u) => {
        const suas = maquinas.filter((m) => m.unidadeId === u.id).sort(porNome);
        return (
          <article key={u.id} className="cartao" aria-label={`Máquinas de ${u.nome}`}>
            <h2 className="cartao__titulo">{u.nome}</h2>
            {suas.length === 0 ? <div className="vazio">Sem máquinas.</div> : null}
            {suas.map((m) => (
              <div key={m.id} className="cartao cartao--linha">
                <strong>
                  {m.nome} {ROTULO_ATIVO(m.ativo)}
                </strong>
                <span className="cartao__texto">{[m.modelo, m.tipo, m.documento].filter(Boolean).join(' · ') || 'Sem modelo, tipo ou documento informado'}</span>
                <span className="cartao__texto">
                  {ROTULO_DISPONIBILIDADE[m.disponibilidade]} · {ROTULO_STATUS_MAQUINA[m.status]} · combustível {Math.round((m.combustivel ?? 0) * 100)}%
                </span>
                <Recolhido titulo={`Editar ${m.nome}`}>
                  <FormMaquina inicial={m} ocupado={ocupado} aoEnviar={(fd) => aoAlterar(m, fd)} />
                </Recolhido>
                <ManutencaoAdmin m={m} aoMarcarUrgente={aoMarcarUrgente} aoConcluir={aoConcluir} ocupado={ocupado} />
              </div>
            ))}
            <Recolhido titulo="+ Nova máquina">
              <FormMaquina novo ocupado={ocupado} rotuloEnviar="Cadastrar máquina" aoEnviar={(fd) => aoCriar(u.id, fd)} />
            </Recolhido>
          </article>
        );
      })}
      <p>
        <Link to="/admin">Voltar à administração</Link>
      </p>
    </section>
  );
}
