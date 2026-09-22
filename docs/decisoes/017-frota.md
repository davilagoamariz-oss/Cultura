# 017. Módulo Frota (maquinário): uso, combustível e manutenção

**Contexto.** O cliente pediu para registrar o maquinário de cada fazenda: se está disponível ou em
uso, o combustível ao voltar a ficar parado, e a manutenção (sinalizar um problema, marcar urgente,
concluir). "Frota" já era um módulo reservado no registro (`src/modulos/registro.js`) desde a Fase 1,
sem nunca ter sido implementado; esta decisão o implementa.

**Decisão.**
- **A máquina é da unidade (fazenda), não do setor** — como o talhão. Qualquer setor da mesma fazenda
  com o módulo `frota` habilitado a vê e a opera; não é preciso duplicar o cadastro por setor.
- **Dois campos, não um.** O cliente descreveu "ativo/inativo" e "disponível/indisponível" como a
  mesma coisa; mesmo assim, `maquinas/{id}` tem dois campos separados:
  - `ativo` (bool): a máquina está em serviço ou foi baixada. Só o admin muda, raramente — a mesma
    convenção de `unidade.ativa`, `setor.ativo`, `talhao.ativo` (nada se apaga, só se desativa).
  - `disponibilidade` (`disponivel` | `em_uso`): o dia a dia, muda a cada operação.
  A alternativa (um campo só) deixaria a fazenda sem um jeito de tirar uma máquina vendida ou
  sucateada das listas sem inventar um estado emprestado do dia a dia. Como isso não contradiz nada
  do que o cliente pediu (só acrescenta a mesma proteção que todo o resto do cadastro já tem), a
  decisão foi tomada e registrada aqui, sem nova rodada de confirmação.
- **`status`** (`operacional` | `precisa_manutencao` | `manutencao_sugerida`): a condição mecânica,
  independente da disponibilidade — uma máquina pode estar disponível e ainda assim precisando de
  manutenção (fica combinado ao admin decidir se libera o uso mesmo assim; o app não bloqueia).
- **Combustível é fração 0–1** (como os limites da ficha), mostrado em % na tela; só muda ao encerrar
  um uso (o valor informado pelo último operador) ou no cadastro inicial.
- **Uso**: `usoAtual` na máquina (`{ usoId, operadorUid, setorId, inicioEm }`) e um espelho em
  `usos/{usoId}` nascem juntos, com o MESMO `usoId` (gerado pelo app) ligando os dois — o mesmo
  princípio do vínculo+histórico, mas **sem** cruzar as duas escritas com `getAfter`/`existsAfter`:
  isso esbarrou no limite de avaliação de regras do Firestore ("maximum de 1000 expressions"). Cada
  escrita se autoriza sozinha (função "operador" no setor certo, da mesma unidade da máquina); o pior
  cenário de uma escrita sem a outra é um registro de histórico faltando, nunca uma falha de
  autorização.
- **Manutenção**: qualquer membro ativo da empresa (não precisa ter vínculo em setor nenhum) pode
  sinalizar um problema leve (`operacional` → `manutencao_sugerida`). **Só o admin da empresa** marca
  urgente (`precisa_manutencao`) ou conclui (volta a `operacional`, com o que foi feito) — mais
  simples do que "gerente ou admin", porque a máquina não tem `setorId` próprio e checar a
  autoridade do gerente exigiria o mesmo tipo de regra cara que já foi descartado para o uso. Pode
  abrir para o gerente depois, se for pedido.
- **Função nova no vínculo: `operador`** (só grava início/fim de uso e o combustível). Sugerir
  manutenção não exige essa função, só ser membro ativo.
- **Falha de segurança encontrada e corrigida durante a verificação**: a primeira versão de
  `manutencaoSugerivel()` conferia só o formato do dado, sem checar `membroAtivo(e)` — qualquer
  pessoa autenticada, de qualquer empresa, conseguia sinalizar manutenção na máquina de uma empresa
  que não era a dela. Corrigido antes de aplicar as regras; o teste de vazamento entre empresas ficou
  no script de verificação, ao lado dos outros módulos.
- **Cadastro da máquina**: admin da empresa, em `/admin/maquinas`, agrupado por fazenda (mesmo
  padrão de `/admin/estrutura`). É também onde o admin marca urgente/conclui — essa tela não exige
  vínculo em setor, diferente do módulo Frota.

**Consequências.** A produção, quando migrada, não terá nenhuma máquina cadastrada (como já não tinha
nenhum talhão até a Fase 5): é cadastro manual do admin. Perguntas em aberto para o cliente, se um dia
importar: se o gerente deveria poder marcar urgente/concluir no próprio setor.
