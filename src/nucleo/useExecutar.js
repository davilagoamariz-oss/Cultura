import { useCallback, useState } from 'react';
import { useOnline } from '../offline/useOnline.js';

/**
 * Executa uma escrita ESPERANDO o servidor confirmar: controla "ocupado", erro (traduz
 * permission-denied numa mensagem legível) e um aviso de sucesso opcional.
 *
 * Só serve para ações que precisam mesmo da confirmação (cadastro, vínculo, uso de máquina).
 * O campo (avaliação de plantas) e a decisão do agrônomo são de propósito o OPOSTO — não esperam o
 * servidor, ficam na fila do aparelho para funcionar sem rede (decisões 012 e 014) — e não usam isto.
 *
 * @param mensagemRecusa texto padrão para quando o servidor nega; cada chamada pode sobrescrever.
 * @param exigirOnline   recusa de cara quando offline, em vez de deixar a ação enfileirada (útil
 *                       quando a ação não faz sentido atrasada, como a administração).
 */
export function useExecutar({ mensagemRecusa = 'O servidor recusou a ação.', exigirOnline = false } = {}) {
  const online = useOnline();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const executar = useCallback(async (acao, textoOk, mensagemRecusaAqui) => {
    setErro(null);
    setAviso(null);
    if (exigirOnline && !online) {
      setErro('Sem conexão. Esta ação precisa de internet para confirmar no servidor.');
      return false;
    }
    setOcupado(true);
    try {
      await acao();
      setAviso(textoOk);
      return true;
    } catch (e) {
      setErro(e.code === 'permission-denied' ? (mensagemRecusaAqui ?? mensagemRecusa) : e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }, [online, exigirOnline, mensagemRecusa]);

  return { executar, ocupado, erro, aviso, setErro, online };
}
