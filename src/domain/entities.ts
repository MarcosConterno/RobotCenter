export const AMBIENTES_ROBO = ["Produção", "Teste", "Desenvolvimento"] as const;
export const TIPOS_USUARIO = ["Admin", "Operador", "Cliente"] as const;
export const CATEGORIAS_PUBLICACAO = [
  "Novo Robô",
  "Atualização de Regra",
  "Atualização do Robô",
] as const;

export type AmbienteRobo = (typeof AMBIENTES_ROBO)[number];
export type TipoUsuario = (typeof TIPOS_USUARIO)[number];
export type CategoriaPublicacao = (typeof CATEGORIAS_PUBLICACAO)[number];

export interface RegraRobo {
  descricao: string;
}

export interface Robo {
  id: number;
  nome: string;
  sistema: string;
  pacote: string;
  descricao: string;
  ambiente: AmbienteRobo;
  ativo: boolean;
  stack: string;
  fila: string;
  versao: string;
  responsavel: string;
  ultimaPublicacaoEm: string;
  alteracaoRealizada: string;
  regras: RegraRobo[];
}

export type DadosFormularioRobo = Omit<Robo, "id" | "ultimaPublicacaoEm">;

export interface Publicacao {
  id: number;
  categoria: CategoriaPublicacao;
  roboId: number;
  descricao: string;
  publicadaEm: string;
}

export interface Usuario {
  id: number;
  login: string;
  tipo: TipoUsuario;
}

export interface DadosCadastroUsuario {
  login: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
}

export interface Cliente {
  id: number;
  nome: string;
  tenant: string;
}

export type DadosCadastroCliente = Omit<Cliente, "id">;
