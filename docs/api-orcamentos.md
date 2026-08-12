# Orçamentos — contratos de dados

## Acesso

A rota `/orcamentos` valida a sessão no servidor e exige vínculo real com o papel `master` ou `admin`. O cliente autenticado acessa as tabelas pela Data API do Supabase, sempre sujeito às policies RLS.

## Consultas

- `budget_action_catalog`: lista ações ordenadas por `sort_order`.
- `budget_action_aliases`: lista expressões por prioridade decrescente.
- `budgets`: lista os vinte orçamentos ativos mais recentes.

## Criação e edição

O cliente chama `public.save_budget`. Com `p_budget_id = NULL`, a RPC cria um orçamento; com UUID existente, atualiza o mesmo registro e substitui os itens. Toda a operação é transacional e usa `SECURITY INVOKER`.

O payload contém nome, origem, status, nome/conteúdo opcional do TXT, valor-hora, comissão, `client_id` opcional, `system_id` opcional e itens. `system_id` referencia um registro ativo de `robot_systems`. Cada item contém referência opcional ao catálogo, descrição, horas e linha/texto de origem. A RPC calcula horas totais, subtotal, Valor estimado e valores dos itens no banco. Em criação, o status é forçado para `novo`; em edição, a RPC valida a lista fechada de status.

Para editar, a interface consulta o orçamento e seus itens pelo UUID, preenche o mesmo editor e envia o UUID à RPC. Apenas Master/Admin passam pela rota, RLS e validação interna da função.

## Dicionário

Edições atualizam descrição, horas e estado ativo do catálogo. Aliases removidos da configuração são desativados; novos aliases são inseridos. A criação de uma ação personalizada gera código técnico UUID e pode incluir termos separados por vírgula.

## PDF

O PDF é gerado no navegador a partir do estado revisado e baixado localmente. Ele contém somente escopo e horas técnicas; valor-hora, comissão e totais financeiros permanecem restritos à interface interna. Nesta etapa o arquivo não é enviado ao Storage. A associação do artefato a “Outros documentos” será ativada quando o fluxo futuro de vínculo com Robô for implementado.
