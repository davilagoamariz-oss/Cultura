# 004. Ajustes de limite só acrescentam

**Contexto.** A empresa escolhe limites (ex.: ferrugem 5%, 10% ou 15% conforme o mercado). O limite
efetivo não pode mudar retroativamente nem ser baixado por quem avalia para esconder uma infestação.

**Decisão.** `ajustes` guarda sobrescritas por cultura e alvo (ou item), sempre acrescentando um
registro novo com `vigenteDe == request.time` (não dá para voltar no tempo); nada se altera nem
apaga. O resultado de uma avaliação usa os ajustes vigentes em `finalizadaEm`. O cabeçalho da
avaliação guarda cópia dos atributos do talhão (`atributosTalhao`), e as regras exigem que sejam
idênticos aos do talhão na criação.

**Consequências.** Resultados antigos são reproduzíveis. Só o admin da empresa escreve ajustes (o
agrônomo também poderá, se a empresa decidir). Ajuste sem `nivelId` só vale em regra de nível único.
