# 008. LGPD: dados pessoais mínimos

**Decisão.** Coletamos só nome e e-mail (no Firebase Auth). Sem CPF e sem dado de saúde nesta fase.
`users/{uid}` guarda apenas o nome, e o próprio usuário só escreve esse campo. Os vínculos guardam o
uid, não dados pessoais. Todos os dados de uma empresa ficam numa árvore só (decisão 001), o que
facilita exportar ou apagar tudo de uma empresa.

**Consequências.** Qualquer campo pessoal novo exige nova decisão e revisão das regras.
