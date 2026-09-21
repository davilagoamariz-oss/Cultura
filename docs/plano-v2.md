# Plano v2 (Fase 0): empresas, unidades, setores e cultura como dado

**Estado:** aprovado em 2026-09-20; as **Fases 1 a 5 estão implementadas** na branch `dev`
(Fase 1: motor v2, catálogo e ficha do limão, regras v2 com 106 testes, seed com duas empresas,
decisões em `docs/decisoes/`. Fase 2: casca do app com menu por módulo, escolha de empresa e setor,
guardas de rota, telas testadas por renderização, migração de produção provada nos emuladores.
Fase 3: Fitossanidade no campo, com trabalho sem rede provado nos emuladores. Fase 4: acompanhamento,
decisão, execução e vínculos com histórico, sem mudar as regras; uma mudança de regras foi **proposta** em
`docs/propostas/001-leitura-dos-membros.md`, aguardando confirmação).
Fase 5: administração do cadastro (estrutura, membros, limites de ação, fichas), também sem mudar as regras. Onde este plano diverge do código, vale o código
e as decisões em `docs/decisoes/`; divergências conhecidas: o índice `vinculos.pessoaUid`, convites
fora da v2 e o setor sem `_` no id.

Substitui o desenho de `docs/arquitetura.md` (que já tinha empresa por caminho, mas papéis fixos por
empresa) e reaproveita o que já existe.

## 1. O que muda em relação ao que já está pronto

| Já pronto (dev) | Em v2 |
|---|---|
| `empresas/{id}/membros` com papel fixo (pragueiro, agrônomo, gerente, admin) | `membros` só diz se a pessoa é da empresa (`admin` ou `membro`). O que ela faz vem dos **vínculos por setor**. |
| Escopo por lista de fazendas (`fazendaIds`) | Escopo pelo **setor** (que pertence a uma unidade/fazenda). |
| Ficha do limão escrita no código e no `regras-iniciais.json` | **Catálogo e ficha versionados** como dados; a tela de campo é gerada da ficha. |
| Motor com regras do limão (`limitePorTipoPomar`, `citrosVizinhos`) | **Motor v2**: métricas plugáveis, níveis por regra, gatilhos pequenos e ajustes da empresa. |
| Convites por e-mail nas regras | Fora da v2 (ver decisão 5). |

Reaproveitado: `caminhos.js` (estendido), `Sessao.jsx` (passa a ler vínculos), emulador e seed
(passa a ter duas empresas), a estrutura dos testes de regras, `motor-regras.js` (evolui).
Reescrito: `firestore.rules` e seus testes, telas de escolha de empresa/setor.

## 2. Camadas

1. **Núcleo (código único):** empresa, unidade, setor, talhão, safra, pessoas, vínculos,
   avaliações, decisões, auditoria.
2. **Configuração da cultura (dados versionados):** catálogo de alvos, culturas, ficha
   (itens, órgãos, quadrantes, método de amostragem, níveis de ação e TDs).
3. **Código específico:** só quando uma cultura futura pedir um método de amostragem novo.

Regras de ouro: o nível de ação pertence ao par (cultura, alvo); cada avaliação guarda
`fichaId` + `fichaVersao`; a empresa sobrescreve limites em **ajustes** sem tocar no catálogo; toda
entidade operacional carrega `empresaId` (pelo caminho), `unidadeId`, `setorId`, `talhaoId` e `safraId`.

## 3. Modelo de dados final

