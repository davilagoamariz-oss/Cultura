# 001. Cada empresa fica na própria árvore do banco

**Contexto.** O sistema atende várias empresas. Um vazamento entre empresas é o pior defeito possível.

**Decisão.** Todo dado de uma empresa vive em `empresas/{empresaId}/...`. Só entra quem tem um
documento ativo em `empresas/{empresaId}/membros/{uid}`. Em vez de um campo `empresaId` em cada
documento, o isolamento está no caminho.

**Consequências.** Uma regra simples protege tudo de uma vez; um erro numa regra específica não vaza
entre empresas. Exportar ou apagar os dados de uma empresa (LGPD) é operar numa árvore só. O app
monta todos os caminhos em `src/nucleo/caminhos.js`, que recusa ids com `/`. Os testes de regras
usam duas empresas e tentam ler e escrever de uma na outra.
