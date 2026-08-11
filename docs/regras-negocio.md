# Regras de negócio atuais

## Autenticação

1. A entrada pela rota `/` sempre direciona para `/login`.
2. A página `/login` permanece acessível mesmo quando existe uma sessão ativa.
3. Após autenticação válida, o usuário sempre segue para `/dashboard`.
4. Dashboard, Robôs e Configurações continuam protegidos pelo proxy e exigem sessão Supabase válida.

## Robôs

- O menu Robôs agrupa quatro listagens: Robôs Integradores, Consulta Processual, Peticionamento e Movimento.
- O menu mostra somente os produtos autorizados ao perfil; a URL direta e a policy RLS repetem a mesma validação.
- As quatro listagens utilizam a mesma entidade, formulário, filtros, cards e detalhe, segregados exclusivamente por `productType`.
- Todo Robô possui Command. Registros Integradores legados podem mantê-lo vazio até a próxima atualização conhecida.
- Tribunal e Sistema Tribunal são opcionais para Consulta Processual, Peticionamento e Movimento e não se aplicam a Integradores.
- Os filtros comuns operam dentro do produto selecionado; produtos judiciais acrescentam Tribunal e Sistema Tribunal.
- A importação oferece “Baixar base de robôs”, com os registros do produto aberto, e “Baixar modelo”, com cabeçalhos, validações, instruções e a coluna Produto previamente preenchida conforme a página atual.
- A coluna Produto da planilha controla a listagem do robô. Em atualização vazia, preserva-se o produto atual; em criação vazia, utiliza-se o produto da página que abriu a importação.

1. Um Robô deve possuir nome, sistema, pacote, descrição, ambiente, fila, versão e responsável não vazios; Stack é opcional.

### Solicitações de Stack

- A solicitação sempre referencia um Robô existente e registra nome sugerido, Type e Job; Fila é opcional.
- Concluir exige informar a Stack gerada e registra automaticamente a data da conclusão.
- Toda criação, edição, mudança de status, pergunta e resposta acrescenta um evento ao histórico imutável.
- A conclusão não altera automaticamente a Stack do Robô nem o catálogo de Stacks.
- Operador possui leitura; Head Setor, Admin e Master podem receber capacidades de gestão pela matriz. Dev pode receber acesso configurável; Cliente e Suporte permanecem bloqueados.
2. `alteracaoRealizada` pode ficar vazia.
3. O ambiente deve ser Produção, Teste ou Desenvolvimento.
4. Um Robô pode estar ativo ou inativo.
5. Ao cadastrar um Robô no repositório temporário, o ID é gerado com `Date.now()` e `ultimaPublicacaoEm` recebe a data/hora atual em ISO.
6. Editar um Robô não altera `ultimaPublicacaoEm`.
7. Excluir um Robô o remove do estado em memória.
8. A busca considera nome, sistema, pacote, stack e fila.
9. Os filtros de Sistema, Pacote, Ambiente e Status são independentes.
10. A atualização manual de versões é exclusiva de Master e Admin e consulta cada valor distinto de `pacote` uma única vez, usando a rede corporativa direta ou a VPN disponível no computador do usuário.
11. Uma consulta bem-sucedida atualiza `version_checked_at` em todos os robôs vinculados ao pacote; `versao` só muda quando o valor encontrado for diferente.
12. Falhas de registry não alteram `versao` nem `version_checked_at` e não interrompem os demais pacotes.
13. Master e Admin podem criar, editar e excluir logicamente requisitos funcionais e regras fora da documentação diretamente nos detalhes do robô, sem abrir o formulário completo de edição.
14. Um robô pode possuir vários anexos privados em PDF, DOCX ou XLSX, com até 20 MB por arquivo.

## Regras funcionais

1. Um Robô pode ter zero ou várias regras.
2. Regras adicionadas sem descrição são descartadas ao salvar.
3. A ordem visual é a ordem do array.
4. O código `RF001`, `RF002` etc. é calculado pela posição da regra no documento técnico e não é persistido.
5. As RFs do documento técnico podem ser reordenadas por arrastar e soltar; após cada mudança, a numeração é recalculada automaticamente.
6. Regras fora da documentação são mantidas em lista separada e usam o código visual `RFD001`, `RFD002` etc.

## Publicações