```
catalogo_culturas/{culturaId}                 nome, fichaAtual {fichaId, versao}
catalogo_alvos/{alvoId}                       nome, tipo (praga|doenca|inimigo_natural), aliases
catalogo_fichas/{fichaId}/versoes/{n}         IMUTÁVEL: culturaId, itens, regras, tds, amostragem, fases
plataforma_admins/{uid}                       dono do sistema (criado à mão)
users/{uid}                                   só "nome"

empresas/{eid}                                nome, status, configuracoes
  membros/{uid}                               papelEmpresa (admin|membro), ativo, nome
  unidades/{unidadeId}                        nome, municipio, ativa
  setores/{sid}                               unidadeId, nome, modulos[], ativo        (sid sem "_")
  vinculos/{uid}_{sid}                        pessoaUid, setorId, unidadeId, papel (gerente|funcionario),
                                              funcoes[], ativo, versao, alteradoPor, alteradoEm
    historico/{versao}                        registro imutável de cada alteração
  talhoes/{tid}                               unidadeId, nome, culturaId, variedade, areaHa,
                                              atributos { tipoPomar, citrosVizinhos, ... }, ativo
  safras/{id}                                 culturaId, inicio, fim
  ajustes/{id}                                culturaId, itemId, limite, vigenteDe   (só acrescenta)
  avaliacoes/{talhaoId}_{semanaISO}_{uid}     talhaoId, unidadeId, setorId, safraId?, fichaId, fichaVersao,
                                              atributosTalhao (cópia), responsavelUid, data, semanaISO,
                                              faseCultura[], status (rascunho|finalizada), finalizadaEm
    plantas/{1..30}                           obs { itemId: { A, B } }, notas, fotos
  decisoes/{avaliacaoId}                      setorId, tds, status (aprovada|rejeitada|executada), quem/quando
  eventos/{id}                                trilha de auditoria (só acrescenta)
```

Críticas ao modelo proposto, e o que adotei:

- **`catalogo/culturas/{id}` não existe no Firestore** (o caminho alterna coleção e documento).
  Usei coleções de topo `catalogo_*`.
- **Talhão não pertence a um setor**, e sim a uma unidade: vários setores (Fitossanidade,
  Colheita) usam o mesmo talhão. O `setorId` fica nos dados **operacionais** (avaliação, decisão).
- **`users/{uid}` sem lista de empresas.** Um campo que o próprio usuário escreve fica velho ou
  forjado. O app descobre as empresas e os setores por consultas em `membros` e `vinculos`
  (grupo de coleções, filtrando pelo uid).
- **Funções dentro do módulo.** Só "gerente | funcionário" não separa quem avalia (pragueiro) de
  quem decide (agrônomo). O vínculo ganha `funcoes[]`, com vocabulário fixo por módulo
  (Fitossanidade: `pragueiro`, `agronomo`). `papel` continua sendo autoridade sobre vínculos.
- **ID composto do vínculo com separador proibido.** `uid_sid` só é seguro se o `sid` não puder
  conter `_`; senão `uid="a" + sid="b_c"` colide com `uid="a_b" + sid="c"`. As regras exigem que o
  id do setor seja `[a-z0-9-]+` e que o id do vínculo seja exatamente `pessoaUid_setorId`.
- **Reprodutibilidade:** o limite efetivo depende de ficha, atributos do talhão e ajustes.
  A avaliação guarda cópia dos atributos do talhão (as regras exigem que bata com o talhão na
  criação), e os ajustes só acrescentam com `vigenteDe == request.time` (não dá para voltar no
  tempo); o cálculo usa os ajustes vigentes em `finalizadaEm`. Assim ninguém baixa um limite para
  esconder uma infestação, e o resultado antigo não muda.
- **Versão da ficha não é escolha do pragueiro.** A regra exige `fichaVersao ==
  catalogo_culturas/{cultura}.fichaAtual.versao` na criação.

## 4. Acesso: matriz de segurança (firestore.rules v2)

Auxiliares: membro ativo da empresa; admin da empresa; vínculo ativo no setor; setor ativo com o
módulo habilitado; gerente do setor; função no setor.

