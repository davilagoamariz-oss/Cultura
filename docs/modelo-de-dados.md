# Modelo de dados (Firestore)

Uma avaliação semanal de um talhão vira **1 documento de cabeçalho + 30 documentos de planta**.
Assim cada documento fica pequeno e o app grava planta a planta, mesmo offline.

```
users/{uid}                 papel: pragueiro | gestor | agronomo | admin
fazendas/{id}               nome
talhoes/{id}                fazendaId, gleba, nome, areaHa, tipoPomar ('adulto'|'novo'),
                            citrosVizinhos (bool), overrides { ferrugem_bgude: 0.10, ... }
config/regras               cópia de regras/regras-iniciais.json (editável pelo admin)

avaliacoes/{aid}            talhaoId, data, semanaISO, responsavelUid, faseCultura [..],
                            horaInicio, horaFim, geo, status ('rascunho'|'finalizada')
  plantas/{n}               n (1..30), obs { <itemId>: { A: 0|1|null, B: 0|1|null } },
                            fotos [ { itemId, quadrante, caminho } ], notas

resultados/{aid}            (servidor) NI por item, TD sugerido        -> escrito pela Cloud Function
decisoes/{did}              (servidor) avaliacaoId, talhaoId, tds, motivos, status, criadoEm
                            gestor altera apenas: status, aprovadoPor, aprovadoEm, observacao
```

Fotos ficam no Cloud Storage em `avaliacoes/{aid}/{arquivo}`; o documento da planta guarda só o caminho.

## Como a ficha vira dados

| Na ficha | No app |
|---|---|
| Célula 0 / 1 / 2 | `A` e `B` (0 ou 1 cada). O valor da planta é a soma (quadrantes com a praga). |
| Célula vazia ou "-" (sem fruto/flor no estágio) | `null` = não avaliável. Fica fora da conta. |
| NI = COUNTIF(>0) / COUNT | `calcularNI()`: plantas com valor > 0 ÷ plantas avaliadas. |
| Linha sem nenhum dado (planilha mostra 0) | `null` = "sem dados", para não confundir com "sem praga". |
| Bicho-furão (só o lado da armadilha) | só um lado preenchido; o outro fica `null`. |
| NA (nível de ação) | tabela `config/regras`, editável, com limite por item. |
| TD1 a TD6 | campo `td` da regra; o motor devolve os TDs disparados. |

## Regra de ouro do motor

Praga detectada em item **sem limite definido** nunca resulta em TD1 ("não pulverizar").
O motor devolve `REVISAR` e lista o item para o gestor/agrônomo decidir.

## Pendências de definição (limite = null nas regras)

Cochonilhas (ortézia, escama-farinha, parlatória, rosada, branca, parda), gomose, pulgão,
mosca-negra, declínio e bicho-furão: a ficha só diz "Nº PLANTAS" ou nada. Enquanto não houver
número, o app avisa "revisar manualmente" quando aparecer presença.
