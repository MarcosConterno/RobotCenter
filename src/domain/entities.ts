export const AMBIENTES_ROBO = ["Produção", "Teste", "Desenvolvimento"] as const;
export const TIPOS_USUARIO = ["Admin", "Operador", "Cliente", "Suporte"] as const;
export const CORES_BADGE_ROBO = ["azul", "violeta", "verde", "ambar", "rosa", "ciano"] as const;
export const CATEGORIAS_PUBLICACAO = [
  "Novo Robô",
  "Atualização de Regra",
  "Atualização do Robô",
] as const;

export type AmbienteRobo = (typeof AMBIENTES_ROBO)[number];
export type TipoUsuario = (typeof TIPOS_USUARIO)[number];
export type CorBadgeRobo = (typeof CORES_BADGE_ROBO)[number];
export type CategoriaPublicacao = (typeof CATEGORIAS_PUBLICACAO)[number];

export interface RegraRobo {
  descricao: string;
}

export interface AlteracaoRobo {
  id: string;
  descricao: string;
  realizadaEm: string;
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
  responsavel: string;
  ultimaPublicacaoEm: string;
  alteracoes: AlteracaoRobo[];
  regras: RegraRobo[];
  regrasForaDocumentacao: RegraRobo[];
}

export type DadosFormularioRobo = Omit<Robo, "id" | "ultimaPublicacaoEm" | "alteracoes" | "clienteCor"> & {
  alteracoesRealizadas: RegraRobo[];
};

export type DadosImportacaoRobo = Omit<DadosFormularioRobo, "clienteId"> & {
  clienteNome: string;
};

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
}

export interface DadosCadastroUsuario {
  login: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
}

export interface Cliente {
  id: string;
  nome: string;
  tenant: string;
  cor: CorBadgeRobo;
}

export type DadosCadastroCliente = Omit<Cliente, "id">;