| Recurso | Ler | Criar | Alterar |
|---|---|---|---|
| Catálogo (culturas, alvos, fichas) | qualquer autenticado | admin da plataforma | fichas: **nunca** (versão nova = documento novo); demais: plataforma |
| `empresas/{e}` | membro ativo | plataforma | plataforma |
| `membros` | o próprio; admin da empresa | admin da empresa (e plataforma, para o 1º admin) | admin da empresa; ninguém edita o próprio; `papelEmpresa: admin` só admin/plataforma; nunca apaga |
| `unidades`, `setores`, `safras`, `talhoes` | membro ativo | admin da empresa | admin da empresa; `setores.modulos` ⊂ lista fixa de módulos |
| `vinculos` | o próprio; gerente do setor; admin | admin (qualquer papel); **gerente só `funcionario` no próprio setor**, para membro ativo, nunca para si | só `ativo`, `funcoes`, auditoria e `versao+1`; gerente não toca vínculo de gerente nem o próprio; **promoção a gerente só o admin**; nunca apaga |
| `vinculos/.../historico` | gerente do setor; admin | quem alterou (imutável) | nunca |
| `ajustes` | membro ativo | admin da empresa (`vigenteDe == request.time`) | nunca |
| `avaliacoes` | dono com função pragueiro; agrônomo e gerente do setor | função **pragueiro** no setor, módulo ativo, ficha vigente, id no padrão | só o dono, só em rascunho; identidade não muda; finalizar exige `finalizadaEm == request.time` |
| `plantas` | como a avaliação | como a avaliação, só em rascunho | idem |
| `decisoes` | agrônomo e gerente do setor | função **agrônomo**, avaliação finalizada, id = avaliação | gerente do setor marca `executada` |
| `eventos` | admin e agrônomo | qualquer membro, só o próprio evento | nunca |

Princípios: nega tudo por padrão; sem membro ativo, nada; **o admin da empresa não lê dados
operacionais sem vínculo** (mínimo privilégio; se quiser ver, ele se vincula); a plataforma não lê
dados das empresas; nada é apagado; consultas do pragueiro filtram por `responsavelUid` e
`setorId`.

Custo de leituras nas regras (limite de 10 `get()` por requisição): criar avaliação ≈ 5
(membro, vínculo, setor, talhão, cultura); gravar planta ≈ 3 (membro, vínculo, avaliação);
gerente criar vínculo ≈ 4. Folga suficiente. Com o plano pago, claims reduzem isso.

Testes no emulador, com duas empresas: vazamento entre empresas; motorista (só Frota) sem acesso a
Fitossanidade; gerente alterando vínculo de outro setor; gerente se promovendo ou promovendo outro;
funcionário alterando o próprio vínculo; avaliação finalizada editada; usuário inativo; ajuste
retroativo; ficha antiga escolhida; colisão de id de vínculo; setor com módulo desabilitado.

## 5. Motor de regras v2

- **Métricas plugáveis:** registro `METRICAS`. Agora: `percent_plantas` (comportamento atual,
  com `null` = "não avaliável", `0` = "ausente" e "sem dados" ≠ 0) e `plantas_positivas`
  (contagem, para focos). O registro deixa espaço para `contagem_armadilha` (bicho-furão).
- **Vários níveis por regra**, ordenados por `gravidade` explícita na ficha; vence o mais grave e o
  resultado registra `nivelDisparado`. Ex.: cochonilha com foco: 1 planta positiva → TD6; todas → TD3.
- **Limite por contexto, sem campos fixos do limão:** cada nível tem `quando` (vocabulário
  pequeno: atributo do talhão igual a um valor; intensidade mínima com nº mínimo de plantas).
  Ordem de resolução: ajuste da empresa > nível cujo `quando` bate > limite padrão do nível.
- **Preservado:** REVISAR (praga sem limite nunca vira TD1), itens informativos (SNA), produto
  seletivo, operadores `>` e `>=`, planta positiva se A **ou** B > 0.
- **Ficha versionada:** `regras/regras-iniciais.json` é convertido para `limao-tahiti` v1 por
  script; `limitePorTipoPomar` vira níveis com `quando`; `condicao: citros_vizinhos` vira
  `aplicaSe`; `pendente` vira `proposta` desativada. Os 10 testes atuais continuam, mudando só o
  formato de entrada.
- **Tipos de item (vocabulário fixo, sem construtor de formulários):** `presenca_quadrante`
  (com escala de intensidade 0 a 3 quando o alvo pedir), `lado_unico`, `contagem`, `escala`.

## 6. Estrutura de pastas

```
catalogo/                        dados versionados no repositório (semente do catálogo)
  culturas/  alvos.json  fichas/limao-tahiti.v1.json
src/nucleo/                      firebase, caminhos, sessão (membro + vínculos + setores), permissões
src/modulos/registro.js          registro FIXO de módulos: rótulo, funções, rotas
src/modulos/fitossanidade/       campo/ e gestao/ (as telas são geradas da ficha)
src/dominio/motor/               motor v2, métricas, níveis, gatilhos
src/dominio/fichas/              validação do formato da ficha e conversões
src/admin/  src/plataforma/
scripts/                         semear-emulador (2 empresas), converter-regras-iniciais, migrar-v2
docs/decisoes/                   uma página curta por decisão (ADRs)
```

