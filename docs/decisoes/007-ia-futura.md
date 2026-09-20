# 007. Desenho previsto para a IA (futuro, não implementar)

**Contexto.** Há interesse em perguntas em linguagem natural sobre os dados. Nada disso existe hoje.

**Decisão (princípios para quando vier).**
- A chave da API do modelo fica só no servidor, nunca no app (exige plano pago).
- A IA enxerga apenas o que o usuário que perguntou pode ver: as mesmas permissões (empresa, setor,
  módulo) são aplicadas antes de montar o contexto.
- Consultas pré-definidas, não caminhos livres nem SQL gerado.
- Todo número vem de código (motor, agregações), não do texto gerado.
- Sempre cita a origem dos dados (avaliação, talhão, semana).
- Nunca sugere produto nem dose de agrotóxico: isso é receituário do engenheiro agrônomo.

**Consequências.** As regras atuais (acesso por empresa/setor/módulo) já são a base dessa camada.
