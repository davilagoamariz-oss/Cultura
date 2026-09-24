# 024 — Amostragem fiel à Embrapa: tamanho por área/espaçamento e 3 setores por planta

## Contexto

O cliente pediu para estudar o processo de amostragem "de acordo com as normas da Embrapa" e exigiu
que toda evolução da lógica agronômica tenha referência acadêmica/institucional citada (ver memória
`feedback-referencia-academica`). Comparando o código atual com o Manual Embrapa Doc. 183 (Santos
Filho et al., 2009) — a mesma fonte já citada em `src/dominio/fichas/converter.js` — achei DUAS
divergências estruturais, nenhuma delas documentada antes como decisão consciente:

1. **Tamanho da amostra fixo (30 plantas), independente da área do talhão.**
2. **Cada planta tem só 2 lados (quadrantes A/B), quando o manual usa 3 setores.**

## Fonte (citação literal, Manual Embrapa Doc. 183, p.11-14)

> "As Inspeções devem ser feitas levando em consideração a época de ocorrência, a intensidade e a
> freqüência das pragas-alvo em um talhão. A planta escolhida ao acaso para o monitoramento deve ter
> a sua copa dividida em **três setores iguais**, nos quais serão observadas as presenças e ausências
> das pragas e inimigos naturais." (p.11)

> "O talhão a ser amostrado deve ser georeferenciado e o seu tamanho para a lima ácida Tahiti foi
> estabelecido em **cinco hectares** correspondendo a cerca de **1.500 plantas, dependendo do
> espaçamento**, sendo a amostragem mínima definida como sendo **15 plantas por talhão**,
> correspondendo a 1% do total de plantas do talhão (...)" (p.11-12)

> "A ficha de campo foi elaborada para talhões de até cinco ha amostrando 15 plantas do talhão. Em
> caso de áreas **menores** do que cinco hectares considerar **10 plantas**. Em caso de áreas
> **maiores** de cinco hectares, considerar **1% do número total de plantas** do talhão a ser
> amostrado." (p.14)

E por praga (ex. ácaro da ferrugem, p.16): "anotando-se na ficha, 0 para ausência, 1, 2, ou 3 de
acordo com a presença em **1, 2 ou 3 lados da planta**" — confirma que a unidade por planta é sempre
3, não 2, em toda a ficha (exceto onde o próprio manual já usa "lado único", como a armadilha do
bicho-furão).

## O que existia antes (decisões do cliente, sem citar a Embrapa)

Memória `regras-do-cliente-cultura` (2026-09-20): *"Cada planta é avaliada dos dois lados (quadrantes
A e B)"* e *"~240 ha, 30 plantas por talhão por semana"*. Nenhuma ADR anterior explica a divergência
com o manual — eram convenções do cliente, não confirmadas contra a fonte. **Revisadas agora**, com
autorização explícita do cliente (2026-09-24), para seguir a Embrapa à risca.

## Decisão A — tamanho da amostra por área e espaçamento

- Talhão ganha um campo de **espaçamento** (metros entre plantas × metros entre linhas). Densidade =
  10.000 m² ÷ (espaçamento_plantas × espaçamento_linhas), em plantas/ha.
- Total de plantas do talhão = área (ha) × densidade.
- Tamanho da amostra: `< 5 ha → 10 plantas; >= 5 ha → 1% do total de plantas (arredondado)`. Em
  exatamente 5 ha com a densidade de referência (~300/ha) isso já dá 15, batendo com o manual — não
  precisa de caso especial para "= 5 ha".
- **Reaproveita o talhão como unidade de amostragem** (sem inventar um conceito novo de "sub-área"):
  um talhão maior que 5 ha continua sendo UM talhão, mas o cadastro (Admin → Estrutura) passa a
  avisar quando a área ultrapassa 5 ha, recomendando cadastrar o campo como vários talhões (ex.:
  "Talhão 01 - Bloco A", "Bloco B"), cada um com sua própria amostra e sua própria análise/decisão —
  que é exatamente o que já acontece hoje quando existem vários talhões. Fiel ao espírito do manual
  ("o talhão a ser amostrado... foi estabelecido em cinco hectares") sem duplicar a arquitetura de
  avaliação que já existe.
- A ficha deixa de ter `amostragem.plantas` fixo (30): a contagem de plantas a preencher passa a ser
  calculada por talhão (`calcularTamanhoAmostra(areaHa, espacamento)`), lida da MESMA forma em toda a
  parte que hoje lê `ficha.amostragem.plantas`.

## Decisão B — 3 setores por planta (A/B/C), não 2

- Todo item da ficha passa a aceitar até 3 quadrantes (`A`, `B`, `C`) em vez de 2 — exceto os itens
  já marcados `tipo: 'lado_unico'` (ex. bicho-furão), que não mudam.
- `valorPlanta`/`intensidadePlanta` (`src/dominio/motor/valores.js`) passam a considerar os 3 lados.
- Grade de preenchimento por planta (`FormularioPlanta`) ganha um terceiro botão de quadrante por
  item.
- `firestore.rules` (validação de `obs`) e a exportação/relatórios que hoje assumem só A/B precisam
  aceitar C.

## Impacto e risco

Produção ainda **não tem nenhum talhão nem avaliação real cadastrada** — é o momento mais barato para
essa correção: nenhum dado de campo existente fica no formato antigo. Os 9 papéis de teste do
emulador e as 5 contas de teste de produção continuam válidos (a mudança é estrutural na ficha, não
no cadastro de pessoas/empresas).

## Verificação planejada

`npm test` a cada etapa; `npm run test:rules` para a mudança de `obs`; `npm run test:fluxo` para o
fluxo ponta a ponta com o novo tamanho de amostra variável.

## Estado da implementação (2026-09-24)

- **B (3 setores)**: pronta, commit `07e178a`. `QUADRANTES` em `src/campo/ficha-campo.js`.
- **A (amostra por área/espaçamento)**: pronta.
  - `src/campo/amostragem.js`: `calcularTamanhoAmostra(areaHa, espacamento)` — < 5 ha: 10; >= 5 ha:
    1% do total (piso 10); sem área/espaçamento: 15 (piso do manual, documentado como padrão).
  - Talhão ganha `espacamento { entrePlantas, entreLinhas }` (Admin -> Estrutura, opcional, os dois
    juntos ou nenhum) e o formulário avisa que a Embrapa define o talhão de amostragem em 5 ha.
  - A avaliação guarda `amostragemPlantas`, calculado UMA vez na criação (como `atributosTalhao`),
    e `useDadosDaAvaliacao` injeta esse valor em `ficha.amostragem.plantas` num só ponto; o
    `plantas: 30` fixo da ficha virou 15 (só piso de segurança).
  - `firestore.rules`: `espacamento` no talhão; `amostragemPlantas` na avaliação (piso 10; sem área =
    15; área < 5 ha = 10; imutável depois de criada); número da planta 1 a 999.
- **Convenção "ficha publicada é imutável"**: a v1 foi alterada no lugar (amostragem e `lados`)
  porque nenhuma avaliação real existe em produção. **Pendente**: o documento
  `catalogo_fichas/limao-tahiti/versoes/1` já publicado em produção ainda está no formato antigo;
  precisa ser sobrescrito ao publicar esta versão (decisão do cliente, produção não foi tocada).
- Não implementado (fora do escopo confirmado): dividir automaticamente um talhão > 5 ha em
  sub-unidades — o cadastro só orienta a criar mais de um talhão.
- Verificação: `npm test` 315/315; regras 117/117 (emulador isolado, mesmo conteúdo do arquivo).
