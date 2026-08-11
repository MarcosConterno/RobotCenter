# Minha página — contrato de dados

## Acesso

A rota de interface `/minha-pagina` está disponível para qualquer sessão autenticada. Ela usa o cliente Supabase da própria sessão e não utiliza `service_role`.

## Tarefas pessoais

A interface consulta `personal_tasks` com os relacionamentos opcionais de Cliente, Reunião e Nota, ordenando por `due_date` e `created_at`. Criação e edição persistem `title`, `due_date`, `priority`, `status`, `client_id` e origens opcionais. O bloco de nota persiste separadamente `note`, aceitando o formato rico controlado já usado em Notas e Reuniões. O banco deriva o proprietário da sessão e mantém `created_at`, `updated_at` e `completed_at` pelo trigger de auditoria.

Novos ToDos usam `status = todo`. Os estados aceitos são `open_task`, `budget`, `todo`, `waiting_server_update`, `waiting_stack`, `testing`, `waiting_dev`, `waiting_client`, `in_progress` e `completed`. As prioridades aceitas são `urgent`, `high`, `medium` e `low`. A FK opcional `client_id` usa `on delete set null` para preservar o ToDo.

Embora a criação envie o identificador da sessão para satisfazer o tipo gerado, esse valor não é uma autorização: o trigger o substitui por `auth.uid()` e a policy de inserção valida o resultado. Consulta, alteração e exclusão continuam limitadas pelas policies de proprietário.

Não há endpoint administrativo para tarefas de terceiros.

## Reuniões e Notas

As abas usam diretamente a sessão autenticada do Supabase para CRUD em `personal_meetings` e `personal_notes`. Reuniões são consultadas em ordem de data/horário; Notas em ordem de `updated_at`. As consultas começam somente quando a respectiva aba é montada.

`personal_meetings.notes` e `personal_notes.content` aceitam o texto simples legado e o HTML controlado produzido pelo editor. O editor oferece negrito, tópicos, listas numeradas e checkboxes; conteúdo colado é inserido como texto simples. As buscas e prévias de Notas extraem somente o texto visível. Essa evolução não altera o tipo `text` das colunas nem as policies de proprietário.

Criar ToDo a partir de Reunião ou Nota persiste `origin_meeting_id` ou `origin_note_id`. O banco rejeita origem de outro proprietário e impede que as duas origens sejam preenchidas simultaneamente.

## Preferências e widgets

`personal_page_preferences` persiste `show_robot_table` por usuário. `personal_page_flows` persiste somente os IDs dos Fluxos escolhidos. A interface resolve esses IDs contra os dados que `FlowsDataProvider` já recebeu sob RLS e reutiliza `RobotsOverviewTable` com os dados autorizados de `AppDataProvider`.

As preferências não fazem consultas com `service_role`, não duplicam dados operacionais e não carregam detalhes, nodes, edges ou versões dos Fluxos selecionados. Esses dados continuam sendo buscados somente ao abrir a rota de um Fluxo.
