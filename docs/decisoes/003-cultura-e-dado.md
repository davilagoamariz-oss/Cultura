# 003. Cultura é dado, não código

**Contexto.** Hoje só o limão Tahiti; amanhã outras culturas e tipos de cultura.

**Decisão.** Três camadas: (1) núcleo em código (empresa, unidade, setor, talhão, pessoas,
vínculos, avaliações, decisões); (2) configuração da cultura em dados versionados (`catalogo_culturas`,
`catalogo_alvos`, `catalogo_fichas/{id}/versoes/{n}`); (3) código específico só quando uma cultura
futura exigir um método de amostragem novo. A tela de campo é gerada da ficha, com vocabulário FIXO e
pequeno de tipos de item (`presenca_quadrante`, `lado_unico`, `contagem`, `escala`). Não há
construtor genérico de formulários.

**Consequências.** Cultura nova = ficha nova. O nível de ação pertence ao par (cultura, alvo). Cada
avaliação guarda `fichaId` + `fichaVersao`, e a versão é a vigente da cultura do talhão (as regras
impedem escolher outra). Ficha publicada é imutável: mudança de regra = versão nova. A ficha do
limão é gerada de `regras/regras-iniciais.json` por `scripts/converter-regras-iniciais.mjs` e um
teste garante que não há deriva.
