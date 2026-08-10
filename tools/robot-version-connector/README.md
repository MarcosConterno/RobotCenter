# Robot Center Version Connector

Conector local para consultar o registry interno usando a rede disponível no computador e a autenticação já configurada no `.npmrc`. Dentro da empresa, utiliza a rota corporativa direta; fora dela, utiliza a VPN quando conectada. Ele não altera o Supabase e não expõe credenciais ao Robot Center.

## Configuração

Defina no ambiente local:

- `NPM_REGISTRY`: URL do Verdaccio interno.
- `ROBOT_CENTER_ORIGINS`: origens autorizadas, separadas por vírgula. Exemplo: `https://robot-center.exemplo.com,http://localhost:3000`.
- `ROBOT_CENTER_CONNECTOR_PORT`: opcional; padrão `47831`.

O login deve existir previamente no npm local:

```bash
npm login --registry=https://npm.app.loylegal.net
```

Inicie o conector no computador conectado à rede corporativa ou à VPN:

```bash
node tools/robot-version-connector/server.mjs
```

O serviço escuta exclusivamente em `127.0.0.1` e aceita somente as origens configuradas.

Em navegadores com proteção de rede local, conceda ao domínio do Robot Center a permissão solicitada para acessar serviços em loopback. A permissão libera somente a conexão com o conector; as regras de origem dele continuam obrigatórias.