1. Publicar alterações atualiza `Robo.ultimaPublicacaoEm`.
2. A publicação criada possui categoria `Atualização do Robô` e referencia o Robô por `roboId`.
3. A descrição usa `alteracaoRealizada`; se estiver vazia, usa texto padrão com o nome do Robô.
4. Até 20 publicações dinâmicas são mantidas no `localStorage`.
5. Publicações mockadas são exibidas depois das publicações locais.
6. A cor da categoria e o texto relativo de tempo pertencem à interface, não ao domínio.
7. O formato legado do `localStorage` é aceito para evitar perda imediata do histórico local.

## Dashboard

1. Total e contagens por ambiente são calculados a partir da mesma lista de Robôs usada em `/robos`.
2. A tabela da Dashboard e a tela de Robôs usam a mesma fonte compartilhada.
3. A Visão Geral é a aba inicial; a tabela é exibida somente após selecionar sua aba.

## Usuários

1. Login é obrigatório.
2. Senha é obrigatória e deve conter pelo menos quatro caracteres.
3. O tipo deve ser Admin, Operador, Cliente ou Suporte.
4. Senha é transitória e não integra a entidade `Usuario`.
5. Após o cadastro, os campos voltam aos valores iniciais.

## Clientes

1. Nome e tenant são obrigatórios.
2. Ambos são normalizados com `trim()`.
3. Cliente não é usado como filtro de Pacote.
4. Nenhuma relação Cliente–Robô ou Cliente–Usuário existe até que seja definida explicitamente.

## Persistência temporária

1. Robôs, usuários e clientes vivem em estado React e não sobrevivem a recarga.
2. Publicações dinâmicas usam `localStorage` versionado.
3. Nenhuma regra desta seção é executada no servidor nesta etapa.
# Regras de persistência e integridade V1

- Todo robô pertence a um cliente ativo.
- Somente administradores podem baixar o modelo ou importar robôs em lote.
- A importação aceita arquivos `.xlsx` de até 5 MB e no máximo 500 robôs por arquivo.
- Nenhuma coluna do modelo é obrigatória: valores vazios recebem padrões compatíveis com o cadastro; cliente vazio utiliza o primeiro cliente disponível.
- O cliente da planilha é localizado pelo nome normalizado. Quando ainda não existe, é criado uma única vez com o nome informado e tenant técnico único; as demais linhas do lote reutilizam o mesmo `clienteId`.
- Clientes já existentes são carregados do Supabase; os registros estáticos de demonstração não participam da correspondência.
- As cores dos badges de Cliente e Pacote são escolhidas por robô entre azul, violeta, verde, âmbar, rosa e ciano. Cada paleta define conjuntamente fundo e texto para preservar contraste e consistência visual.
- Quando a coluna Cliente estiver vazia, a importação usa o nome `Cliente não informado`, também reutilizado dentro do lote.
- `Max` nunca é importado abaixo de `Ideal`; quando necessário, assume o mesmo valor de `Ideal`.
- Somente administradores podem editar ou arquivar usuários e clientes.
- Um administrador não pode arquivar o próprio usuário autenticado.
- A exclusão de usuários e clientes é lógica, preservando histórico e auditoria.
- Um cliente com robôs ou usuários ativos vinculados não pode ser arquivado.
- O resumo administrativo do Cliente contabiliza somente Robôs não excluídos, todos os Fluxos persistidos e Documentações Robot Center não excluídas.
- A métrica Documentos soma uma unidade por Documentação Upada existente e uma unidade por Documentação Robot Center ativa; versões publicadas não são contadas separadamente.
- A data de atualização do resumo é a maior `updated_at` encontrada entre Cliente, Robôs, Fluxos e Documentações Robot Center relacionados.
- Ambiente aceita somente Produção, Teste ou Desenvolvimento.
- Regras de robô possuem ordem única entre regras ativas do mesmo robô e tipo.
- Regras existentes anteriores à categorização pertencem ao tipo `documentacao`.
- Todo cadastro de robô deve selecionar um cliente existente.
- `CourtName` é obrigatório; `Ideal` e `Max` são inteiros não negativos; `Max` deve ser maior ou igual a `Ideal`.
- Cada texto informado em “Alteração realizada” gera uma nova entrada histórica com data/hora. Entradas anteriores não podem ser sobrescritas ou excluídas pela aplicação.
- Detalhes e tabela consolidada exibem Cliente, Sistema, Robô, CourtName, Fila, Stack, Ideal, Max, Pacote e Versão, nessa ordem.
- Publicações são imutáveis no fluxo normal.
- `ultimaPublicacaoEm` é calculado pela maior `publicada_em` do robô.
- A cor do Cliente é definida exclusivamente no cadastro de `clientes`; todos os robôs vinculados ao mesmo `cliente_id` usam essa cor.
- Pacotes com o mesmo nome normalizado compartilham a mesma cor visual; editar uma cor a propaga para todos os robôs correspondentes.
- Admin e Operador podem alterar diretamente na Dashboard somente `ideal` e `max`; a persistência ocorre após clicar em “Aplicar alteração”.
- Operador e Cliente consultam os detalhes dos robôs, mas não criam, editam, excluem, importam ou publicam robôs.
- Suporte acessa Dashboard, listagem e detalhes de Robôs e Fluxos, sempre em modo de visualização e sem ações de cadastro, edição, exclusão, importação ou publicação.
- Cadastros com soft delete não aparecem nas consultas funcionais comuns.
- Profile com papel Cliente deve estar ativo e vinculado a um cliente ativo.
- Senhas são processadas exclusivamente pelo Supabase Auth.
- Campos `created_by`, `updated_by` e `deleted_by` são preenchidos com a identidade autenticada quando aplicável.
## Cores de clientes e pacotes

