# API de atualização manual de versões

`POST /api/admin/robot-versions` recebe somente `packageName`. O endpoint exige sessão Supabase válida e papel `admin` ou `master`; a visibilidade do botão no frontend não é considerada autorização. Depois da autorização, a própria API consulta no Notion a linha cuja propriedade select `Pacote` corresponde exatamente ao pacote recebido e lê a propriedade rich text `Ult. Vers`.

O servidor localiza todos os robôs ativos com o pacote exato, compara as versões atuais e atualiza `version_checked_at` em toda consulta bem-sucedida. `versao` recebe o valor encontrado, mas o resumo informa `unchanged` quando nenhum robô possuía valor diferente.

O token nunca é enviado ao navegador. O servidor usa `NOTION_TOKEN` e `NOTION_DATA_SOURCE_ID`, chama a API de data sources do Notion com `Notion-Version: 2026-03-11` e não mantém cache da consulta. Se não houver versão, se o formato for inválido ou se linhas do mesmo pacote apresentarem versões divergentes, nada é alterado. O modal registra o erro individual e continua os demais pacotes.

## Configuração do Notion

- `NOTION_TOKEN`: segredo da integração interna, disponível somente no ambiente do servidor.
- `NOTION_DATA_SOURCE_ID`: ID da fonte de dados que contém as colunas `Pacote` e `Ult. Vers`.
- `Pacote`: propriedade do tipo Select, com o nome técnico exato do pacote.
- `Ult. Vers`: propriedade do tipo Texto (rich text), com a versão que deve ser aplicada.

A fonte de dados deve ser compartilhada com a integração do Notion e a integração precisa apenas da capacidade de leitura de conteúdo. O conector local legado não participa mais do fluxo da aplicação.
