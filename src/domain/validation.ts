import { z } from "zod";

import { AMBIENTES_ROBO, TIPOS_USUARIO } from "@/domain/entities";

const textoObrigatorio = (campo: string) =>
  z.string().trim().min(1, `${campo} é obrigatório.`);

export const regraRoboSchema = z.object({
  descricao: textoObrigatorio("A descrição da regra"),
});

export const dadosFormularioRoboSchema = z.object({
  nome: textoObrigatorio("Nome"),
  sistema: textoObrigatorio("Sistema"),
  pacote: textoObrigatorio("Pacote"),
  descricao: textoObrigatorio("Descrição"),
  ambiente: z.enum(AMBIENTES_ROBO),
  ativo: z.boolean(),
  stack: textoObrigatorio("Stack"),
  fila: textoObrigatorio("Fila"),
  versao: textoObrigatorio("Versão"),
  responsavel: textoObrigatorio("Responsável"),
  alteracaoRealizada: z.string().trim(),
  regras: z.array(regraRoboSchema),
});

export const dadosCadastroUsuarioSchema = z.object({
  login: textoObrigatorio("Login"),
  email: z.string().trim().email("Informe um email válido."),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  tipo: z.enum(TIPOS_USUARIO),
});

export const dadosCadastroClienteSchema = z.object({
  nome: textoObrigatorio("Nome"),
  tenant: textoObrigatorio("Tenant"),
});

export function primeiraMensagemErro(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revise os dados informados.";
}
