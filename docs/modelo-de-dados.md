# Modelo de dados (Firestore v2)

Uma avaliação semanal de um talhão vira **1 documento de cabeçalho + 30 documentos de planta**. Assim
cada documento fica pequeno e o app grava planta a planta, mesmo offline. As decisões por trás do
modelo estão em `docs/decisoes/`.

```
catalogo_culturas/{culturaId}                 nome, fichaAtual { fichaId, versao }
catalogo_alvos/{alvoId}                       nome, tipo (praga | doenca | inimigo_natural | indicador)
catalogo_fichas/{fichaId}/versoes/{n}         IMUTÁVEL: itens, regras (níveis), tds, amostragem, fases
plataforma_admins/{uid}                       dono do sistema (criado à mão no console)
users/{uid}                                   só "nome"

empresas/{empresaId}                          nome, status, configuracoes
  membros/{uid}                               uid, papelEmpresa (admin | membro), ativo, nome
  unidades/{unidadeId}                        nome, municipio, ativa
  setores/{setorId}                           unidadeId, nome, modulos[], ativo        (id sem "_")
  vinculos/{uid}_{setorId}                    pessoaUid, setorId, unidadeId, papel (gerente | funcionario),
                                              funcoes[] (pragueiro | agronomo), ativo, versao,
                                              alteradoPor, alteradoEm
    historico/{versao}                        cópia imutável de cada alteração
  safras/{id}                                 culturaId, inicio, fim, ativa
  talhoes/{talhaoId}                          unidadeId, nome, culturaId, variedade, areaHa,
                                              atributos { tipoPomar, citrosVizinhos, ... }, ativo   (id sem "_")
  ajustes/{id}                                culturaId, alvoId | itemId, nivelId?, limite,
                                              vigenteDe (= hora do servidor), criadoPor    (só acrescenta)
  avaliacoes/{talhaoId}_{semanaISO}_{uid}     talhaoId, unidadeId, setorId, safraId?, fichaId, fichaVersao,
                                              atributosTalhao (cópia do talhão), responsavelUid, data,
                                              semanaISO, faseCultura[], status (rascunho | finalizada),
                                              finalizadaEm, notas, outrasPragas, armadilha
    plantas/{1..30}                           n, obs { <itemId>: { A, B } }, fotos[], notas
  decisoes/{avaliacaoId}                      avaliacaoId, talhaoId, unidadeId, setorId, tds[], motivos[],
                                              status (aprovada | rejeitada | executada),
                                              decididoPor/Em, executadoPor/Em
  eventos/{id}                                uid, acao, setorId?, em (trilha de auditoria; só acrescenta)
```

Toda entidade operacional (avaliação, decisão, e as futuras) carrega `unidadeId`, `setorId`,
`talhaoId` e (reservado) `safraId`; `empresaId` está no caminho.

## Como a ficha vira dados

| Na ficha | No app |
|---|---|
| Cada planta é avaliada dos dois lados (quadrantes A e B, terço médio) | `obs.<itemId>.A` e `.B` |
| Célula 0 (ausente), 1, 2, 3 (intensidade: até 5 / 6 a 15 / mais de 15 pragas) | valor do quadrante |
| Célula vazia ou "-" (sem fruto/flor no estágio) | `null` = **não avaliável**; fica fora da conta |
| Bicho-furão (só o lado da armadilha) | só um lado preenchido (o outro `null`); item `lado_unico` |
| NI = COUNTIF(>0) / COUNT | plantas com valor > 0 ÷ plantas avaliadas (`calcularNI`) |
| Linha sem nenhum dado (a planilha mostra 0) | `null` = "sem dados", para não confundir com "sem praga" |
| NA (nível de ação) | níveis da regra na ficha (`niveis[]`), com ajustes da empresa por cima |
| TD1 a TD6 | `td` de cada nível; o motor devolve os TDs disparados |

A planta é positiva se o quadrante A **ou** B for maior que 0 (NI por plantas, como confirmou o
cliente; o manual da Embrapa calcula por frutos, e não é o que se usa aqui).

## Regra de ouro do motor

Praga detectada em item **sem limite definido** nunca resulta em TD1 ("não pulverizar"). O motor
devolve `REVISAR` e lista o item para o agrônomo decidir. O mesmo vale quando nenhum nível da regra
se aplica ao talhão (ex.: falta o atributo `tipoPomar`).

## Consultas exigidas pelas regras

O Firestore só executa uma consulta se ela provar que só devolve o que as regras permitem.

| Quem | Consulta |
|---|---|
| Pragueiro, avaliações | `where setorId == X` **e** `where responsavelUid == uid` |
| Agrônomo e gerente, avaliações e decisões | `where setorId == X` |
| Gerente, vínculos do setor | `where setorId == X` |
| Qualquer pessoa, os próprios vínculos | `where pessoaUid == uid` |
| App, descobrir empresas e setores | grupo de coleções `membros` (`uid == uid`) e `vinculos` (`pessoaUid == uid`) |

Ids compostos (`uid_setorId`, `talhaoId_semanaISO_uid`) só são inequívocos porque setor e talhão
não aceitam `_`. `src/nucleo/caminhos.js` monta todos os caminhos e valida os ids.

## Limites pendentes (nível com `limite: null`)

Enquanto não houver número confirmado, o app sinaliza **REVISAR** quando aparece presença. As
propostas (manual da Embrapa e cliente) ficam no próprio nível, em `proposta`, **desativadas**:

- Cochonilhas ortézia, escama-farinha e parlatória: proposta "foco" (1 planta positiva leva ao TD6)
  e "talhão todo" (todas as plantas levam ao TD3). Rosada, branca e parda: sem proposta.
- Gomose e declínio: proposta de inspecionar todas as plantas (TD6) com 1 planta positiva.
- Pulgão e mosca-negra: sem proposta.
- Bicho-furão: 10 adultos na armadilha, ou 6 em duas semanas seguidas (cliente); precisa de uma
  métrica nova (contagem na armadilha, com a semana anterior).
- Ácaro da ferrugem: 5%, 10% ou 15% conforme o mercado; a empresa escolhe em `ajustes`.
- Intensidade 1/2/3 com antecipação para 5% quando houver nível 3 (cliente): registrada em
  `propostas` da ficha, sem efeito no cálculo.
