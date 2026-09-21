import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { salvarPlanta } from '../repositorio.js';
import { definirValor, definirGrupo, definirItem, proximoValor, quadrantesDoItem } from '../ficha-campo.js';
import { proximaIncompleta, totalDePlantas } from '../avaliacao.js';
import { criarSalvador } from '../autosave.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import { abrirFila, guardarFoto, contarPendentes, comprimirImagem } from '../../offline/fotos.js';
import { fotosNoStorage } from '../../nucleo/firebase.js';
import Carregando from '../../Carregando.jsx';
import { useContextoCampo } from './contexto.js';
import { useDadosDaAvaliacao } from './dados-avaliacao.js';
import { FormularioPlanta, Faixa } from './apresentacao.jsx';
import { SemSetor } from './Campo.jsx';


/** Rota da planta: cada planta é uma instância NOVA (key), para o salvamento nunca misturar plantas. */
export default function EditorPlantaRota() {
  const { aid, n } = useParams();
  return <EditorPlanta key={`${aid}/${n}`} aid={aid} n={Number(n)} />;
}

function EditorPlanta({ aid, n }) {
  const { db, empresaId, setor, pode } = useContextoCampo();
  const { avaliacao, ficha, plantas, porN, pendentes, pronto, erro } = useDadosDaAvaliacao(db, empresaId, aid);
  useRegistrarPendentes('plantas', pendentes);

  const [obs, setObs] = useState(null);
  const [notas, setNotas] = useState('');
  const [fotos, setFotos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const inicializado = useRef(false);
  // o estado COMPLETO mais recente (fonte da gravação) e a configuração atual, lidos na hora de gravar
  const estado = useRef({ obs: null, notas: '', fotos: [] });
  const cfg = useRef({});
  cfg.current = { db, empresaId, ficha, aid, n };

  const [salvador] = useState(() =>
    criarSalvador({
      salvar: (e) => {
        const c = cfg.current;
        if (!c.ficha || e.obs === null) return;
        try {
          // não espera o servidor: o SDK guarda no aparelho na hora e envia quando houver rede
          salvarPlanta(c.db, c.empresaId, c.aid, { ficha: c.ficha, n: c.n, obs: e.obs, notas: e.notas, fotos: e.fotos })
            .then(() => setAviso(null))
            .catch((err) => setAviso(`Não foi possível enviar esta planta (${err.code ?? 'erro'}). O que você marcou continua neste aparelho; tente de novo.`));
        } catch (err) {
          setAviso(err.message);
        }
      },
    }),
  );

  // estado inicial: o que já estava gravado (do aparelho ou do servidor); depois disso o que está na tela manda
  useEffect(() => {
    if (!pronto || inicializado.current) return;
    const p = plantas.porN[n];
    estado.current = { obs: p?.obs ?? {}, notas: p?.notas ?? '', fotos: p?.fotos ?? [] };
    setObs(estado.current.obs);
    setNotas(estado.current.notas);
    setFotos(estado.current.fotos);
    inicializado.current = true;
  }, [pronto, plantas, n]);

  const finalizada = avaliacao?.status === 'finalizada';

  // ao sair da tela ou esconder o app, grava na hora o que ainda estiver por gravar
  useEffect(() => {
    const gravar = () => salvador.flush();
    const aoEsconder = () => { if (document.visibilityState === 'hidden') gravar(); };
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pagehide', gravar);
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pagehide', gravar);
      gravar();
    };
  }, [salvador]);

  const aplicar = useCallback((f) => {
    const novo = f(estado.current.obs ?? {});
    estado.current = { ...estado.current, obs: novo };
    setObs(novo);
    salvador.mudou(estado.current);
  }, [salvador]);
  const aoQuadrante = (item, q) => aplicar((o) => definirValor(o, item, q, proximoValor(o[item.id]?.[q])));
  const aoItemNulo = (item) =>
    aplicar((o) => {
      const tudoNulo = quadrantesDoItem(item).every((q) => o[item.id]?.[q] === null);
      return definirItem(o, item, tudoNulo ? 0 : null);
    });
  const aoGrupo = (grupo, valor) => aplicar((o) => definirGrupo(o, grupo, valor));
  const aoNotas = (texto) => {
    estado.current = { ...estado.current, notas: texto };
    setNotas(texto);
    salvador.mudou(estado.current);
  };

  const aoFoto = async (arquivo) => {
    if (!arquivo) return;
    setAviso(null);
    try {
      const blob = await comprimirImagem(arquivo);
      const banco = await abrirFila();
      const { caminho } = await guardarFoto(banco, { blob, empresaId, avaliacaoId: aid, planta: n });
      const fotosNovas = [...estado.current.fotos, { itemId: null, quadrante: null, caminho }];
      estado.current = { ...estado.current, fotos: fotosNovas };
      setFotos(fotosNovas);
      salvador.mudou(estado.current);
      await fotosPendentes.atualizar();
    } catch (e) {
      setAviso(`Não foi possível guardar a foto: ${e.message}`);
    }
  };

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não tem a função de pragueiro neste setor.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível abrir a avaliação ({erro}).</Faixa>;
  if (avaliacao === null) return <Faixa tipo="erro">Avaliação não encontrada.</Faixa>;
  if (!pronto || obs === null) return <Carregando texto="Abrindo a planta…" />;
  if (!Number.isInteger(n) || n < 1 || n > totalDePlantas(ficha)) return <Faixa tipo="erro">Planta inválida.</Faixa>;

  return (
    <FormularioPlanta
      ficha={ficha}
      obs={obs}
      n={n}
      total={totalDePlantas(ficha)}
      notas={notas}
      fotos={fotos}
      somenteLeitura={finalizada}
      semFotos={false}
      aoQuadrante={aoQuadrante}
      aoItemNulo={aoItemNulo}
      aoGrupo={aoGrupo}
      aoNotas={aoNotas}
      aoFoto={aoFoto}
      aviso={aviso}
      proximaIncompleta={proximaIncompleta(ficha, { ...porN, [n]: obs }, n)}
      aid={aid}
    />
  );
}

/**
 * Fotos guardadas no aparelho. Só contam como "aguardando envio" quando o envio ao Storage está ligado: com ele
 * desligado (plano Spark) elas ficam no aparelho de propósito, e contá-las deixaria o indicador aceso para sempre.
 */
function useFotosPendentes() {
  const [n, setN] = useState(0);
  const atualizar = useCallback(async () => setN(await contarPendentes(await abrirFila())), []);
  useEffect(() => {
    atualizar().catch(() => {});
  }, [atualizar]);
  useRegistrarPendentes('fotos', fotosNoStorage ? n : 0);
  return { atualizar };
}
