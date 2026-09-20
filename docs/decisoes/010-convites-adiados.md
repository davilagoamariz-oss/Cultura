# 010. Convites por e-mail adiados

**Contexto.** A versão v1 das regras tinha convites com e-mail verificado (testados). O briefing v2
mantém a criação de usuários pelo console do Firebase por enquanto.

**Decisão.** Os convites saem das regras v2 e da camada de dados, para reduzir a superfície de
ataque. O admin cria o usuário no console e depois o vínculo à empresa (`membros`) pelo app.

**Consequências.** O código dos convites continua no histórico do Git (commits da parte 1 das regras
multiempresa). Reintroduzir na fase de administração, agora criando só `membros` (papel `membro`, sem
vínculo); os vínculos por setor seguem depois.
