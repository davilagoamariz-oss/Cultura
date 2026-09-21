// Lê os formulários da administração (FormData) e devolve os dados no formato de cadastros.js e limites.js.
// Os formulários não têm estado: o navegador guarda o que foi digitado e isto lê no envio. Funções puras.
import { atributosDaFicha } from './cadastros.js';

const texto = (fd, nome) => String(fd.get(nome) ?? '').trim();

export const lerUnidade = (fd) => ({ nome: texto(fd, 'nome'), municipio: texto(fd, 'municipio'), ativa: fd.get('ativa') === 'sim' });

export const lerSetor = (fd) => ({ nome: texto(fd, 'nome'), modulos: fd.getAll('modulos').map(String), ativo: fd.get('ativo') === 'sim' });

/**
 * Talhão. Os campos de atributo se chamam `atributo:<culturaId>:<chave>`, para o formulário poder mostrar os da
 * ficha de cada cultura; só valem os da cultura escolhida.
 */
export function lerTalhao(fd, fichasPorCultura) {
  const culturaId = texto(fd, 'culturaId');
  const atributos = {};
  for (const a of atributosDaFicha(fichasPorCultura[culturaId] ?? {})) {
    const v = fd.get(`atributo:${culturaId}:${a.chave}`);
    atributos[a.chave] = a.tipo === 'booleano' ? v === 'sim' : v === null ? undefined : String(v);
  }
  return { nome: texto(fd, 'nome'), culturaId, variedade: texto(fd, 'variedade'), areaHa: texto(fd, 'areaHa'), atributos, ativo: fd.get('ativo') === 'sim' };
}

export const lerAjuste = (fd) => ({ entrada: texto(fd, 'entrada'), motivo: texto(fd, 'motivo') });

export const lerMembro = (fd) => ({ uid: texto(fd, 'uid'), nome: texto(fd, 'nome'), papelEmpresa: texto(fd, 'papelEmpresa') || 'membro', ativo: fd.get('ativo') !== 'nao' });