- Clientes existentes recebem automaticamente uma cor da paleta visual de seis cores; a cor permanece editável no cadastro do cliente.
- Pacotes com o mesmo nome normalizado compartilham a mesma cor em todos os robôs.
- Um pacote inédito recebe automaticamente a próxima cor da paleta; após seis nomes distintos, a sequência é reutilizada.
- A apresentação e a indicação da cor selecionada devem permanecer legíveis nos temas claro e escuro.
## Salvamento e publicação do robô

- A publicação é iniciada dentro da edição do robô.
- `Salvar` persiste as alterações sem criar uma publicação.
- `Salvar e publicar` primeiro persiste o formulário e, somente após sucesso, registra a publicação e direciona o usuário à dashboard.
- A tela de detalhes não oferece uma ação de publicação independente.
## Destaques de novidades na dashboard

- O cadastro de um robô gera um item identificado como `Novo robô`, contendo sempre o nome, CourtName e a descrição do cadastro.
- A publicação de uma edição gera um item identificado como `Nova atualização`.
- Quando várias alterações forem informadas no mesmo salvamento, suas descrições são reunidas na publicação para representar exatamente o conteúdo alterado.
- Nome e CourtName são informações principais; pacote, versão e stack aparecem como contexto técnico.
- O feed é reconstruído de `public.publicacoes`; novas publicações não dependem do armazenamento do navegador.
- Somente uma sessão com `publications.create` pode registrar uma atualização, vinculada a um robô ativo.
- Ao publicar regras novas, a descrição identifica separadamente regras de `Documentação` e de `Fora da Documentação`, incluindo o texto de cada regra. Quando as duas categorias mudam, ambas aparecem no mesmo item do feed.
- O manual do robô é opcional, deve ser PDF e possuir no máximo 20 MB.
- Um novo upload substitui o arquivo lógico `<robo_id>/manual.pdf`; os detalhes abrem o manual em modal usando URL assinada temporária.
- Disparo aceita somente Agendado, Manual ou por Gatilho; registros existentes assumem Manual.
- Gatilho De e Gatilho Para são opcionais, não aceitam o próprio robô e somente podem selecionar robôs ativos do mesmo cliente.

## Importação de robôs

- Cada linha informa explicitamente `Criar` ou `Atualizar`.
- Atualizações usam exclusivamente o UUID de `robos.id`; células vazias preservam o banco.
- ID ausente, desconhecido ou repetido invalida a planilha antes de qualquer gravação.
- Linhas de criação mantêm o ID vazio. O cliente continua sendo relacionado pelo nome.
- Regras e alterações históricas não são substituídas pela planilha de atualização.
- A gravação exige confirmação após uma prévia das criações e atualizações.

## Vínculo de Usuário com Cliente

1. Somente Admin pode criar usuários ou alterar `profiles.cliente_id` pela API administrativa.
2. O papel Cliente exige vínculo com um Cliente existente e não arquivado.
3. Admin, Operador e Suporte podem permanecer sem Cliente ou possuir vínculo informativo.
4. O Cliente selecionado no frontend não é confiável por si só; o endpoint valida sessão, papel Admin, UUID e existência do Cliente antes da gravação.

## Fluxos por Cliente

