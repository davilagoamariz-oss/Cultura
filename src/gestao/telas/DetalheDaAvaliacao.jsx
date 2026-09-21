import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { caminhos } from '../../nucleo/caminhos.js';
import { avaliar } from '../../dominio/motor/index.js';
import { colecaoAjustes } from '../../campo/repositorio.js';
import { montarResumo } from '../../campo/resumo.js';
import { semanaAnterior } from '../../campo/semana.js';
import { useDadosDaAvaliacao } from '../../campo/telas/dados-avaliacao.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import Carregando from '../../Carregando.jsx';
import { SemSetor } from '../../campo/telas/Campo.jsx';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import { avaliacaoDaSemanaAnterior, ouvirDecisao, criarDecisao, executarDecisao } from '../repositorio.js';
import { tdsDaFicha, tdsSugeridos, situacaoDaDecisao, prazoDeAplicacao } from '../decisao.js';
import { formatarQuando, formatarDia } from '../formato.js';
import { useContextoGestao, useNomes } from './contexto.js';
import { DetalheAvaliacao } from './apresentacao.jsx';

/** Uma avaliação: o resultado calculado, a armadilha das duas semanas, a decisão do agrônomo e a execução do gerente. */
export default function DetalheDaAvaliacao() {
  const { aid } = useParams();
  const { db, empresaId, uid, meuNome, setor, podeAcompanhar: pode, podeDecidir, ehGerente } = useContextoGestao();
  const { avaliacao, ficha, plantas, pendentes, pronto, erro } = useDadosDaAvaliacao(db, empresaId, aid);
  const [talhao, setTalhao] = useState(null);
  const [ajustes, setAjustes] = useState(null);
  const [decisao, setDecisao] = useState(undefined); // undefined = ainda não chegou; null = não há decisão
  const [anterior, setAnterior] = useState(undefined);
  const [edicao, setEdicao] = useState({});
  const [confirmandoDecisao, setConfirmandoDecisao] = useState(false);
  const [decidindo, setDecidindo] = useState(false);
  const [execObservacao, setExecObservacao] = useState('');
  const [confirmandoExecucao, setConfirmandoExecucao] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [erroAcao, setErroAcao] = useState(null);

  const talhaoId = avaliacao?.talhaoId;
  const semana = avaliacao?.semanaISO;

  useEffect(() => {
    if (!pode) return undefined;
    let vivo = true;
    getDocs(colecaoAjustes(db, empresaId)).then((s) => vivo && setAjustes(s.docs.map((d) => d.data()))).catch(() => vivo && setAjustes([]));
    const parar = ouvirDecisao(db, empresaId, setor.setorId, aid, (d) => vivo && setDecisao(d), () => vivo && setDecisao(null));
    return () => { vivo = false; parar(); };
  }, [db, empresaId, setor, pode, aid]);

  useEffect(() => {
    if (!talhaoId || !semana) return undefined;
    let vivo = true;
    getDoc(doc(db, ...caminhos.talhao(empresaId, talhaoId))).then((s) => vivo && setTalhao(s.exists() ? s.data() : {})).catch(() => vivo && setTalhao({}));
    avaliacaoDaSemanaAnterior(db, empresaId, setor.setorId, talhaoId, semanaAnterior(semana)).then((a) => vivo && setAnterior(a)).catch(() => vivo && setAnterior(null));
    return () => { vivo = false; };
  }, [db, empresaId, setor, talhaoId, semana]);

  const modelo = useMemo(() => {
    if (!pronto || ajustes === null) return null;
    const lista = Object.entries(plantas.porN).map(([n, p]) => ({ n: Number(n), obs: p.obs })).sort((a, b) => a.n - b.n);
    // finalizada: os ajustes vigentes quando foi finalizada; em andamento: os de agora
    return montarResumo(avaliar({ ficha, plantas: lista, atributos: avaliacao.atributosTalhao, ajustes, referencia: avaliacao.finalizadaEm ?? new Date() }), ficha);
  }, [pronto, plantas, ficha, avaliacao, ajustes]);

  useRegistrarPendentes('decisao', (decisao?.pendente ? 1 : 0) + pendentes);
  const nomes = useNomes(db, empresaId, [avaliacao?.responsavelUid, decisao?.decididoPor, decisao?.executadoPor], uid, meuNome);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não é agrônomo nem gerente neste setor.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível abrir a avaliação ({erro}).</Faixa>;
  if (avaliacao === null) return <Faixa tipo="erro">Avaliação não encontrada.</Faixa>;
  if (!modelo || decisao === undefined || talhao === null || anterior === undefined) return <Carregando texto="Calculando…" />;

  const situacao = situacaoDaDecisao({ avaliacao, decisao, podeDecidir, ehGerente });
  const formulario = { status: 'aprovada', tds: tdsSugeridos(modelo), observacao: '', ...edicao };
  const decisaoParaTela = decisao
    ? { ...decisao, decididoQuando: formatarQuando(decisao.decididoEm), executadoQuando: formatarQuando(decisao.executadoEm) }
    : null;

  const decidir = () => {
    setErroAcao(null);
    setDecidindo(true);
    try {
      // não espera o servidor: fica na fila do aparelho e sai quando houver rede
      criarDecisao(db, empresaId, { ficha, avaliacao: { ...avaliacao, id: aid }, uid, status: formulario.status, tds: formulario.tds, motivos: modelo.motivos, observacao: formulario.observacao })
        .catch((e) => setErroAcao(`O servidor recusou a decisão (${e.code ?? 'erro'}).`));
      setConfirmandoDecisao(false);
    } catch (e) {
      setErroAcao(e.message);
      setConfirmandoDecisao(false);
    } finally {
      setDecidindo(false);
    }
  };

  const executar = () => {
    setErroAcao(null);
    setExecutando(true);
    try {
      executarDecisao(db, empresaId, aid, { uid, observacao: execObservacao }).catch((e) => setErroAcao(`O servidor recusou a execução (${e.code ?? 'erro'}).`));
      setConfirmandoExecucao(false);
    } catch (e) {
      setErroAcao(e.message);
      setConfirmandoExecucao(false);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <DetalheAvaliacao
      titulo={talhao.nome ?? avaliacao.talhaoId}
      semana={avaliacao.semanaISO}
      dataTexto={formatarDia(avaliacao.data)}
      pragueiro={nomes[avaliacao.responsavelUid]}
      fichaVersao={avaliacao.fichaVersao}
      avaliacao={avaliacao}
      modelo={modelo}
      prazo={prazoDeAplicacao(avaliacao.data)}
      armadilha={{ atual: avaliacao.armadilha?.adultos ?? null, anterior: anterior?.armadilha?.adultos ?? null, semanaAnterior: semanaAnterior(avaliacao.semanaISO) }}
      situacao={situacao}
      decisao={decisaoParaTela}
      tdsDisponiveis={tdsDaFicha(ficha).map((c) => ({ codigo: c, texto: ficha.tds[c] }))}
      tdsTexto={ficha.tds}
      nomes={nomes}
      formulario={formulario}
      aoMudarFormulario={(m) => { setConfirmandoDecisao(false); setEdicao((e) => ({ ...e, ...m })); }}
      aoDecidir={decidir}
      decidindo={decidindo}
      confirmandoDecisao={confirmandoDecisao}
      aoConfirmarDecisao={() => setConfirmandoDecisao(true)}
      execObservacao={execObservacao}
      aoMudarExecObservacao={setExecObservacao}
      aoExecutar={executar}
      executando={executando}
      confirmandoExecucao={confirmandoExecucao}
      aoConfirmarExecucao={() => setConfirmandoExecucao(true)}
      erro={erroAcao}
    />
  );
}
