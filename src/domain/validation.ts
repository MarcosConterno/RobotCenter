import { z } from "zod";

import { AMBIENTES_ROBO, CORES_BADGE_ROBO, TIPOS_DISPARO_ROBO, TIPOS_PRODUTO_ROBO, TIPOS_USUARIO } from "@/domain/entities";

const textoObrigatorio = (campo: string) =>
  z.string().trim().min(1, `${campo} é obrigatório.`);

export const regraRoboSchema = z.object({
  descricao: textoObrigatorio("A descrição da regra"),
});

export const dadosFormularioRoboSchema = z.object({
  nome: textoObrigatorio("Nome"),
  clienteId: z.string().uuid("Selecione um cliente.").nullable(),
  sistema: textoObrigatorio("Sistema"),
  courtName: textoObrigatorio("CourtName"),
  ideal: z.number().int().nonnegative("Ideal não pode ser negativo."),
  max: z.number().int().nonnegative("Max não pode ser negativo."),
  pacote: textoObrigatorio("Pacote"),
  pacoteCor: z.enum(CORES_BADGE_ROBO),
  descricao: textoObrigatorio("Descrição"),
  ambiente: z.enum(AMBIENTES_ROBO),
  ativo: z.boolean(),
  stack: textoObrigatorio("Stack"),
  fila: textoObrigatorio("Fila"),
  versao: textoObrigatorio("Versão"),
  command: z.string().trim().default(""),
  productType: z.enum(TIPOS_PRODUTO_ROBO),
  tribunal: z.string().trim().nullable().default(null),
  tribunalSystem: z.string().trim().nullable().default(null),
  responsavel: textoObrigatorio("Responsável"),
  disparo: z.enum(TIPOS_DISPARO_ROBO).default("Manual"),
  gatilhoDeRoboId: z.string().uuid().nullable().default(null),
  gatilhoParaRoboId: z.string().uuid().nullable().default(null),
  uploadedDocumentationPath: z.string().nullable().optional(),
  uploadedDocumentationName: z.string().nullable().optional(),
  uploadedDocumentationFile: z.custom<File | null>(
    (arquivo) => arquivo == null || (typeof File !== "undefined" && arquivo instanceof File),
    "Selecione um arquivo PDF válido.",
  ).optional(),
  alteracoesRealizadas: z.array(regraRoboSchema),
  regras: z.array(regraRoboSchema),
  regrasForaDocumentacao: z.array(regraRoboSchema),
}).refine((dados) => dados.max >= dados.ideal, {
  message: "Max deve ser maior ou igual a Ideal.",
  path: ["max"],
}).refine((dados) => dados.productType !== "INTEGRADOR" || (!dados.tribunal && !dados.tribunalSystem), {
  message: "Robôs Integradores não utilizam Tribunal ou Sistema Tribunal.",
  path: ["tribunal"],
}).refine((dados) => dados.productType !== "INTEGRADOR" || Boolean(dados.clienteId), {
  message: "Selecione um cliente para o Robô Integrador.",
  path: ["clienteId"],
});

export const dadosCadastroUsuarioSchema = z.object({
  login: textoObrigatorio("Nome"),
  email: z.string().trim().email("Informe um email válido."),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  tipo: z.enum(TIPOS_USUARIO),
  clienteId: z.string().uuid("Selecione um cliente válido.").nullable().optional(),
}).refine((dados) => dados.tipo !== "Cliente" || Boolean(dados.clienteId), {
  message: "Usuário Cliente deve estar vinculado a um cliente.",
  path: ["clienteId"],
});

export const dadosCadastroClienteSchema = z.object({
  nome: textoObrigatorio("Nome"),
  tenant: textoObrigatorio("Tenant"),
  cor: z.enum(CORES_BADGE_ROBO),
});

export function primeiraMensagemErro(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revise os dados informados.";
}
