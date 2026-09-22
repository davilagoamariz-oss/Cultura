# 019. LGPD: base legal do tratamento e plano para o direito ao esquecimento

**Contexto.** A decisão 008 já minimiza os dados (nome e e-mail, sem CPF, sem dado de saúde) e a 009
já aplica mínimo privilégio no acesso. Faltava registrar duas coisas que uma revisão de adequação à
LGPD (Lei 13.709/2018) apontou como não documentadas: (1) qual é a base legal do tratamento, e (2)
como atender um pedido de exclusão/anonimização, já que o princípio de desenho do sistema inteiro é
"nada se apaga, só se desativa" (unidade, setor, talhão, vínculo, membro).

**Decisão — base legal.** O dado tratado (nome, e-mail, e-mail vinculado ao Firebase Auth, e os
registros de trabalho — avaliações, decisões, uso de máquina) existe para a pessoa exercer sua função
na empresa que a contratou ou para quem ela presta serviço. A base legal é a **execução de contrato**
(LGPD, art. 7º, V) quando há vínculo empregatício ou de prestação de serviço, com o **legítimo
interesse** documentado (art. 7º, IX) como base subsidiária para o que sobrar (ex.: a trilha de
auditoria `eventos`, que existe para a própria empresa se defender e demonstrar conformidade — art.
6º, X, princípio da responsabilização). **Não é consentimento**: a pessoa não "aceita termos" para
usar o app de trabalho, e por isso não há (nem deve haver) uma tela de "aceito os termos" no
primeiro login. O que ela recebe é informação (ver o aviso de privacidade, abaixo), não um pedido de
permissão.

**Decisão — direito ao esquecimento (art. 18, incisos IV e VI).** Quando alguém deixa de ter
qualquer vínculo com a empresa e pede para não ter mais o nome exposto:
1. O **admin desativa o membro** (`membro.ativo = false`) — isso já existe (Fase 5) e imediatamente
   tira a pessoa de todo acesso e das listagens de "quem está ativo".
2. **Anonimizar o nome** (`users/{uid}.nome` e `membros/{uid}.nome`) é a ação que falta implementar:
   apagar o texto do nome, mantendo o `uid` como referência técnica nos registros que já existem
   (avaliações, decisões, histórico de vínculo, eventos, uso de máquina). O `uid` sozinho não
   identifica a pessoa fora do sistema de autenticação da empresa, e mantê-lo é necessário para a
   trilha de auditoria continuar íntegra (base legal: cumprimento de obrigação legal/regulatória e
   exercício de direitos em processo, art. 7º, II e VI, quando aplicável; do contrário, legítimo
   interesse documentado, com prazo de retenção definido pela empresa).
3. **Não excluir os registros operacionais** (avaliações, decisões): são dados da EMPRESA sobre o
   talhão e a decisão tomada, não dados pessoais por si (o nome de quem fez already sai no passo 2).
4. Esta ação (anonimizar) **ainda não está implementada** — é cadastro que falta (uma tela ou script
   de admin que grava `nome: null` nos dois documentos, dentro do que as regras já permitem, já que
   quem edita `membros/{uid}` e `users/{uid}` é o próprio admin/o próprio usuário). Fica registrada
   aqui como a próxima peça, para quando o primeiro pedido de exclusão acontecer ou por decisão do
   cliente de implementar preventivamente.

**O que fica de fora desta decisão** (é jurídico/operacional, não técnico, e cabe ao cliente):
- Confirmar a base legal com um advogado antes de publicar o aviso de privacidade.
- Aceitar o DPA (Data Processing Amendment) da Google para Firebase/Google Cloud, se ainda não
  aceito.
- Confirmar a região do projeto Firebase (idealmente `southamerica-east1`, para reduzir a
  transferência internacional de dados).
- Definir um processo de resposta a incidente (comunicação à ANPD e aos titulares, art. 48).
- Avaliar se o volume de dados exige nomear um encarregado (DPO, art. 41).

**Consequências.** Nenhuma mudança de código nesta decisão (é registro de política); a implementação
da anonimização fica como item de backlog, citado aqui para não se perder.
