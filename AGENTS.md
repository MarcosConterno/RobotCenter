# Regras de banco de dados e Supabase

Sempre que houver criação ou alteração em:

* formulários;
* interfaces e tipos TypeScript;
* schemas de validação, como Zod;
* APIs;
* Server Actions;
* services;
* hooks de dados;
* páginas e componentes;
* filtros;
* campos exibidos ou editados na aplicação;

verifique obrigatoriamente se existe impacto na estrutura do banco de dados.

Quando houver impacto no banco:

1. Crie uma nova migration na pasta `supabase/migrations`.
2. Nunca altere migrations que já tenham sido aplicadas.
3. Nunca exclua tabelas, colunas ou dados sem autorização explícita.
4. Preserve os dados existentes durante alterações de estrutura.
5. Atualize chaves estrangeiras, constraints e índices necessários.
6. Atualize as políticas de Row Level Security — RLS.
7. Atualize as policies de acesso conforme os papéis e permissões.
8. Atualize os relacionamentos entre as entidades.
9. Atualize os tipos TypeScript gerados pelo Supabase.
10. Atualize os dados iniciais ou seeds, quando necessário.
11. Verifique se a alteração afeta autenticação, autorização ou auditoria.
12. Valide se usuários sem permissão continuam impedidos de acessar ou alterar os dados.

Sempre que uma entidade, campo ou relacionamento for criado, alterado ou removido, atualize também:

* `docs/modelagem-banco.md`;
* `docs/dominio.md`;
* `docs/regras-negocio.md`;
* `docs/permissoes.md`;
* diagramas e fluxos relacionados;
* documentação das APIs afetadas.

Antes de executar alterações no banco:

* apresente o impacto identificado;
* informe as tabelas, campos e policies que serão alterados;
* indique possíveis riscos de perda de dados;
* não execute alterações destrutivas sem autorização explícita.

Após a alteração:

* valide a migration;
* verifique as políticas RLS;
* execute as verificações de segurança e desempenho do Supabase;
* confirme que os tipos TypeScript estão sincronizados;
* teste o fluxo afetado;
* informe os arquivos criados ou alterados.

Toda alteração no banco deve ser rastreável por migration e documentação. Não faça alterações manuais no banco sem gerar a migration correspondente.

# Execução de Comandos

## Regra Geral

Não execute comandos de terminal automaticamente.

Sempre que for necessário executar qualquer comando local, apenas informe o comando que deve ser executado e aguarde o retorno do usuário.

O usuário será responsável por executar os comandos no terminal e fornecer o resultado para continuidade da implementação.

## Comandos que não devem ser executados automaticamente

- `npm`
- `pnpm`
- `yarn`
- `bun`
- `npx`
- `supabase`
- `git`
- `docker`
- `docker-compose`
- `powershell`
- `bash`
- `cmd`
- Scripts personalizados (`*.sh`, `*.ps1`, `*.bat`)

## Fluxo Obrigatório

Quando precisar executar um comando:

1. Explique brevemente o objetivo da execução.
2. Informe o comando em um bloco de código.
3. Aguarde o retorno do usuário.
4. Continue a implementação somente após o usuário informar o resultado.

Exemplo:

**Execute o seguinte comando:**

```bash
npx supabase db push
```

**Aguarde o retorno do comando antes de prosseguir.**

## Permissões

Não solicite permissão para executar comandos locais.

Sempre prefira que o usuário execute os comandos manualmente.

## Objetivo

- Reduzir interrupções durante o desenvolvimento.
- Evitar solicitações desnecessárias de permissão.
- Manter o usuário no controle das alterações locais.
- Tornar o desenvolvimento mais rápido, previsível e econômico em recursos.

## Terminal

Antes de solicitar qualquer comando, identifique qual terminal o usuário está utilizando.
No ambiente atual o terminal é:

leitura, interpretação e busca de conteudo, solicite se pode rodar.

Git Bash (MINGW64)

Nunca utilize comandos de PowerShell.

Nunca utilize comandos CMD.

Sempre utilize comandos compatíveis com Bash.

Quando precisar ler um arquivo, utilize:

cat caminho/do/arquivo

ou

sed -n '1,200p' caminho/do/arquivo

Quando precisar procurar conteúdo:

grep

Nunca utilize:

Get-Content

Set-Content

Select-String

Sempre aguarde o resultado do comando antes de continuar.



## Leitura de arquivos

Não solicite leitura de arquivos que já fazem parte do contexto do projeto.

Utilize os arquivos já analisados anteriormente.

Solicite leitura apenas quando um arquivo novo for criado ou quando o usuário informar que ele foi alterado manualmente.