# 022. "Esqueci minha senha"

**Contexto.** Continuando a busca por pontos de melhoria: ninguém se autocadastra (o usuário nasce
no console do Firebase — decisão 010, convites fora da v2), e não havia nenhum jeito de recuperar a
senha pelo próprio app. Esquecer a senha travava a pessoa até o administrador entrar no console e
resetar na mão — um obstáculo real para um público de campo, nem sempre habituado com senhas.

**Decisão.** `sendPasswordResetEmail` do Firebase Auth (SDK do cliente, sem Functions, funciona no
plano Spark): `Sessao.jsx` ganha `recuperarSenha(email)`, ao lado de `entrar`/`sair`; `Login.jsx`
ganha um link "Esqueci minha senha" que troca o formulário por um pedido de e-mail. A mensagem de
sucesso não diz se o e-mail existe (o próprio Firebase já não revela isso, por segurança).

**Consequências.** Nenhuma mudança de regras nem de modelo de dados. Limite conhecido: quem recebe o
e-mail escolhe a nova senha numa página padrão do Firebase (fora do app, sem a marca do sistema);
personalizar essa página exigiria configurar um domínio de ação no console — deixado para depois, se
incomodar.
