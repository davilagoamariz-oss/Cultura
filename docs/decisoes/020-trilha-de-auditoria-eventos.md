# 020. Trilha de auditoria (`eventos`) passa a ser gravada de verdade

**Contexto.** `eventos/{id}` e suas `firestore.rules` existiam desde a Fase 1 (com testes das
próprias regras), mas nenhum lugar do app jamais escrevia ou lia um evento — uma peça reservada e
nunca ligada. Uma revisão de qualidade de código (pedida pelo cliente) apontou isso: ou completa, ou
remove, para não deixar superfície de regra sem uso.

**Decisão.** Completar, começando pelas ações mais consequentes (decisão do agrônomo, execução do
gerente, e vínculo — quem tem acesso a quê):
- `decisao_criada` (ao criar a decisão), `decisao_executada` (ao marcar executada), `vinculo_criado`,
  `vinculo_alterado`. Cada uma grava o evento **no mesmo lote** da ação que registra — o evento nunca
  existe sem a ação, nem a ação sem o evento (mesmo princípio de vínculo+histórico).
- `src/gestao/eventos.js`: `montarEvento()`, pura, corta os textos no mesmo limite das regras
  (ação 40, alvo 200, detalhe 500 — os dois últimos não tinham limite nas regras; fechado junto,
  diff mostrado e aprovado separadamente).
- **Cadastro do admin (unidade, setor, talhão, membro, ajuste) e a Frota (uso, manutenção) ainda NÃO
  emitem evento.** Ficou de fora desta rodada para manter o escopo testável; usar o mesmo padrão
  (`montarEvento` + escrever no mesmo lote) quando for a vez.
- `DetalheDaAvaliacao.jsx` continua "fire-and-forget" (decisões 012 e 014): o evento entra no MESMO
  lote da escrita que já não é esperada, então continua sem bloquear a tela.

**Consequências.** Quem é admin, gerente do setor ou agrônomo do setor agora vê, na coleção
`eventos`, quem decidiu, quem executou e quem mexeu em cada vínculo, e quando — o argumento de
"responsabilização" (LGPD, art. 6º, X) citado na decisão 019 deixa de ser só teórico. Ainda não há
tela para consultar isso (é leitura direta da coleção); telas ficam para quando fizer sentido.
Verificado nos emuladores: cada ação deixa o evento certo, com quem fez; quem não tem função no
setor não lê a trilha.
