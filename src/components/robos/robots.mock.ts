import type { Robot } from "@/types/robot";
export const robotsMock: Robot[] = [
  {
    id: 1,
    nome: "Captura de Documentos",
    sistema: "Allianz",
    pacote: "Documentos",
    ambiente: "Produção",
    ultimaPublicacao: "21/07/2026",

    descricao:
      "Captura automaticamente documentos enviados pela seguradora e prepara os arquivos para processamento.",

    stack: ".NET 8",
    fila: "AWS SQS",
    versao: "2.3.1",
    responsavel: "Marcos Souza",
    ativo: true,
    alteracaoRealizada: "Ajustado o tratamento de anexos recebidos durante a captura.",
    regras: ["Validar se o documento possui extensão permitida", "Enviar arquivos válidos para a fila de processamento"],
  },

  {
    id: 2,
    nome: "Cadastro de Documentos",
    sistema: "Tokio Marine",
    pacote: "Documentos",
    ambiente: "Teste",
    ultimaPublicacao: "20/07/2026",

    descricao:
      "Realiza o cadastro automático de documentos no sistema Legal One.",

    stack: ".NET 8",
    fila: "RabbitMQ",
    versao: "1.8.0",
    responsavel: "Equipe Integrações",
    ativo: true,
    alteracaoRealizada: "",
    regras: ["Cadastrar somente documentos previamente validados"],
  },

  {
    id: 3,
    nome: "Cadastro de Novas Pastas",
    sistema: "Tokio Marine",
    pacote: "Pastas",
    ambiente: "Desenvolvimento",
    ultimaPublicacao: "18/07/2026",

    descricao:
      "Cria automaticamente novas pastas processuais conforme regras da seguradora.",

    stack: ".NET 8",
    fila: "AWS SQS",
    versao: "0.9.5",
    responsavel: "Marcos Souza",
    ativo: true,
    alteracaoRealizada: "",
    regras: [],
  },

  {
    id: 4,
    nome: "Extração de Documentos",
    sistema: "Legal One",
    pacote: "Integração",
    ambiente: "Produção",
    ultimaPublicacao: "21/07/2026",

    descricao:
      "Extrai documentos do processo e envia para integração com o Kortex.",

    stack: ".NET 8",
    fila: "Azure Queue",
    versao: "3.0.2",
    responsavel: "Equipe Jurídica",
    ativo: true,
    alteracaoRealizada: "",
    regras: [],
  },

  {
    id: 5,
    nome: "Importação de Sinistros",
    sistema: "Yelum",
    pacote: "Sinistros",
    ambiente: "Produção",
    ultimaPublicacao: "19/07/2026",

    descricao:
      "Importa automaticamente novos sinistros disponibilizados pela seguradora.",

    stack: ".NET 9",
    fila: "AWS SQS",
    versao: "1.2.7",
    responsavel: "Marcos Souza",
    ativo: false,
    alteracaoRealizada: "",
    regras: [],
  },

  {
    id: 6,
    nome: "Atualização de Andamentos",
    sistema: "Allianz",
    pacote: "Andamentos",
    ambiente: "Teste",
    ultimaPublicacao: "21/07/2026",

    descricao:
      "Atualiza os andamentos processuais diretamente na plataforma da seguradora.",

    stack: ".NET 9",
    fila: "RabbitMQ",
    versao: "2.0.0",
    responsavel: "Equipe Operações",
    ativo: true,
    alteracaoRealizada: "",
    regras: [],
  },
];
