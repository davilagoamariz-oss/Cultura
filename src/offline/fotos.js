// Fotos do campo: comprimidas (~300 KB) e guardadas no aparelho (IndexedDB), numa fila de envio.
// A planta guarda só a referência ("local:<id>"). O envio ao Storage exige o plano Blaze e está
// DESLIGADO (VITE_ENABLE_PHOTO_UPLOAD=false): sem ele, as fotos ficam no aparelho como pendentes.
// Este arquivo NÃO importa o SDK do Storage: quem ligar o envio injeta a função `enviar`.

export const ALVO_BYTES = 300_000;
export const LADO_MAXIMO = 1600;
export const LIMITE_BYTES = 2_000_000; // mesmo teto das storage.rules
const QUALIDADES = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
const NOME_BANCO = 'ronda-fotos';
const LOJA = 'fotos';

// ---------------------------------------------------------------- planejamento da compressão (puro)

/** Tamanho depois da redução: o maior lado passa a ter no máximo `lado` px, mantendo a proporção. */
export function planejarReducao(largura, altura, lado = LADO_MAXIMO) {
  if (!(largura > 0) || !(altura > 0)) throw new Error('imagem sem dimensões');
  const maior = Math.max(largura, altura);
  if (maior <= lado) return { largura, altura };
  const fator = lado / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

/** Próxima qualidade JPEG a tentar depois de uma que ficou grande; null = esgotou (reduzir mais as dimensões). */
export function proximaQualidade(atual) {
  const i = QUALIDADES.indexOf(atual);
  return i >= 0 && i < QUALIDADES.length - 1 ? QUALIDADES[i + 1] : null;
}
export const primeiraQualidade = () => QUALIDADES[0];

/**
 * Comprime no navegador: reduz o tamanho e baixa a qualidade até caber em ~300 KB. Só roda no navegador
 * (usa canvas); a lógica de decisão acima é pura e testada.
 */
export async function comprimirImagem(arquivo, { alvo = ALVO_BYTES, lado = LADO_MAXIMO } = {}) {
  const bitmap = await createImageBitmap(arquivo);
  let { largura, altura } = planejarReducao(bitmap.width, bitmap.height, lado);
  for (let rodada = 0; rodada < 4; rodada += 1) {
    const canvas = new OffscreenCanvas(largura, altura);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, largura, altura);
    let qualidade = primeiraQualidade();
    while (qualidade !== null) {
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: qualidade });
      if (blob.size <= alvo) {
        bitmap.close?.();
        return blob;
      }
      qualidade = proximaQualidade(qualidade);
    }
    largura = Math.round(largura * 0.75); // ainda grande: reduz as dimensões e tenta de novo
    altura = Math.round(altura * 0.75);
  }
  bitmap.close?.();
  throw new Error('não foi possível reduzir a foto o bastante');
}

// ---------------------------------------------------------------- fila no IndexedDB

const pedido = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Abre (ou cria) o banco local de fotos. */
export function abrirFila(fabrica = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const abrir = fabrica.open(NOME_BANCO, 1);
    abrir.onupgradeneeded = () => {
      const loja = abrir.result.createObjectStore(LOJA, { keyPath: 'id' });
      loja.createIndex('avaliacaoId', 'avaliacaoId');
      loja.createIndex('status', 'status');
    };
    abrir.onsuccess = () => resolve(abrir.result);
    abrir.onerror = () => reject(abrir.error);
  });
}

const tx = (banco, modo = 'readonly') => banco.transaction(LOJA, modo).objectStore(LOJA);
const todas = async (banco) => pedido(tx(banco).getAll());

/**
 * Guarda a foto (já comprimida) e devolve a referência para gravar na planta.
 * @returns { id, caminho }  caminho = "local:<id>"
 */
export async function guardarFoto(banco, { blob, empresaId, avaliacaoId, planta, itemId = null, quadrante = null }) {
  if (!blob || typeof blob.size !== 'number') throw new Error('foto inválida');
  if (blob.size > LIMITE_BYTES) throw new Error('foto grande demais (máximo 2 MB)');
  if (!/^image\//.test(blob.type)) throw new Error('só imagens');
  const id = globalThis.crypto.randomUUID();
  await pedido(tx(banco, 'readwrite').add({
    id, blob, tamanho: blob.size, tipo: blob.type, empresaId, avaliacaoId, planta, itemId, quadrante,
    // criadoEm sozinho empata (mesmo milissegundo): o desempate monotônico mantém a ordem de chegada
    status: 'pendente', criadoEm: Date.now(), ordem: globalThis.performance.now(),
  }));
  return { id, caminho: `local:${id}` };
}

export const obterFoto = (banco, id) => pedido(tx(banco).get(id));

export async function listarPendentes(banco) {
  return (await todas(banco)).filter((f) => f.status === 'pendente').sort((a, b) => a.criadoEm - b.criadoEm || a.ordem - b.ordem);
}
export async function contarPendentes(banco) {
  return (await listarPendentes(banco)).length;
}
export async function fotosDaAvaliacao(banco, avaliacaoId) {
  return pedido(tx(banco).index('avaliacaoId').getAll(avaliacaoId));
}
export async function removerFoto(banco, id) {
  await pedido(tx(banco, 'readwrite').delete(id));
}
export async function marcarEnviada(banco, id, caminhoRemoto) {
  const loja = tx(banco, 'readwrite');
  const foto = await pedido(loja.get(id));
  if (!foto) return;
  await pedido(tx(banco, 'readwrite').put({ ...foto, status: 'enviada', caminhoRemoto, blob: undefined }));
}

/**
 * Tenta enviar as pendentes, uma a uma, na ordem. Com o envio desligado (plano Spark), não faz nada e
 * diz por quê. Uma falha para no primeiro erro e mantém a foto na fila.
 * @param enviar  async (foto) => caminhoRemoto   (só existe quando o Storage estiver habilitado)
 */
export async function enviarPendentes(banco, { ligado, enviar }) {
  if (!ligado || typeof enviar !== 'function') return { enviadas: 0, restantes: await contarPendentes(banco), motivo: 'envio desligado' };
  let enviadas = 0;
  for (const foto of await listarPendentes(banco)) {
    try {
      await marcarEnviada(banco, foto.id, await enviar(foto));
      enviadas += 1;
    } catch (erro) {
      return { enviadas, restantes: await contarPendentes(banco), motivo: `falha ao enviar: ${erro.message}` };
    }
  }
  return { enviadas, restantes: 0, motivo: null };
}
