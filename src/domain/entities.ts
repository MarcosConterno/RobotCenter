export const AMBIENTES_ROBO = ["Produção", "Teste", "Desenvolvimento"] as const;
export const TIPOS_USUARIO = ["Admin", "Operador", "Dev", "Cliente", "Suporte"] as const;
export const CORES_BADGE_ROBO = ["azul", "violeta", "verde", "ambar", "rosa", "ciano"] as const;
export const CATEGORIAS_PUBLICACAO = [
  "Novo Robô",
  "Atualização de Regra",
  "Atualização do Robô",
] as const;
export const TIPOS_DISPARO_ROBO = ["Agendado", "Manual", "Gatilho"] as const;
export const TIPOS_PRODUTO_ROBO = ["INTEGRADOR", "CONSULTA_PROCESSUAL", "PETICIONAMENTO", "MOVIMENTO"] as const;
export const TIPOS_NODE_FLUXO = ["robot", "trigger", "system", "decision", "note", "text", "group"] as const;
export const STATUS_FLUXO = ["rascunho", "publicado"] as const;

export type AmbienteRobo = (typeof AMBIENTES_ROBO)[number];
export type TipoUsuario = (typeof TIPOS_USUARIO)[number];
export type CorBadgeRobo = (typeof CORES_BADGE_ROBO)[number];
export type CategoriaPublicacao = (typeof CATEGORIAS_PUBLICACAO)[number];
export type TipoDisparoRobo = (typeof TIPOS_DISPARO_ROBO)[number];
export type TipoProdutoRobo = (typeof TIPOS_PRODUTO_ROBO)[number];
export type TipoNodeFluxo = (typeof TIPOS_NODE_FLUXO)[number];
export type StatusFluxo = (typeof STATUS_FLUXO)[number];

export interface ViewportFluxo {
  x: number;
  y: number;
  zoom: number;
}

export interface Fluxo {
  id: string;
  clienteId: string;
  nome: string;
  descricao: string;
  versao: number;
  status: StatusFluxo;
  viewport: ViewportFluxo;
  criadoPor: string;
  criadorNome: string;
  criadoEm: string;
  atualizadoEm: string;
  quantidadeRobos: number;
  quantidadeConexoes: number;
}

export interface NodeFluxo {
  id: string;
  fluxoId: string;
  tipo: TipoNodeFluxo;
  roboId: string | null;
  posicaoX: number;
  posicaoY: number;
  dados: Record<string, unknown>;
}

export interface EdgeFluxo {
  id: string;
  fluxoId: string;
  nodeOrigemId: string;
  nodeDestinoId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  tipo: string;
  rotulo: string;
  condicao: string;
  fila: string;
  descricao: string;
  rotuloLargura: number | null;
  rotuloAltura: number | null;
  rotuloOffsetX: number | null;
  rotuloOffsetY: number | null;
}

export interface VersaoFluxo {
  id: string;
  fluxoId: string;
  versao: number;
  snapshot: Record<string, unknown>;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovoFluxo {
  clienteId: string;
  nome: string;
  descricao: string;
}

export interface RegraRobo {
  id?: string;
  parentId?: string | null;
  ordem?: number;
  descricao: string;
}

export interface AlteracaoRobo {
  id: string;
  descricao: string;
  realizadaEm: string;
}

export interface RobotCenterDocumentationSummary {
  id: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  currentVersion: number | null;
  docxPath?: string | null;
  pdfPath?: string | null;
}

export interface RobotUploadedDocument {
  id: string;
  robotId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface Robo {
  id: string;
  clienteId: string;
  clienteCor: CorBadgeRobo;
  nome: string;
  sistema: string;
  courtName: string;
  ideal: number;
  max: number;
  pacote: string;
  pacoteCor: CorBadgeRobo;
  descricao: string;
  ambiente: AmbienteRobo;
  ativo: boolean;
  stack: string;
  fila: string;
  versao: string;
  command: string;
  productType: TipoProdutoRobo;
  tribunal: string | null;
  tribunalSystem: string | null;
  versionCheckedAt?: string | null;
  responsavel: string;
  disparo?: TipoDisparoRobo;
  gatilhoDeRoboId?: string | null;
  gatilhoParaRoboId?: string | null;
  uploadedDocumentationPath?: string | null;
  uploadedDocumentationName?: string | null;
  uploadedDocuments?: RobotUploadedDocument[];
  robotCenterDocumentation?: RobotCenterDocumentationSummary | null;
  ultimaPublicacaoEm: string;
  alteracoes: AlteracaoRobo[];
  regras: RegraRobo[];
  regrasForaDocumentacao: RegraRobo[];
}

export type DadosFormularioRobo = Omit<Robo, "id" | "ultimaPublicacaoEm" | "alteracoes" | "clienteCor" | "robotCenterDocumentation"> & {
  alteracoesRealizadas: RegraRobo[];
  uploadedDocumentationFile?: File | null;
};

export type OperacaoImportacaoRobo = "Criar" | "Atualizar";

export type CamposImportacaoRobo = Partial<
  Omit<DadosFormularioRobo, "clienteId" | "uploadedDocumentationFile" | "uploadedDocumentationPath" | "uploadedDocumentationName">
> & {
  clienteNome?: string;
};

export interface DadosImportacaoRobo {
  operacao: OperacaoImportacaoRobo;
  roboId?: string;
  linha: number;
  campos: CamposImportacaoRobo;
}

export interface Publicacao {
  id: string;
  categoria: CategoriaPublicacao;
  roboId: string;
  descricao: string;
  publicadaEm: string;
}

export interface Usuario {
  id: number | string;
  login: string;
  email?: string;
  tipo: TipoUsuario;
  clienteId?: string | null;
  isMaster?: boolean;
}

export interface DadosCadastroUsuario {
  login: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
  clienteId?: string | null;
}

export interface Cliente {
  id: string;
  nome: string;
  tenant: string;
  cor: CorBadgeRobo;
}

export type DadosCadastroCliente = Omit<Cliente, "id">;