1. Todo Fluxo pertence a exatamente um Cliente ativo.
2. Somente Admin cria ou exclui Fluxos.
3. Admin edita e publica qualquer Fluxo; Cliente edita e publica somente Fluxos do próprio Cliente.
4. Operador e Suporte visualizam todos os Fluxos, sem criar, editar, publicar ou excluir.
5. Usuário Cliente não recebe filtro de Cliente; o escopo é determinado pelo profile autenticado e pela RLS.
6. Um Node do tipo `robot` referencia obrigatoriamente um Robô ativo do mesmo Cliente do Fluxo.
7. Dados principais do Robô não são editados pelo Fluxo e refletem o cadastro atual.
8. Uma Edge conecta apenas Nodes pertencentes ao mesmo Fluxo e não pode conectar um Node a ele mesmo.
9. Posição de Nodes e viewport são persistidos; propriedades, dimensões, deslocamento do rótulo e pontos de entrada/saída das conexões ficam em `flow_edges`. O rótulo funciona como ponto intermediário da conexão: pode ser movido sem alterar os Nodes, enquanto os dois trechos da linha acompanham sua posição. Um mesmo Node pode participar de múltiplas conexões.
10. Publicar incrementa a versão, altera o status para `publicado` e cria snapshot imutável na mesma transação.

11. A primeira publicação da Documentação Robot Center é `v1.0`; cada publicação concluída incrementa o sufixo menor (`v1.1`, `v1.2`).
12. Uma documentação só se torna publicada depois que DOCX e PDF forem gravados com sucesso.
13. Publicações simultâneas da mesma documentação são bloqueadas e o token de geração torna duplos envios idempotentes.
14. Uma tentativa com falha é reprocessada no mesmo número de versão.
15. Versões publicadas e suas imagens são imutáveis; alterações posteriores afetam apenas o rascunho.
16. A conclusão da publicação da Documentação Robot Center registra uma atualização do robô em `publicacoes`, tornando o evento visível na dashboard conforme o acesso ao cliente.
17. A exclusão da Documentação Robot Center é permitida exclusivamente ao papel Master, exige também o papel Admin por compatibilidade e utiliza exclusão lógica; versões e arquivos históricos não são removidos fisicamente.
18. Excluir a Documentação Robot Center não altera nem remove a Documentação Upada do robô.
19. Ao abrir o editor, o inicializador reutiliza somente a documentação interna ativa; documentos logicamente excluídos permanecem históricos e não bloqueiam a criação de um novo rascunho.
11. Versões anteriores abrem exclusivamente em modo de visualização.
12. Alterações não salvas impedem a publicação até que o estado normalizado seja persistido.
13. Alterar URL, payload ou `client_id` não amplia acesso; a autorização é validada no PostgreSQL.
14. O montador usa como elementos principais Robô, Sistema Externo, Decisão/Regra, Grupo/Contexto e Anotação; Stack, Ambiente e Status pertencem ao Robô.
15. Fila é uma propriedade opcional da conexão e nunca um Node independente.
16. Grupos são exclusivamente visuais, podem conter Nodes e não participam da execução do Fluxo.
17. Conexões aceitam os tipos Envia para, Dispara, Processa, Gera Job, Depende de e Condição.
18. Regra e Decisão compartilham o tipo persistido `decision`; o modo Decisão usa losango e nenhum dos modos limita a quantidade de conexões.
19. A etiqueta de uma conexão pode ser redimensionada manualmente; dimensões ausentes mantêm o tamanho automático e dimensões informadas respeitam os mínimos de 70 × 34 pixels.

## Documentação do robô

