# Proposta 001: leitura dos registros de membros pelos colegas da empresa

**Estado: PROPOSTA, não aplicada.** O `firestore.rules` do repositório não foi alterado. Precisa da confirmação
do dono do projeto antes de entrar (e, como toda mudança de regras, de um deploy separado).

## O problema

Hoje só o **admin** da empresa lê e lista os registros de `empresas/{e}/membros` (cada pessoa lê o próprio).
Consequências já verificadas nos emuladores (`npm run test:fluxo`, seção 10):

1. **O gerente e o agrônomo não veem o nome de ninguém.** As telas de acompanhamento e de vínculos mostram um
   trecho do código (`pessoa 5YPzD3…`) no lugar do nome do pragueiro, do colega e de quem alterou um vínculo.
2. **O gerente não consegue escolher quem ligar ao setor.** As regras já permitem que ele crie o vínculo de um
   funcionário no próprio setor, mas ele não pode listar os membros para escolher. Só o admin adiciona pessoas.

## A mudança mínima

Em `firestore.rules`, dentro de `match /membros/{uid}`:

```diff
-        allow get: if logado()
-          && (request.auth.uid == uid || ehAdmin(e) || ehAdminPlataforma());
-        allow list: if ehAdmin(e) || ehAdminPlataforma();
+        // Todo membro ativo lê o registro dos colegas (uid, papelEmpresa, ativo, nome): é o que permite mostrar
+        // nomes e escolher quem ligar a um setor. A escrita continua só do admin.
+        allow get: if logado()
+          && (request.auth.uid == uid || membroAtivo(e) || ehAdminPlataforma());
+        allow list: if membroAtivo(e) || ehAdminPlataforma();
```

Nada mais muda: `create` e `update` de membros seguem só do admin (ninguém edita o próprio registro).

## O que isto expõe

Para qualquer membro **ativo** da mesma empresa: o `nome`, o `papelEmpresa` (admin ou membro), se está `ativo` e
o `uid` dos colegas. Não expõe e-mail, telefone, CPF nem nada de outra empresa. Membro inativo, pessoa de outra
empresa e anônimo continuam sem ler nada. O nome já é o único dado pessoal guardado (decisão 008).

## Evidência

A mudança foi testada numa **cópia temporária** das regras (não commitada), com 4 casos, todos passando:
membro ativo lê e lista os colegas; inativo, de outra empresa e anônimo não leem; a escrita continua só do admin
(ninguém sobe o próprio papel); e o grupo de coleções `membros` continua exigindo o filtro por `uid`.

## Alternativa mais estreita

Permitir só o `get` (não o `list`): resolve os **nomes**, mas o gerente continuaria sem escolher quem adicionar
(só o admin adiciona). É menos exposição e menos funcionalidade.

## Se aprovada

1. Aplicar o diff acima em `firestore.rules`; incluir os 4 casos em `test/rules/firestore.rules.test.js`.
2. A tela de vínculos do gerente passa a oferecer "Adicionar pessoa" (hoje ela mostra "peça ao administrador").
3. Publicar junto com as demais regras v2 (`firebase deploy --only firestore`).
