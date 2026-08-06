# Regras de negócio atuais

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
4. O código `RF001`, `RF002` etc. é calculado pela posição e não é persistido.

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
3. O tipo deve ser Admin, Operador ou Cliente.
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
- Ambiente aceita somente Produção, Teste ou Desenvolvimento.
- Regras de robô possuem ordem única entre regras ativas do mesmo robô.
- Publicações são imutáveis no fluxo normal.
- `ultimaPublicacaoEm` é calculado pela maior `publicada_em` do robô.
- Cadastros com soft delete não aparecem nas consultas funcionais comuns.
- Profile com papel Cliente deve estar ativo e vinculado a um cliente ativo.
- Senhas são processadas exclusivamente pelo Supabase Auth.
- Campos `created_by`, `updated_by` e `deleted_by` são preenchidos com a identidade autenticada quando aplicável.