1. Documentação Upada e Documentação Robot Center são recursos independentes e podem coexistir.
2. Os anexos externos continuam em `robot-manuals`; não são convertidos, extraídos nem enviados ao motor DOCX/PDF.
3. Substituir a Documentação Upada não altera rascunhos ou versões internas.
4. Somente Admin pode criar ou editar a Documentação Robot Center.
5. A autorização de edição é validada na rota e novamente pelas policies RLS.
6. Versões publicadas são imutáveis: `UPDATE` e `DELETE` são rejeitados no banco.
7. As futuras documentações reutilizarão as RFs ordenadas de `regras_robo`; não existe cópia de RF no módulo.
8. Nesta etapa não há editor, publicação, geração DOCX/PDF nem upload de imagens internas.
9. O detalhe completo do Robô é exibido em `/robos/{id}` e não em modal.
10. O card exibe o ícone de documentação apenas quando existe Documentação Upada ou Documentação Robot Center com status `published`.
11. Regras de `tipo = documentacao` são apresentadas como requisitos funcionais; regras de `tipo = fora_documentacao` ocupam a seção equivalente de requisitos não funcionais, sem duplicação no banco.
12. A aba Redmine é somente uma estrutura visual vazia e não realiza chamadas externas.
13. Cadastro e edição usam páginas próprias em `/robos/novo` e `/robos/{id}/editar`; o drawer não é usado para formulários completos.
14. Requisitos Funcionais e Regras Fora da Documentação possuem navegação separada, mas continuam usando os tipos existentes de `regras_robo`.
15. O editor é exclusivo de Admin e valida no servidor e no banco se cada regra pertence ao robô informado.
16. Reordenação é transacional; a numeração é recalculada pela posição entre regras irmãs.
17. Sub-regras pertencem ao mesmo robô e categoria da regra pai e aceitam um nível de hierarquia.
18. Excluir pelo editor arquiva logicamente a regra real e suas sub-regras após confirmação explícita.
19. Seções, textos e notas pertencem ao rascunho e não modificam a Documentação Upada nem o motor DOCX/PDF.
20. Imagens aceitam PNG, JPEG e WEBP com no máximo 10 MB e são armazenadas em bucket privado.
21. O bloco de imagem somente é criado após upload confirmado; substituição mantém posição, legenda, alinhamento e tamanho.
22. Legenda acompanha logicamente a imagem durante reordenação e exclusão.
23. Arquivo referenciado por versão publicada não é removido fisicamente ao sair do rascunho.

## Administração e controle de acesso

1. O papel Master é superior e complementar ao Admin; não substitui o papel Admin nas autorizações existentes.
2. Somente `marcos.vinicius@loylegal.com` recebe o papel Master na inicialização controlada.
3. Master e Admin visualizam o painel administrativo que mapeia permissões por recurso e os perfis que as possuem.
4. Master pode editar qualquer vínculo entre papel e permissão.
5. Admin pode editar somente vínculos de Operador, Dev, Cliente e Suporte; não pode alterar permissões de Admin, Master nem do recurso `access_control`.
6. Dev inicia com as permissões do Operador, mas possui matriz independente para evolução futura.
7. Um Admin comum não pode editar, arquivar nem remover o vínculo Master de um usuário.
8. A atribuição ou remoção do papel Master e a alteração da permissão `access_control.read` são protegidas no banco, não apenas na interface.
9. O usuário Master deve conservar um papel administrativo base para permanecer compatível com as rotas, APIs e policies existentes.
10. Alterações da matriz somente são persistidas após confirmação em **Salvar alterações** e são aplicadas na mesma transação.
11. Excluir um usuário arquiva o profile para preservar referências históricas, remove seus papéis ativos e realiza exclusão lógica da identidade no Supabase Auth. O próprio usuário e o Master não podem ser excluídos por esse fluxo.
12. Sessões abertas recebem notificações Realtime das entidades operacionais que já podem consultar. A sincronização apenas relê os dados após a confirmação da transação e não concede acesso, não contorna RLS e não altera permissões de escrita.
13. Eventos recebidos em sequência são agrupados por 300 ms. Respostas de carregamentos anteriores não substituem o estado de uma solicitação mais recente, e os canais são removidos quando o provider é desmontado.
14. Somente Master pode arquivar um Cliente que possua usuários ativos vinculados; todos devem ser reatribuídos a outro Cliente ou desvinculados na mesma transação.
15. A reatribuição não contorna o bloqueio de Robôs ativos e não altera o papel dos usuários.
16. Somente Master pode excluir fisicamente um Robô, mediante confirmação explícita e com auditoria privada obrigatória.
17. A exclusão remove regras, alterações, publicações e metadados de anexos pertencentes ao Robô. Nós de Fluxo, solicitações de Stack e documentação publicada são preservados sem vínculo com o Robô removido.

## Tutorial e onboarding

1. O tutorial nunca bloqueia o uso do Robot Center e não abre automaticamente no login.
2. Usuário sem progresso registrado é tratado como não iniciado e recebe somente um destaque discreto na sidebar.
3. Passos são filtrados pelas capacidades disponíveis ao usuário; targets ausentes são ignorados sem interromper o tour.
4. Fechar mantém o estado em andamento; pular registra `skipped`; concluir registra `completed`.
5. O usuário pode retomar ou recomeçar o tutorial da mesma versão e o progresso é persistido no backend.
6. Somente usuários com `tutorials.manage` ou Master criam, alteram, testam e publicam tutoriais.
7. Salvar altera somente o rascunho; publicar cria nova versão sequencial e imutável.
8. O modo de teste nunca cria ou atualiza `user_tutorial_progress`.
9. Passos aceitam somente páginas e targets presentes no catálogo do código.
10. Quando a versão publicada aumenta, a ausência de progresso nessa versão volta a destacar discretamente o botão Tutorial sem abrir o tour automaticamente.
11. O tutorial padrão inclui Minha página, ToDo, Reuniões, Notas e personalização; a navegação entre as abas é somente visual e não modifica dados pessoais.
## Dashboard gráfica

