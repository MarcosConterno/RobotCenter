# Documentação Robot Center — contrato inicial

## Escopo desta etapa

A rota `/robos/[id]/documentacao-robot-center` é exclusiva para Admin e apresenta somente o estado da estrutura interna. Não existem ainda endpoints de edição, publicação, geração DOCX/PDF ou upload de imagens.

## Dados consultados

- sessão autenticada por `supabase.auth.getUser()`;
- papéis em `user_roles -> roles`;
- Robô autorizado em `robos`;
- raiz e rascunho em `robot_center_documentations -> robot_center_documentation_drafts`.

As consultas usam a sessão do usuário e permanecem sujeitas a RLS. Nenhum `client_id` recebido do frontend determina autorização.

## Evolução prevista

A futura API deverá separar visualização publicada (`robot_center_documentation.read`) de rascunho/publicação (`robot_center_documentation.manage`). As RFs serão consultadas de `regras_robo` por `robo_id` e `ordem`, sem duplicação.
