"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CATEGORIAS_PUBLICACAO,
  type Cliente,
  type DadosCadastroCliente,
  type DadosCadastroUsuario,
  type DadosFormularioRobo,
  type DadosImportacaoRobo,
  type Publicacao,
  type Robo,
  type Usuario,
} from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";

const PUBLICACOES_STORAGE_KEY = "robot-center-publications";
const PUBLICACOES_STORAGE_VERSION = 1;
const LIMITE_PUBLICACOES_LOCAIS = 20;

function normalizarIdentificador(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function gerarTenant(nome: string) {
  return normalizarIdentificador(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "cliente-importado";
}

interface AppDataContextValue {
  robos: Robo[];
  publicacoes: Publicacao[];
  usuarios: Usuario[];
  clientes: Cliente[];
  cadastrarRobo: (dados: DadosFormularioRobo) => Robo;
  importarRobos: (dados: DadosImportacaoRobo[]) => Promise<Robo[]>;
  atualizarRobo: (id: string, dados: DadosFormularioRobo) => Promise<Robo | null>;
  excluirRobo: (id: string) => void;
  publicarAlteracoes: (id: string) => Robo | null;
  cadastrarUsuario: (dados: DadosCadastroUsuario) => void;
  cadastrarCliente: (dados: DadosCadastroCliente) => void;
  atualizarCliente: (id: string, dados: DadosCadastroCliente) => Cliente | null;
  excluirCliente: (id: string) => boolean;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function lerPublicacoesLocais(): Publicacao[] {
  try {
    const storedValue = JSON.parse(localStorage.getItem(PUBLICACOES_STORAGE_KEY) ?? "[]") as unknown;
    const value = Array.isArray(storedValue)
      ? storedValue
      : storedValue && typeof storedValue === "object" && Array.isArray((storedValue as { items?: unknown }).items)
        ? (storedValue as { items: unknown[] }).items
        : [];

    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const legacyRobot = record.robot as { id?: unknown } | undefined;
      const roboId = typeof record.roboId === "string" ? record.roboId : legacyRobot?.id;
      const categoria = record.categoria ?? record.category;
      const descricao = record.descricao ?? record.description;
      const publicadaEm = record.publicadaEm ?? new Date().toISOString();

      if (
        typeof record.id !== "string" ||
        typeof roboId !== "string" ||
        typeof categoria !== "string" ||
        !CATEGORIAS_PUBLICACAO.includes(categoria as (typeof CATEGORIAS_PUBLICACAO)[number]) ||
        typeof descricao !== "string" ||
        typeof publicadaEm !== "string"
      ) return [];

      return [{ id: record.id, roboId, categoria, descricao, publicadaEm } as Publicacao];
    });
  } catch {
    return [];
  }
}

function salvarPublicacoesLocais(publicacoes: Publicacao[]) {
  try {
    localStorage.setItem(
      PUBLICACOES_STORAGE_KEY,
      JSON.stringify({ version: PUBLICACOES_STORAGE_VERSION, items: publicacoes }),
    );
  } catch {
    // O estado em memória continua válido quando o armazenamento do navegador não está disponível.
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [robos, setRobos] = useState<Robo[]>([]);
  const [publicacoesLocais, setPublicacoesLocais] = useState<Publicacao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    setPublicacoesLocais(lerPublicacoesLocais());
    const supabase = createClient();
    void Promise.all([
      supabase.from("clientes").select("id,nome,tenant").is("deleted_at", null).order("nome"),
      supabase.from("robos").select("*").is("deleted_at", null).order("nome"),
      supabase.from("regras_robo").select("robo_id,descricao,ordem,tipo").is("deleted_at", null).order("ordem"),
      supabase.from("alteracoes_robo").select("id,robo_id,descricao,realizada_em").order("realizada_em", { ascending: false }),
      supabase.from("publicacoes").select("id,robo_id,categoria,descricao,publicada_em").order("publicada_em", { ascending: false }),
    ]).then(([clientesResult, robosResult, regrasResult, alteracoesResult, publicacoesResult]) => {
      if (clientesResult.data) setClientes(clientesResult.data);
      if (publicacoesResult.data) setPublicacoesLocais(publicacoesResult.data.map((item) => ({
        id: item.id,
        roboId: item.robo_id,
        categoria: item.categoria as Publicacao["categoria"],
        descricao: item.descricao,
        publicadaEm: item.publicada_em,
      })));
      if (!robosResult.data) return;
      const regras = regrasResult.data ?? [];
      const alteracoes = alteracoesResult.data ?? [];
      const publicacoes = publicacoesResult.data ?? [];
      setRobos(robosResult.data.map((item) => ({
        id: item.id,
        clienteId: item.cliente_id,
        clienteCor: item.cliente_cor as Robo["clienteCor"],
        nome: item.nome,
        sistema: item.sistema,
        courtName: item.court_name,
        ideal: item.ideal,
        max: item.max,
        pacote: item.pacote,
        pacoteCor: item.pacote_cor as Robo["pacoteCor"],
        descricao: item.descricao,
        ambiente: item.ambiente as Robo["ambiente"],
        ativo: item.ativo,
        stack: item.stack,
        fila: item.fila,
        versao: item.versao,
        responsavel: item.responsavel,
        ultimaPublicacaoEm: publicacoes.find((publicacao) => publicacao.robo_id === item.id)?.publicada_em ?? item.updated_at,
        alteracoes: alteracoes.filter((alteracao) => alteracao.robo_id === item.id).map((alteracao) => ({ id: alteracao.id, descricao: alteracao.descricao, realizadaEm: alteracao.realizada_em })),
        regras: regras.filter((regra) => regra.robo_id === item.id && regra.tipo === "documentacao").map(({ descricao }) => ({ descricao })),
        regrasForaDocumentacao: regras.filter((regra) => regra.robo_id === item.id && regra.tipo === "fora_documentacao").map(({ descricao }) => ({ descricao })),
      })));
    });
  }, []);

  function cadastrarRobo(dados: DadosFormularioRobo) {
    const { alteracoesRealizadas, ...cadastro } = dados;
    const agora = new Date().toISOString();
    const novoRobo: Robo = {
      ...cadastro,
      id: crypto.randomUUID(),
      ultimaPublicacaoEm: agora,
      alteracoes: alteracoesRealizadas.map((alteracao, index) => ({
        id: crypto.randomUUID(),
        descricao: alteracao.descricao,
        realizadaEm: agora,
      })),
    };
    setRobos((atuais) => [...atuais, novoRobo]);
    return novoRobo;
  }

  async function atualizarRobo(id: string, dados: DadosFormularioRobo) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const { alteracoesRealizadas, ...cadastro } = dados;
    const supabase = createClient();
    const { error } = await supabase.from("robos").update({
      cliente_id: cadastro.clienteId, cliente_cor: cadastro.clienteCor, nome: cadastro.nome,
      sistema: cadastro.sistema, court_name: cadastro.courtName, ideal: cadastro.ideal, max: cadastro.max,
      pacote: cadastro.pacote, pacote_cor: cadastro.pacoteCor, descricao: cadastro.descricao,
      ambiente: cadastro.ambiente, ativo: cadastro.ativo, stack: cadastro.stack, fila: cadastro.fila,
      versao: cadastro.versao, responsavel: cadastro.responsavel,
    }).eq("id", id);
    if (error) throw error;
    const agora = new Date().toISOString();
    const novasAlteracoes = alteracoesRealizadas.map((alteracao, index) => ({
      id: crypto.randomUUID(),
      descricao: alteracao.descricao,
      realizadaEm: agora,
    }));
    const novaAlteracao = [...novasAlteracoes, ...atual.alteracoes];
    const atualizado = { ...atual, ...cadastro, alteracoes: novaAlteracao };
    setRobos((atuais) => atuais.map((robo) => (robo.id === id ? atualizado : robo)));
    return atualizado;
  }

  function excluirRobo(id: string) {
    setRobos((atuais) => atuais.filter((robo) => robo.id !== id));
  }

  function publicarAlteracoes(id: string) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const publicadaEm = new Date().toISOString();
    const atualizado = { ...atual, ultimaPublicacaoEm: publicadaEm };
    const publicacao: Publicacao = {
      id: crypto.randomUUID(),
      categoria: "Atualização do Robô",
      roboId: id,
      descricao: atual.alteracoes[0]?.descricao || `Novas alterações foram publicadas para o robô ${atual.nome}.`,
      publicadaEm,
    };
    const proximasPublicacoes = [publicacao, ...publicacoesLocais].slice(0, LIMITE_PUBLICACOES_LOCAIS);

    setRobos((atuais) => atuais.map((robo) => (robo.id === id ? atualizado : robo)));
    setPublicacoesLocais(proximasPublicacoes);
    salvarPublicacoesLocais(proximasPublicacoes);
    return atualizado;
  }

  function cadastrarUsuario(dados: DadosCadastroUsuario) {
    const usuario: Usuario = { id: Date.now(), login: dados.login.trim(), tipo: dados.tipo };
    setUsuarios((atuais) => [...atuais, usuario]);
  }

  function cadastrarCliente(dados: DadosCadastroCliente) {
    const cliente: Cliente = { id: crypto.randomUUID(), nome: dados.nome.trim(), tenant: dados.tenant.trim() };
    setClientes((atuais) => [...atuais, cliente]);
  }

  async function importarRobos(itens: DadosImportacaoRobo[]) {
    const supabase = createClient();
    const clientesAtualizados = [...clientes];
    const clientesPorNome = new Map(clientesAtualizados.map((cliente) => [normalizarIdentificador(cliente.nome), cliente]));
    const tenantsEmUso = new Set(clientesAtualizados.map((cliente) => cliente.tenant));

    const novosRobos: Robo[] = [];
    for (const dados of itens) {
      const { alteracoesRealizadas, clienteNome, ...cadastro } = dados;
      const chaveCliente = normalizarIdentificador(clienteNome);
      let cliente = clientesPorNome.get(chaveCliente);
      if (!cliente) {
        const nome = clienteNome.trim() || "Cliente não informado";
        const tenantBase = gerarTenant(nome);
        let tenant = tenantBase;
        let suffix = 2;
        while (tenantsEmUso.has(tenant)) {
          tenant = `${tenantBase}-${suffix}`;
          suffix += 1;
        }
        const { data: clienteCriado, error: erroCliente } = await supabase.from("clientes").insert({ nome, tenant }).select("id,nome,tenant").single();
        if (erroCliente) throw erroCliente;
        cliente = clienteCriado;
        clientesAtualizados.push(cliente);
        clientesPorNome.set(chaveCliente, cliente);
        tenantsEmUso.add(tenant);
      }
      const { data: roboCriado, error: erroRobo } = await supabase.from("robos").insert({
        cliente_id: cliente.id, cliente_cor: cadastro.clienteCor, nome: cadastro.nome, sistema: cadastro.sistema, court_name: cadastro.courtName,
        ideal: cadastro.ideal, max: cadastro.max, pacote: cadastro.pacote, pacote_cor: cadastro.pacoteCor, descricao: cadastro.descricao,
        ambiente: cadastro.ambiente, ativo: cadastro.ativo, stack: cadastro.stack, fila: cadastro.fila,
        versao: cadastro.versao, responsavel: cadastro.responsavel,
      }).select("id,updated_at").single();
      if (erroRobo) throw erroRobo;
      const regras = [
        ...cadastro.regras.map((regra, ordem) => ({ robo_id: roboCriado.id, descricao: regra.descricao, ordem, tipo: "documentacao" })),
        ...cadastro.regrasForaDocumentacao.map((regra, ordem) => ({ robo_id: roboCriado.id, descricao: regra.descricao, ordem, tipo: "fora_documentacao" })),
      ];
      if (regras.length) {
        const { error } = await supabase.from("regras_robo").insert(regras);
        if (error) throw error;
      }
      const alteracoes = alteracoesRealizadas.map((alteracao) => ({ robo_id: roboCriado.id, descricao: alteracao.descricao }));
      let alteracoesCriadas: { id: string; descricao: string; realizada_em: string }[] = [];
      if (alteracoes.length) {
        const { data, error } = await supabase.from("alteracoes_robo").insert(alteracoes).select("id,descricao,realizada_em");
        if (error) throw error;
        alteracoesCriadas = data;
      }
      novosRobos.push({
        ...cadastro,
        clienteId: cliente.id,
        id: roboCriado.id,
        ultimaPublicacaoEm: roboCriado.updated_at,
        alteracoes: alteracoesCriadas.map((alteracao) => ({ id: alteracao.id, descricao: alteracao.descricao, realizadaEm: alteracao.realizada_em })),
      });
    }
    setClientes(clientesAtualizados);
    setRobos((atuais) => [...atuais, ...novosRobos]);
    return novosRobos;
  }

  function atualizarCliente(id: string, dados: DadosCadastroCliente) {
    const atual = clientes.find((cliente) => cliente.id === id);
    if (!atual) return null;
    const atualizado = { ...atual, nome: dados.nome.trim(), tenant: dados.tenant.trim() };
    setClientes((atuais) => atuais.map((cliente) => cliente.id === id ? atualizado : cliente));
    return atualizado;
  }

  function excluirCliente(id: string) {
    if (robos.some((robo) => robo.clienteId === id)) return false;
    setClientes((atuais) => atuais.filter((cliente) => cliente.id !== id));
    return true;
  }

  const publicacoes = useMemo(() => publicacoesLocais, [publicacoesLocais]);

  const value: AppDataContextValue = {
    robos,
    publicacoes,
    usuarios,
    clientes,
    cadastrarRobo,
    importarRobos,
    atualizarRobo,
    excluirRobo,
    publicarAlteracoes,
    cadastrarUsuario,
    cadastrarCliente,
    atualizarCliente,
    excluirCliente,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData deve ser usado dentro de AppDataProvider.");
  return context;
}
