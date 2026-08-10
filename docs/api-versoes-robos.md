# API de atualização manual de versões

`POST /api/admin/robot-versions` recebe `packageName` e `version` após a consulta feita pelo conector local. O endpoint exige sessão Supabase válida e papel `admin` ou `master`; a visibilidade do botão no frontend não é considerada autorização.

O servidor localiza todos os robôs ativos com o pacote exato, compara as versões atuais e atualiza `version_checked_at` em toda consulta bem-sucedida. `versao` recebe o valor encontrado, mas o resumo informa `unchanged` quando nenhum robô possuía valor diferente.

Falhas do registry não chegam a este endpoint. Se a persistência de um pacote falhar, o modal registra erro individual e continua os demais.

## Conector local

`tools/robot-version-connector/server.mjs` escuta somente em `127.0.0.1`, consulta o registry usando o login local do npm e a rota disponível no computador — rede corporativa direta ou VPN — e aceita apenas origens declaradas em `ROBOT_CENTER_ORIGINS`. Seus endpoints são:

- `GET /health`: valida acesso ao registry antes da execução.
- `POST /versions`: recebe no máximo 500 nomes válidos e transmite NDJSON com os estados `checking`, `success` ou `error`.

O conector não recebe credenciais do navegador, não lê dados do Supabase e não altera robôs.
