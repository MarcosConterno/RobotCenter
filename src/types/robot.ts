export type RobotEnvironment =
  | "Produção"
  | "Teste"
  | "Desenvolvimento";

export interface Robot {
  id: number;

  // Informações Gerais
  nome: string;
  sistema: string;
  pacote: string;
  descricao: string;

  // Ambiente
  ambiente: RobotEnvironment;
  ativo: boolean;

  // Técnica
  stack: string;
  fila: string;
  versao: string;

  // Administração
  responsavel: string;
  ultimaPublicacao: string;

  // Documentação e publicação
  alteracaoRealizada: string;
  regras: string[];
}

export interface RobotFormData {
  nome: string;
  sistema: string;
  pacote: string;
  descricao: string;

  ambiente: RobotEnvironment;
  ativo: boolean;

  stack: string;
  fila: string;
  versao: string;

  responsavel: string;
  alteracaoRealizada: string;
  regras: string[];
}
