import { useEffect, useMemo, useState } from 'react';
import { carregarFicha, ouvirAvaliacao, ouvirPlantas } from '../repositorio.js';

/**
 * Carrega uma avaliação em tempo real: cabeçalho, as plantas (com o que ainda não foi enviado) e a ficha
 * da versão que ela usou. `pronto` só fica true quando os três chegaram.
 */
export function useDadosDaAvaliacao(db, empresaId, aid) {
  const [avaliacao, setAvaliacao] = useState(undefined); // undefined = ainda não chegou; null = não existe
  const [plantas, setPlantas] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const falha = (e) => setErro(e.code ?? e.message ?? 'erro');
    const parar = [ouvirAvaliacao(db, empresaId, aid, setAvaliacao, falha), ouvirPlantas(db, empresaId, aid, setPlantas, falha)];
    return () => parar.forEach((f) => f());
  }, [db, empresaId, aid]);

  const fichaId = avaliacao?.fichaId;
  const fichaVersao = avaliacao?.fichaVersao;
  useEffect(() => {
    if (!fichaId) return;
    let vivo = true;
    carregarFicha(db, fichaId, fichaVersao).then((f) => vivo && setFicha(f)).catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [db, fichaId, fichaVersao]);

  const porN = useMemo(() => Object.fromEntries(Object.entries(plantas?.porN ?? {}).map(([n, p]) => [n, p.obs])), [plantas]);
  return {
    avaliacao, ficha, plantas, porN, erro,
    pendentes: plantas?.pendentes ?? 0,
    pronto: Boolean(avaliacao) && plantas !== null && Boolean(ficha),
  };
}
