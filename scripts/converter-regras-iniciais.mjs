// Gera o catálogo do limão (alvos, cultura e ficha limao-tahiti v1) a partir de regras/regras-iniciais.json.
// Uso: node scripts/converter-regras-iniciais.mjs
// Os arquivos gerados ficam em catalogo/ e são versionados. Uma ficha publicada é imutável:
// mudança de regra = ficha nova (v2), nunca edição da v1.
import { readFileSync, writeFileSync } from 'node:fs';
import { converterRegrasIniciais } from '../src/dominio/fichas/converter.js';
import { validarFicha } from '../src/dominio/fichas/ficha.js';

const raiz = new URL('../', import.meta.url);
const regras = JSON.parse(readFileSync(new URL('regras/regras-iniciais.json', raiz), 'utf8'));
const { ficha, alvos, cultura } = converterRegrasIniciais(regras);

const erros = validarFicha(ficha);
if (erros.length > 0) {
  console.error('Ficha inválida:\n- ' + erros.join('\n- '));
  process.exit(1);
}

const gravar = (caminho, dados) => writeFileSync(new URL(caminho, raiz), JSON.stringify(dados, null, 2) + '\n');
gravar('catalogo/alvos.json', alvos);
gravar('catalogo/culturas/limao-tahiti.json', cultura);
gravar('catalogo/fichas/limao-tahiti.v1.json', ficha);
console.log(`Catálogo gerado: ${alvos.length} alvos, ${ficha.itens.length} itens, ${ficha.regras.length} regras.`);
