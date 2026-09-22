// Tela do maquinário para quem tem vínculo no setor (apresentação): recebe tudo por propriedades, sem
// Firebase. Formulários sem estado, como os da administração: o navegador guarda o digitado, o envio lê
// o FormData e limpa os campos se deu certo.
import { Link } from 'react-router-dom';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import { ROTULO_DISPONIBILIDADE, ROTULO_STATUS } from '../uso.js';
import { textoCombustivel } from '../cadastro.js';

function Formulario({ aoEnviar, ocupado, rotuloEnviar, children }) {
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

const SELO_STATUS = { operacional: null, precisa_manutencao: 'selo--alerta', manutencao_sugerida: 'selo--alerta' };

function CartaoMaquina({ m, ehOperador, meuUid, aoIniciar, aoEncerrar, aoSugerir, ocupado }) {
  const emUsoPorMim = m.disponibilidade === 'em_uso' && m.usoAtual?.operadorUid === meuUid;
  const emUsoPorOutro = m.disponibilidade === 'em_uso' && m.usoAtual?.operadorUid !== meuUid;
  return (
    <article className="cartao" aria-label={m.nome}>
      <h2 className="cartao__titulo">{m.nome}</h2>
      <p className="cartao__texto">{[m.modelo, m.tipo].filter(Boolean).join(' · ') || 'Sem modelo ou tipo informado'}</p>
      <p className="cartao__texto">
        <b>{ROTULO_DISPONIBILIDADE[m.disponibilidade]}</b>
        {' · '}
        <span className={SELO_STATUS[m.status] ? 'selo ' + SELO_STATUS[m.status] : undefined}>{ROTULO_STATUS[m.status]}</span>
        {' · combustível '}
        {textoCombustivel(m.combustivel)}
      </p>

      {ehOperador && m.disponibilidade === 'disponivel' && (
        <button type="button" className="botao botao--principal botao--cheio" disabled={ocupado} onClick={() => aoIniciar(m)}>
          Iniciar uso
        </button>
      )}
      {emUsoPorOutro && <p className="legenda">Em uso por outra pessoa.</p>}
      {emUsoPorMim && (
        <Formulario ocupado={ocupado} rotuloEnviar="Encerrar uso" aoEnviar={(fd) => aoEncerrar(m, fd)}>
          <label className="campo">
            <span>Combustível ao encerrar (%)</span>
            <input name="combustivel" required inputMode="decimal" />
          </label>
        </Formulario>
      )}
      {m.status === 'operacional' && (
        <details>
          <summary>Sinalizar um problema</summary>
          <Formulario ocupado={ocupado} rotuloEnviar="Sinalizar" aoEnviar={(fd) => aoSugerir(m, fd)}>
            <label className="campo">
              <span>O que está acontecendo (opcional)</span>
              <textarea name="descricao" rows={2} maxLength={1000} />
            </label>
          </Formulario>
        </details>
      )}
    </article>
  );
}

export function Maquinas({ maquinas, ehOperador, meuUid, aoIniciar, aoEncerrar, aoSugerir, ocupado, erro }) {
  return (
    <section>
      <h1>Máquinas</h1>
      {erro && <Faixa tipo="erro">{erro}</Faixa>}
      {!ehOperador && <p className="legenda">Você não tem a função de operador neste setor: pode ver e sinalizar problemas, mas não iniciar ou encerrar um uso.</p>}
      {maquinas.length === 0 ? (
        <div className="vazio">Nenhuma máquina ativa nesta fazenda. Peça ao administrador para cadastrar.</div>
      ) : (
        <div className="pilha">
          {maquinas.map((m) => (
            <CartaoMaquina key={m.id} m={m} ehOperador={ehOperador} meuUid={meuUid} aoIniciar={aoIniciar} aoEncerrar={aoEncerrar} aoSugerir={aoSugerir} ocupado={ocupado} />
          ))}
        </div>
      )}
      <p>
        <Link to="/frota">Voltar</Link>
      </p>
    </section>
  );
}
