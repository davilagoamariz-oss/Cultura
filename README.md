# Ronda do Pomar: monitoramento de pragas e doenças do limão Tahiti

Plataforma para várias empresas: cada empresa tem unidades (fazendas) e setores, e cada pessoa vê os
módulos dos setores em que tem vínculo. O primeiro módulo é **Fitossanidade**: app de campo (PWA,
funciona offline) e acompanhamento, com cálculo do nível de infestação (NI) e sugestão de tomada de
decisão (TD), seguindo a ficha FFPRO02. A cultura (hoje limão Tahiti) é **dado versionado**, não código.

**Stack:** GitHub (código) · Firebase (Auth e Firestore, plano Spark) · Vite + React (PWA).
Hospedagem ainda não configurada.

## Estado

Na branch `dev`: **Fase 1** (motor v2, catálogo e ficha do limão em dados, `firestore.rules` v2 com
testes, seed com duas empresas), **Fase 2** (casca do app: login, empresa, menu por módulo, setor,
online/offline), **Fase 3** (Fitossanidade no campo: escolha do talhão, ficha por planta gerada da
ficha, quadrantes A/B, lado único, notas, fotos em fila local, aviso de avaliação duplicada, resumo com
NI e TD, finalização e trabalho sem rede) e **Fase 4** (gestão: acompanhamento da semana, decisão do
agrônomo, execução pelo gerente e gestão de vínculos com histórico). A administração do cadastro
(unidades, setores, talhões, ajustes) é a próxima fase (ver `docs/plano-v2.md`).
**As regras v2, os índices e a migração dos dados ainda não foram aplicados no Firebase real.**

## Onde está o quê

```
catalogo/                    dados versionados: alvos, cultura e ficha limao-tahiti v1
regras/regras-iniciais.json  fonte da ficha do limão (convertida por scripts/converter-regras-iniciais.mjs)
src/dominio/motor/           motor de regras v2 (função pura): métricas, níveis, ajustes
src/dominio/fichas/          validador e conversor de fichas
src/nucleo/                  firebase, caminhos do banco, sessão, menu por módulo, permissões, guardas de rota
src/modulos/                 registro fixo de módulos e as telas de cada módulo (hoje: fitossanidade)
src/campo/                   ficha de campo: lógica pura, repositório do Firestore, autosave, telas do pragueiro
src/offline/                 online/offline, itens aguardando envio, fotos em fila local (IndexedDB)
src/gestao/                  decisão e execução, vínculos com histórico, repositório e telas do agrônomo e do gerente
docs/propostas/              mudanças de regras propostas e ainda NÃO aplicadas (aguardam confirmação)
src/paginas/                 telas gerais (início)
firestore.rules              segurança do banco (empresa > setor > vínculo > módulo)
firestore.indexes.json       índices (grupos de coleções membros e vinculos)
scripts/                     semear e verificar nos emuladores, converter a ficha, migrar produção (v2)
test/                        testes do motor, fichas, caminhos, menu, guardas, telas renderizadas e regras (emulador)
docs/                        plano-v2, modelo-de-dados, decisoes/ (uma página por decisão)
```

Leia primeiro: `docs/decisoes/README.md` (as decisões), `docs/modelo-de-dados.md` (as coleções) e
`docs/plano-v2.md` (o plano e as fases). `docs/arquitetura.md` é o desenho anterior, já substituído.

## Testes

```
npm test                 # motor, fichas, caminhos, menu, guardas e telas renderizadas (rápido; Node 20+; inclui a renderização das telas e a fila de fotos)
npm run test:rules       # firestore.rules no emulador (106 verificações, duas empresas; precisa de Java 21)
npm run test:fluxo       # nos emuladores: menu por usuário, jornada do pragueiro (com trabalho sem rede) e a gestão (decisão, execução, vínculos)
npm run test:migracao    # nos emuladores: prova a migração de produção (simula, aplica, repete, entra como davi e paulo)
npm run build            # gera dist/
```

## Desenvolvimento local (sem tocar no Firebase real)

Precisa de Java 21 e do `firebase-tools`.

```
npm run emuladores       # terminal 1: Auth + Firestore locais
npm run semear           # terminal 2: catálogo do limão, duas empresas, setores, vínculos e usuários
npm run test:fluxo       # ou: sobe tudo sozinho, semeia e verifica o fluxo
```

Usuários de demonstração (senha `senha123`): `admin@demo.test` (admin da empresa e dono da
plataforma), `gerente@demo.test`, `agro@demo.test` (agrônomo nas duas empresas), `paulo@demo.test`
(pragueiro), `motorista@demo.test` (só Frota), `semvinculo@demo.test`, `admin2@demo.test` e
`pragueiro2@demo.test` (segunda empresa).

Para ver o app funcionando localmente: deixe `npm run emuladores` e `npm run semear` rodando e, em outro
terminal, `npm run dev:emulador` (http://localhost:5174). Entre com cada usuário para ver menus
diferentes: o `motorista@demo.test` não vê Fitossanidade, o `agro@demo.test` escolhe entre duas empresas.

## Configuração

Copie `.env.example` para `.env.local` (nunca versionar) e preencha a configuração web do Firebase
(Console > Configurações do projeto > Seus apps > Web). Ela não é segredo; quem protege os dados são as
regras. O nome do sistema vem de `VITE_APP_NAME` (padrão: Ronda do Pomar).

## Firebase (resumo)

1. **Authentication**: ative e-mail/senha. **Firestore**: modo produção, região `southamerica-east1`
   (não muda depois). Plano **Spark**: não ative Storage nem Cloud Functions.
2. Regras e índices: `firebase deploy --only firestore` (só depois de revisar o diff e testar).
3. **Dono da plataforma e primeira empresa**: criados à mão, uma única vez (`plataforma_admins/{uid}`,
   `empresas/{id}` e o primeiro `membros/{uid}` com `papelEmpresa: admin`). Os dados atuais de produção
   migram para a v2 com `node scripts/migrar-producao-v2.cjs` (simula; `--aplicar` grava). Os demais
   usuários são criados no console do Firebase; o admin da empresa os liga à empresa e aos setores pelo app.
4. Ao publicar o app, adicione o domínio em Authentication > Configurações > Domínios autorizados.

## Pendências de definição

Limites com `null` na ficha (o app sinaliza **REVISAR** quando aparece presença): cochonilhas,
gomose, pulgão, mosca-negra, declínio e bicho-furão; ácaro da ferrugem (5%, 10% ou 15% por mercado,
definido em ajustes da empresa). As propostas do manual da Embrapa e do cliente estão registradas,
desativadas, em `docs/modelo-de-dados.md`. Um agrônomo precisa confirmá-las.

## Importante

O app sugere o **tipo** de decisão (acaricida, inseticida, fungicida, poda, inspeção). Produto e dose
dependem de receituário agronômico, que continua sendo responsabilidade do engenheiro agrônomo. O
tempo entre a inspeção e a aplicação deve ser curto (o manual da Embrapa recomenda no máximo 3 dias).