Módulos futuros (Aplicações, Insumos, Frota, Manutenção, Colheita, Pessoas/SST, Clima, Solo,
Compras, Custos) **não são implementados**: só ficam reservados no registro de módulos e nos campos.

## 7. Fases

| Fase | Entrega | Verificação |
|---|---|---|
| 1 Fundação | Motor v2; catálogo e ficha do limão; `firestore.rules` v2; seed com 2 empresas; ADRs | `npm test` (os 10 testes + novos), testes de regras (matriz acima), build |
| 2 Casca | Login, escolha de empresa/unidade/setor, menu só com os módulos permitidos, cache offline, online/offline | testes de lógica + teste ponta a ponta com emulador |
| 3 Fitossanidade no campo | Talhão, tela por planta gerada da ficha, quadrantes A/B, lado único, notas, fila de fotos, aviso de duplicada, resumo NI/TD, finalização | testes + emulador |
| 4 Gestão | Avaliações da semana, NI/TD, REVISAR, produto seletivo, aprovar/rejeitar, gestão de vínculos com histórico | testes de regras das decisões |
| 5 Administração | Unidades, setores, talhões, ajustes, importação da ficha | testes |

Cada fase termina com uma parada para você. Nada vai para produção sem o diff e o seu OK.

## 8. Desenho previsto para a IA (futuro, não implementar)

Chave da API só no servidor (nunca no app). A IA enxerga apenas o que o usuário que perguntou pode
ver (mesmas permissões, aplicadas antes de montar o contexto). Consultas pré-definidas, não SQL ou
caminhos livres. Todo número vem de código, não do texto gerado. Sempre cita a origem dos dados
(avaliação, talhão, semana). Nunca sugere produto nem dose de agrotóxico. Depende do plano pago
(servidor).

## 9. LGPD

Mínimo de dados pessoais: nome e e-mail (no Auth). Sem CPF e sem dado de saúde nesta fase. Dados
por empresa, na mesma árvore, o que facilita exportar ou apagar tudo de uma empresa.

## 10. Decisões que dependem de você

1. **Funções no vínculo** (`funcoes[]`: pragueiro, agrônomo). Recomendo sim.
2. **Talhão pertence à unidade** (não a um setor) e cadastros base (unidades, setores, talhões,
   safras, ajustes) são legíveis por **todo membro ativo** da empresa. Recomendo sim; a alternativa
   (restringir por unidade) exige mais leituras nas regras.
3. **Admin da empresa não lê dados operacionais sem vínculo.** Recomendo sim.
4. **Quem escreve ajustes de limite:** só o admin da empresa (como no briefing) ou também o
   agrônomo do setor. Recomendo admin, por ora.
5. **Convites por e-mail:** remover da v2 agora (menos superfície) e reintroduzir com a fase de
   administração, ou manter só para criar `membro` sem vínculo. Recomendo remover por ora.
6. **Regras do cliente ainda por confirmar** (viram "proposta" desativada e o app mostra REVISAR):
   bicho-furão (6 adultos em duas semanas seguidas ou 10; contagem na armadilha); intensidade 1/2/3
   com antecipação para 5% quando houver nível 3; limites das cochonilhas, gomose, pulgão,
   mosca-negra e declínio; ácaro da ferrugem 5/10/15% por mercado.
7. **Dono da plataforma:** confirmar que `davi` (teste1231@gmail.com) recebe `plataforma_admins`.
8. **Nome:** o sistema se chama **Ronda do Pomar**; uso `VITE_APP_NAME` com esse padrão.
9. **Produção:** não publicar as regras v1 (multiempresa simples) e publicar só a v2. Os 2
   usuários hoje ligados a `empresas/exemplo-1` seriam migrados para a v2 por script (empresa,
   unidade, setor Fitossanidade, vínculos), com o seu OK.
