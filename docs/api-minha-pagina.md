# Minha página — contrato de dados

## Acesso

A rota de interface `/minha-pagina` está disponível para qualquer sessão autenticada. Ela usa o cliente Supabase da própria sessão e não utiliza `service_role`.

## Tarefas pessoais

A interface consulta `personal_tasks` ordenando por `due_date` e `created_at`. Criação e edição persistem `title`, `note`, `due_date` e `priority`; conclusão e reabertura alteram `status`. O banco deriva o proprietário da sessão e mantém `created_at`, `updated_at` e `completed_at` pelo trigger de auditoria.

Embora a criação envie o identificador da sessão para satisfazer o tipo gerado, esse valor não é uma autorização: o trigger o substitui por `auth.uid()` e a policy de inserção valida o resultado. Consulta, alteração e exclusão continuam limitadas pelas policies de proprietário.

Não há endpoint administrativo para tarefas de terceiros.

## Preferências e widgets

`personal_page_preferences` persiste `show_robot_table` por usuário. `personal_page_flows` persiste somente os IDs dos Fluxos escolhidos. A interface resolve esses IDs contra os dados que `FlowsDataProvider` já recebeu sob RLS e reutiliza `RobotsOverviewTable` com os dados autorizados de `AppDataProvider`.

As preferências não fazem consultas com `service_role`, não duplicam dados operacionais e não carregam detalhes, nodes, edges ou versões dos Fluxos selecionados. Esses dados continuam sendo buscados somente ao abrir a rota de um Fluxo.
