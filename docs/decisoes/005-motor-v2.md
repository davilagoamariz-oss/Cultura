# 005. Motor de regras v2

**Contexto.** O motor original tinha campos fixos do limão (`limitePorTipoPomar`, `citrosVizinhos`)
e um nível de ação por regra.

**Decisão.** Função pura em `src/dominio/motor/`: métricas plugáveis (registro; hoje
`percent_plantas` e `plantas_positivas`), vários níveis por regra (vence o de maior `gravidade`, e o
resultado diz qual nível disparou), gatilhos `quando` de vocabulário fixo (atributos do talhão;
intensidade mínima com nº de plantas) e ajustes da empresa. Preserva: `null` (não avaliável) é
diferente de `0` (ausente); sem dados não é 0; praga detectada sem limite definido nunca vira TD1
(REVISAR); itens informativos; produto seletivo; operadores `>` e `>=`.

**Consequências.** Os 10 testes originais passam com a mesma verificação (só o formato de entrada
mudou). Uma métrica nova (ex.: contagem na armadilha do bicho-furão) entra no registro sem mudar o
motor. Limites pendentes continuam `null`; propostas do manual e do cliente ficam em `proposta`,
DESATIVADAS, até confirmação.
