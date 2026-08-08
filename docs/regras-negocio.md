# Regras de negócio atuais

## Autenticação

1. A entrada pela rota `/` sempre direciona para `/login`.
2. A página `/login` permanece acessível mesmo quando existe uma sessão ativa.
3. Após autenticação válida, o usuário sempre segue para `/dashboard`.
4. Dashboard, Robôs e Configurações continuam protegidos pelo proxy e exigem sessão Supabase válida.

## Robôs

1. Um Robô deve possuir nome, sistema, pacote, descrição, ambiente, stack, fila, versão e responsável não vazios.
2. `alteracaoRealizada` pode ficar vazia.
3. O ambiente deve ser Produção, Teste ou Desenvolvimento.
4. Um Robô pode estar ativo ou inativo.
5. Ao cadastrar um Robô no repositório temporário, o ID é gerado com `Date.now()` e `ultimaPublicacaoEm` recebe a data/hora atual em ISO.
6. Editar um Robô não altera `ultimaPublicacaoEm`.
7. Excluir um Robô o remove do estado em memória.
8. A busca considera nome, sistema, pacote, stack e fila.
9. Os filtros de Sistema, Pacote, Ambiente e Status são independentes.

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
- Suporte acessa somente as Dashboards.
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
