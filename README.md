<div align="center">
  <img src="public/images/robot-center-system-logo-transparent.png" alt="Robot Center" width="150" />

  # Robot Center

  **Workspace corporativo para governança, documentação e gestão de automações.**

  Centralize robôs, clientes, fluxos, documentação técnica, permissões e indicadores em uma única plataforma segura.

  ![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)
  ![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Supabase](https://img.shields.io/badge/Supabase-Cloud-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS-4169E1?style=flat-square&logo=postgresql&logoColor=white)
</div>

---

## Sobre o projeto

O **Robot Center** organiza o ciclo de vida das automações da empresa. A plataforma oferece uma visão consolidada do portfólio de robôs e, ao mesmo tempo, preserva o isolamento dos dados de cada cliente por meio das políticas de segurança do Supabase.

O sistema atende diferentes perfis — de clientes e equipes operacionais até administradores — com permissões específicas para leitura, edição, documentação, publicação e administração.

## Principais recursos

### Gestão de robôs

- Catálogo separado por **Robôs Integradores**, **Consulta Processual**, **Peticionamento** e **Movimento**.
- Cadastro técnico com sistema, stack, pacote, fila, ambiente, versão, responsável, tribunal, capacidade e cliente.
- Filtros avançados, busca, importação e exportação por planilha.
- Histórico de alterações, requisitos funcionais e regras fora da documentação.
- Documentos privados em PDF, DOCX e XLSX.
- Atualização assistida de versões por conector local.
- Solicitações e acompanhamento de criação de stacks.

### Dashboard modular

- Indicadores construídos a partir dos robôs que o usuário realmente pode acessar.
- Filtros globais por cliente e por todos os campos relevantes do cadastro.
- Quadros configuráveis por contexto: cliente, sistema, stack, produto, status, ambiente, responsável, tribunal e outros.
- Visualizações em barras, pizza e rosca.
- Até 20 quadros por usuário, com layout individual salvo no Supabase.

### Fluxos de automação

- Montador visual de fluxos baseado em nodes e conexões.
- Vínculo de robôs, sistemas externos, decisões, grupos e anotações.
- Persistência de posições, conexões, filas, labels e pontos de entrada e saída.
- Publicação versionada com snapshots imutáveis.
- Escopo e autorização determinados pelo cliente do fluxo.

### Documentação Robot Center

- Editor estruturado de documentação técnica por robô.
- Seções, blocos, imagens privadas e requisitos funcionais reutilizados do cadastro.
- Publicação versionada em DOCX e PDF.
- Histórico imutável das versões publicadas.
- Separação completa entre documentação interna e arquivos enviados pelo usuário.

### Minha página

- ToDos pessoais com prioridade, prazo e status.
- Reuniões e notas com editor de conteúdo.
- Criação de tarefas a partir de reuniões ou notas.
- Preferências e widgets individuais.
- Dados pessoais protegidos por usuário, inclusive para perfis administrativos.

### Administração e experiência

- Gestão de usuários, clientes e vínculos.
- Matriz visual de papéis e permissões.
- Tutoriais administráveis e progresso individual.
- Tema claro e escuro.
- Sincronização em tempo real dos dados autorizados.
- Interfaces responsivas e feedback visual para operações críticas.

## Papéis e segurança

O acesso combina **RBAC**, permissões granulares e **Row Level Security (RLS)**. A interface oculta ações indisponíveis, mas a autorização definitiva sempre ocorre no servidor e no PostgreSQL.

| Perfil | Escopo principal |
|---|---|
| **Master** | Administração superior, matriz completa e operações excepcionais auditadas |
| **Admin** | Gestão de usuários, clientes, robôs, documentos, tutoriais e permissões autorizadas |
| **Head Setor** | Consulta de robôs e gestão das solicitações de stack conforme a matriz |
| **Operador** | Consulta global e capacidades operacionais específicas |
| **Dev** | Escopo configurável, independente do Operador |
| **Suporte** | Visualização de Dashboard, robôs e fluxos |
| **Cliente** | Somente dados da empresa vinculada; edição de robôs é uma capacidade individual opcional |

Princípios aplicados:

- O navegador nunca recebe a chave `service_role`.
- Usuários anônimos não acessam as tabelas da aplicação.
- O cliente informado pelo frontend nunca é usado sozinho como autorização.
- Dados pessoais e preferências pertencem exclusivamente ao usuário autenticado.
- Operações críticas possuem validação redundante em API, RPC, policies e triggers.
- Exclusões excepcionais de robôs pelo Master são registradas em auditoria privada.

## Arquitetura

```text
Navegador
   │
   ├── Next.js App Router ── páginas, layouts e Route Handlers
   │         │
   │         ├── React 19 ── componentes e experiência interativa
   │         └── Supabase SSR ── sessão segura por cookies
   │
   └── Supabase Cloud
             ├── Auth ── identidade, sessões e recuperação de senha
             ├── PostgreSQL ── domínio, RBAC, auditoria e preferências
             ├── Row Level Security ── isolamento e autorização
             ├── Storage ── documentos e imagens privadas
             └── Realtime ── sincronização das entidades operacionais
```

### Tecnologias

| Camada | Tecnologias |
|---|---|
| Aplicação | Next.js 16, React 19 e TypeScript 5 |
| Interface | CSS Modules, Tailwind CSS 4, Radix UI, Lucide e Motion |
| Formulários | React Hook Form e Zod |
| Estado e dados | Zustand, Supabase JS/SSR e TanStack Table |
| Fluxos | React Flow (`@xyflow/react`) |
| Planilhas | ExcelJS |
| Backend | Next.js Route Handlers e Supabase Cloud |
| Banco e segurança | PostgreSQL, migrations, RLS, RBAC, RPCs e triggers |

## Estrutura do projeto

```text
robot-center/
├── public/images/              # Identidade visual
├── src/
│   ├── app/                    # Rotas, páginas e APIs do App Router
│   ├── components/             # Componentes por domínio
│   ├── domain/                 # Regras e modelos da aplicação
│   ├── lib/supabase/           # Clientes Supabase para browser e servidor
│   ├── server/                 # Serviços exclusivamente server-side
│   └── types/                  # Contratos e tipos do banco
├── supabase/
│   ├── migrations/             # Evolução rastreável do banco e das policies
│   └── seed.sql                # Dados iniciais controlados
├── docs/                       # Domínio, banco, APIs, regras e permissões
├── proxy.ts                    # Proteção e renovação de sessão
└── package.json
```

## Executando localmente

### Pré-requisitos

- Node.js compatível com Next.js 16.
- npm.
- Um projeto no Supabase Cloud.
- Git Bash no Windows, conforme o fluxo adotado pelo projeto.

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

Crie `.env.local` a partir de `.env.example` e informe as credenciais do seu projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
SUPABASE_SERVICE_ROLE_KEY=sb_secret_SUBSTITUA_AQUI
CONVERTAPI_TOKEN=SUBSTITUA_AQUI
```

> `SUPABASE_SERVICE_ROLE_KEY` e `CONVERTAPI_TOKEN` são segredos exclusivamente server-side. Nunca utilize o prefixo `NEXT_PUBLIC_` nessas variáveis e nunca faça commit do `.env.local`.

### 3. Prepare o Supabase Cloud

Execute as migrations de `supabase/migrations` no projeto Supabase, respeitando a ordem cronológica dos arquivos. As migrations definem tabelas, relacionamentos, índices, funções, triggers, RBAC, RLS e Storage.

> O banco é tratado como código: migrations já aplicadas não devem ser alteradas. Toda evolução estrutural deve receber uma nova migration.

### 4. Inicie a aplicação

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia o ambiente de desenvolvimento |
| `npm run build` | Gera e valida a aplicação para produção |
| `npm run start` | Inicia o build de produção |
| `npx tsc --noEmit` | Valida os tipos TypeScript sem gerar arquivos |

## Supabase e migrations

O ambiente oficial utiliza **Supabase Cloud**. Para manter segurança e rastreabilidade:

1. Crie uma migration para cada alteração de banco.
2. Preserve dados existentes e evite operações destrutivas.
3. Revise constraints, índices, relacionamentos e triggers.
4. Atualize grants e policies RLS junto com o schema.
5. Sincronize `src/types/database.types.ts`.
6. Atualize a documentação funcional e técnica relacionada.
7. Valide o fluxo com usuários autorizados e não autorizados.

## Documentação técnica

- [Arquitetura](ARCHITECTURE.md)
- [Modelagem do banco](docs/modelagem-banco.md)
- [Domínio](docs/dominio.md)
- [Regras de negócio](docs/regras-negocio.md)
- [Papéis e permissões](docs/permissoes.md)
- [API de usuários](docs/api-usuarios.md)
- [API de fluxos](docs/api-fluxos.md)
- [API da Minha página](docs/api-minha-pagina.md)
- [Documentação Robot Center](docs/api-documentacao-robot-center.md)

## Qualidade e contribuição

Antes de entregar uma alteração:

```bash
npx tsc --noEmit
npm run build
```

Ao contribuir, mantenha as regras de domínio, tipos TypeScript, APIs, migrations, RLS e documentação sincronizados. Mudanças de autorização devem ser testadas tanto para o perfil permitido quanto para perfis sem acesso.

---

<div align="center">
  <strong>Robot Center</strong><br />
  Governança e conhecimento para automações que precisam crescer com segurança.
</div>
