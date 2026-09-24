import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';
import { avaliar } from '../../dominio/motor/index.js';
import { colecaoAjustes, finalizarAvaliacao } from '../repositorio.js';
import { plantasIncompletas, progresso as calcularProgresso } from '../avaliacao.js';
import { montarResumo } from '../resumo.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import Carregando from '../../Carregando.jsx';
import { useContextoCampo } from './contexto.js';
import { useDadosDaAvaliacao } from './dados-avaliacao.js';
import { ResumoAvaliacao, Faixa } from './apresentacao.jsx';
import { SemSetor } from './Campo.jsx';

/** Prévia do NI e da TD e finalização. O cálculo é feito aqui, no aparelho (funciona sem rede). */
export default function Resumo() {
  const { aid } = useParams();
  const { db, empresaId, setor, pode } = useContextoCampo();
  const { avaliacao, ficha, plantas, porN, pendentes, pronto, erro } = useDadosDaAvaliacao(db, empresaId, aid);
  useRegistrarPendentes('plantas', pendentes);
  const [ajustes, setAjustes] = useState(null);
  const [formulario, setFormulario] = useState({ adultosArmadilha: '', outrasPragas: '' });
  const [confirmando, setConfirmando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState(null);

  useEffect(() => {
    let vivo = true;
    getDocs(colecaoAjustes(db, empresaId)).then((s) => vivo && setAjustes(s.docs.map((d) => d.data()))).catch(() => vivo && setAjustes([]));
    return () => { vivo = false; };
  }, [db, empresaId]);

  const modelo = useMemo(() => {
    if (!pronto || ajustes === null) return null;
    const lista = Object.entries(plantas.porN).map(([n, p]) => ({ n: Number(n), obs: p.obs })).sort((a, b) => a.n - b.n);
    // avaliação finalizada: os ajustes vigentes na hora em que foi finalizada; rascunho: os de agora
    const resultado = avaliar({ ficha, plantas: lista, atributos: avaliacao.atributosTalhao, ajustes, referencia: avaliacao.finalizadaEm ?? new Date() });
    return montarResumo(resultado, ficha);
  }, [pronto, plantas, ficha, avaliacao, ajustes]);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não tem a função de pragueiro neste setor.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível abrir a avaliação ({erro}).</Faixa>;
  if (avaliacao === null) return <Faixa tipo="erro">Avaliação não encontrada.</Faixa>;
  if (!modelo) return <Carregando texto="Calculando…" />;

  const progresso = calcularProgresso(ficha, porN);
  const finalizada = avaliacao.status === 'finalizada';

  const finalizar = async () => {
    setErroFinalizar(null);
    setFinalizando(true);
    try {
      // não espera o servidor: fica na fila do aparelho, depois das plantas, e sai quando houver rede
      finalizarAvaliacao(db, empresaId, aid, { ...formulario, resumoCor: modelo.piorCor }).catch((e) => setErroFinalizar(`O servidor recusou a finalização (${e.code ?? 'erro'}).`));
      setConfirmando(false);
    } catch (e) {
      setErroFinalizar(e.message);
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <ResumoAvaliacao
      titulo={avaliacao.talhaoId}
      semana={avaliacao.semanaISO}
      aid={aid}
      modelo={modelo}
      progresso={progresso}
      incompletas={plantasIncompletas(ficha, porN)}
      finalizada={finalizada}
      formulario={formulario}
      aoMudarFormulario={(mudanca) => setFormulario((f) => ({ ...f, ...mudanca }))}
      aoFinalizar={finalizar}
      aoConfirmar={() => setConfirmando(true)}
      confirmando={confirmando}
      finalizando={finalizando}
      erro={erroFinalizar}
    />
  );
}