1. A Dashboard possui as visões Visão geral, Tabela de robôs e Gráficos.
2. A visão Gráficos utiliza exclusivamente os Robôs já autorizados para a sessão e não amplia o escopo da RLS.
3. Cliente, CourtName, Sistema e Stack são filtros combináveis; limpar filtros restaura o conjunto autorizado completo.
4. Indicadores de total, ativos e capacidade, assim como distribuições por Cliente, CourtName, Sistema e Stack, são recalculados sobre o mesmo recorte filtrado.
5. Valores vazios são agrupados como Não informado. Categorias além das sete maiores aparecem em Outros no modo compacto, e a opção Ver todos expande o quadro sem consolidação.
6. Cada quadro permite alternar independentemente entre Barras, Pizza e Rosca sem alterar o recorte dos filtros.
7. Os filtros principais são Cliente, CourtName, Sistema e Stack; Mais filtros apresenta os demais campos funcionais do cadastro, incluindo os quatro produtos, capacidades e documentação.
8. A Dashboard é visível a todos os papéis ativos. Usuário Cliente visualiza somente Robôs cujo `cliente_id` corresponde ao vínculo ativo do próprio profile.
9. Os quatro quadros iniciais são apenas uma configuração padrão. Cada usuário pode adicionar, configurar ou remover quadros e salvar seu layout individual.
10. Cada quadro escolhe independentemente contexto e visualização. O limite é de 20 quadros e a preferência não armazena dados dos Robôs, somente a configuração visual.

## Minha página e tarefas pessoais

1. Todo usuário autenticado pode utilizar Minha página, independentemente de seu papel.
2. O usuário consulta e altera exclusivamente tarefas cujo `user_id` corresponde à própria sessão.
3. Concluir uma tarefa define `status = completed` e registra `completed_at`; reabrir restaura `pending` e limpa `completed_at`.
3.1. Após concluir, a interface abre o filtro Concluídas; após reabrir, abre Pendentes. O filtro Hoje mostra somente tarefas ainda pendentes, sem alterar os totais do resumo diário.
4. Tarefas pendentes com data anterior à data local atual são apresentadas como atrasadas.
5. O resumo do dia considera apenas tarefas cuja data é hoje; Próximas considera tarefas futuras ainda pendentes.
6. Minha página é o destino inicial após autenticação e ao acessar a raiz do sistema.
7. Cada usuário decide se exibe a tabela de Robôs e quais Fluxos aparecem como atalhos.
8. Selecionar um Fluxo não amplia permissões: se o usuário perder acesso ao Fluxo, o card deixa de ser resolvido pela consulta operacional.
9. Preferências armazenam somente configuração e referências; os dados de Robôs e Fluxos não são duplicados.
10. A navegação pessoal é composta por ToDo, Reuniões e Notas; cada área permanece simples e não representa projeto, equipe, CRM ou Kanban.
11. Reuniões são filtradas por Hoje, Próximas e Anteriores e podem guardar texto livre sem estrutura obrigatória.
12. Notas possuem título e conteúdo livre formatável, com negrito, tópicos, listas numeradas e checkboxes, e são ordenadas pela edição mais recente.
13. Um ToDo pode ter no máximo uma origem, Reunião ou Nota, e a origem deve pertencer ao mesmo usuário.
14. Excluir Reunião ou Nota remove apenas a referência de origem do ToDo; o ToDo permanece.
# Edição individual de Robôs por Cliente

- O padrão de todo usuário Cliente é somente leitura.
- A liberação “Pode editar robôs” pertence ao usuário, não à empresa nem ao papel global.
- A liberação exige papel Cliente e `profiles.cliente_id` válido.
- O usuário autorizado edita somente robôs do Cliente vinculado.
- O usuário não cria, arquiva, transfere ou muda o produto do robô e não administra catálogos, cores compartilhadas ou documentação.
- Remover o papel Cliente remove automaticamente a liberação individual.
