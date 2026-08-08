"use client";


import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
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

const LIMITE_PUBLICACOES = 20;

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

async function enviarManualRobo(roboId: string, arquivo?: File | null) {
  if (!arquivo) return null;
  if (arquivo.type !== "application/pdf") throw new Error("O manual deve ser um arquivo PDF.");
  if (arquivo.size > 20 * 1024 * 1024) throw new Error("O manual deve ter no máximo 20 MB.");

  const supabase = createClient();
  const manualPath = `${roboId}/manual.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("robot-manuals")
    .upload(manualPath, arquivo, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;
  const { error: updateError } = await supabase.from("robos")
    .update({ manual_path: manualPath, manual_nome: arquivo.name })
    .eq("id", roboId);
  if (updateError) throw updateError;
  return { manualPath, manualNome: arquivo.name };
}

function harmonizarCoresCompartilhadas(robos: Robo[], clientes: Cliente[]) {
  const clientePorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const corPacotePorNome = new Map<string, Robo["pacoteCor"]>();

  return robos.map((robo) => {
    const chavePacote = normalizarIdentificador(robo.pacote);
    const clienteCor = clientePorId.get(robo.clienteId)?.cor ?? robo.clienteCor;
      const pacoteCor = corPacotePorNome.get(chavePacote) ?? robo.pacoteCor;
    corPacotePorNome.set(chavePacote, pacoteCor);
    return { ...robo, clienteCor, pacoteCor };
  });
}

interface AppDataContextValue {
  robos: Robo[];
  publicacoes: Publicacao[];
  usuarios: Usuario[];
  clientes: Cliente[];
  cadastrarRobo: (dados: DadosFormularioRobo) => Promise<Robo>;
  importarRobos: (dados: DadosImportacaoRobo[]) => Promise<Robo[]>;
  atualizarRobo: (id: string, dados: DadosFormularioRobo) => Promise<Robo | null>;
  atualizarCapacidadeRobo: (id: string, ideal: number, max: number) => Promise<Robo | null>;
  excluirRobo: (id: string) => void;
  publicarAlteracoes: (id: string, robotAtualizado?: Robo, descricaoPublicacao?: string) => Promise<Robo | null>;
  cadastrarUsuario: (dados: DadosCadastroUsuario) => void;
  cadastrarCliente: (dados: DadosCadastroCliente) => Promise<Cliente>;
  atualizarCliente: (id: string, dados: DadosCadastroCliente) => Promise<Cliente | null>;
  excluirCliente: (id: string) => boolean;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [robos, setRobos] = useState<Robo[]>([]);
  const [publicacoesLocais, setPublicacoesLocais] = useState<Publicacao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("clientes").select("id,nome,tenant,cor").is("deleted_at", null).order("nome"),
      supabase.from("robos").select("*").is("deleted_at", null).order("nome"),
      supabase.from("regras_robo").select("robo_id,descricao,ordem,tipo").is("deleted_at", null).order("ordem"),
      supabase.from("alteracoes_robo").select("id,robo_id,descricao,realizada_em").order("realizada_em", { ascending: false }),
      supabase.from("publicacoes").select("id,robo_id,categoria,descricao,publicada_em").order("publicada_em", { ascending: false }),
    ]).then(([clientesResult, robosResult, regrasResult, alteracoesResult, publicacoesResult]) => {
      const clientesCarregados: Cliente[] = (clientesResult.data ?? []).map((cliente) => ({
        ...cliente,
        cor: cliente.cor as Cliente["cor"],
      }));
      if (clientesResult.data) setClientes(clientesCarregados);
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
      const robosCarregados: Robo[] = robosResult.data.map((item) => ({
        id: item.id,
        clienteId: item.cliente_id,
        clienteCor: (clientesCarregados.find((cliente) => cliente.id === item.cliente_id)?.cor as Robo["clienteCor"] | undefined) ?? item.cliente_cor as Robo["clienteCor"],
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
        manualPath: item.manual_path,
        manualNome: item.manual_nome,
        ultimaPublicacaoEm: publicacoes.find((publicacao) => publicacao.robo_id === item.id)?.publicada_em ?? item.updated_at,
        alteracoes: alteracoes.filter((alteracao) => alteracao.robo_id === item.id).map((alteracao) => ({ id: alteracao.id, descricao: alteracao.descricao, realizadaEm: alteracao.realizada_em })),
        regras: regras.filter((regra) => regra.robo_id === item.id && regra.tipo === "documentacao").map(({ descricao }) => ({ descricao })),
        regrasForaDocumentacao: regras.filter((regra) => regra.robo_id === item.id && regra.tipo === "fora_documentacao").map(({ descricao }) => ({ descricao })),
      }));
      setRobos(harmonizarCoresCompartilhadas(robosCarregados, clientesCarregados));
    });
  }, []);

  async function cadastrarRobo(dados: DadosFormularioRobo) {
    const { alteracoesRealizadas, manualArquivo, ...cadastro } = dados;
    const supabase = createClient();
    const clienteCor = clientes.find((cliente) => cliente.id === cadastro.clienteId)?.cor ?? "azul";
    const { data: roboCriado, error: erroRobo } = await supabase.from("robos").insert({
      cliente_id: cadastro.clienteId, cliente_cor: clienteCor, nome: cadastro.nome, sistema: cadastro.sistema,
      court_name: cadastro.courtName, ideal: cadastro.ideal, max: cadastro.max, pacote: cadastro.pacote,
      pacote_cor: cadastro.pacoteCor, descricao: cadastro.descricao, ambiente: cadastro.ambiente,
      ativo: cadastro.ativo, stack: cadastro.stack, fila: cadastro.fila, versao: cadastro.versao,
      responsavel: cadastro.responsavel,
    }).select("id,updated_at").single();
    if (erroRobo) throw erroRobo;
    const manual = await enviarManualRobo(roboCriado.id, manualArquivo);

    const regras = [
      ...cadastro.regras.map((regra, ordem) => ({ robo_id: roboCriado.id, descricao: regra.descricao, ordem, tipo: "documentacao" })),
      ...cadastro.regrasForaDocumentacao.map((regra, ordem) => ({ robo_id: roboCriado.id, descricao: regra.descricao, ordem, tipo: "fora_documentacao" })),
    ];
    if (regras.length) {
      const { error } = await supabase.from("regras_robo").insert(regras);
      if (error) throw error;
    }
    let alteracoesCriadas: { id: string; descricao: string; realizada_em: string }[] = [];
    if (alteracoesRealizadas.length) {
      const { data, error } = await supabase.from("alteracoes_robo")
        .insert(alteracoesRealizadas.map((alteracao) => ({ robo_id: roboCriado.id, descricao: alteracao.descricao })))
        .select("id,descricao,realizada_em");
      if (error) throw error;
      alteracoesCriadas = data;
    }
    const novoRobo: Robo = {
      ...cadastro,
      clienteCor,
      id: roboCriado.id,
      ultimaPublicacaoEm: roboCriado.updated_at,
      manualPath: manual?.manualPath ?? cadastro.manualPath ?? null,
      manualNome: manual?.manualNome ?? cadastro.manualNome ?? null,
      alteracoes: alteracoesCriadas.map((alteracao) => ({ id: alteracao.id, descricao: alteracao.descricao, realizadaEm: alteracao.realizada_em })),
    };
    setRobos((atuais) => [...atuais, novoRobo]);
    return novoRobo;
  }

  async function atualizarRobo(id: string, dados: DadosFormularioRobo) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const { alteracoesRealizadas, manualArquivo, ...cadastro } = dados;
    const supabase = createClient();
    const { error } = await supabase.from("robos").update({
      cliente_id: cadastro.clienteId, nome: cadastro.nome,
      sistema: cadastro.sistema, court_name: cadastro.courtName, ideal: cadastro.ideal, max: cadastro.max,
      pacote: cadastro.pacote, pacote_cor: cadastro.pacoteCor, descricao: cadastro.descricao,
      ambiente: cadastro.ambiente, ativo: cadastro.ativo, stack: cadastro.stack, fila: cadastro.fila,
      versao: cadastro.versao, responsavel: cadastro.responsavel,
    }).eq("id", id);
    if (error) throw error;
    const manual = await enviarManualRobo(id, manualArquivo);
    const clienteSelecionado = clientes.find((cliente) => cliente.id === cadastro.clienteId);
    const idsPacoteMesmoNome = robos
      .filter((robo) => normalizarIdentificador(robo.pacote) === normalizarIdentificador(cadastro.pacote))
      .map((robo) => robo.id);
    await Promise.all([
      idsPacoteMesmoNome.length
        ? supabase.from("robos").update({ pacote_cor: cadastro.pacoteCor }).in("id", idsPacoteMesmoNome)
        : Promise.resolve(),
    ]);
    const agora = new Date().toISOString();
    const novasAlteracoes = alteracoesRealizadas.map((alteracao, index) => ({
      id: crypto.randomUUID(),
      descricao: alteracao.descricao,
      realizadaEm: agora,
    }));
    const novaAlteracao = [...novasAlteracoes, ...atual.alteracoes];
    const atualizado = {
      ...atual,
      ...cadastro,
      manualPath: manual?.manualPath ?? cadastro.manualPath ?? atual.manualPath ?? null,
      manualNome: manual?.manualNome ?? cadastro.manualNome ?? atual.manualNome ?? null,
      clienteCor: clienteSelecionado?.cor ?? atual.clienteCor,
      alteracoes: novaAlteracao,
    };
    setRobos((atuais) => atuais.map((robo) => {
      const mesmoPacote = normalizarIdentificador(robo.pacote) === normalizarIdentificador(cadastro.pacote);
      const comCores = {
        ...robo,
        pacoteCor: mesmoPacote ? cadastro.pacoteCor : robo.pacoteCor,
      };
      return robo.id === id ? { ...atualizado, pacoteCor: comCores.pacoteCor } : comCores;
    }));
    return atualizado;
  }

  async function atualizarCapacidadeRobo(id: string, ideal: number, max: number) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;
    const supabase = createClient();
    const { error } = await supabase.rpc("update_robot_capacity", {
      target_robot_id: id,
      target_ideal: ideal,
      target_max: max,
    });
    if (error) throw error;
    const atualizado = { ...atual, ideal, max };
    setRobos((atuais) => atuais.map((robo) => robo.id === id ? atualizado : robo));
    return atualizado;
  }

  function excluirRobo(id: string) {
    setRobos((atuais) => atuais.filter((robo) => robo.id !== id));
  }

  async function publicarAlteracoes(id: string, robotAtualizado?: Robo, descricaoPublicacao?: string) {
    const atual = robotAtualizado ?? robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const publicadaEm = new Date().toISOString();
    const atualizado = { ...atual, ultimaPublicacaoEm: publicadaEm };
    const descricao = descricaoPublicacao?.trim() || atual.alteracoes[0]?.descricao || `Novas alterações foram publicadas para o robô ${atual.nome}.`;
    const categoria: Publicacao["categoria"] = robotAtualizado && !robos.some((robo) => robo.id === id)
      ? "Novo Robô"
      : "Atualização do Robô";
    const supabase = createClient();
    const { data, error } = await supabase.from("publicacoes").insert({
      robo_id: id, categoria, descricao, publicada_em: publicadaEm,
    }).select("id,robo_id,categoria,descricao,publicada_em").single();
    if (error) throw error;
    const publicacao: Publicacao = {
      id: data.id, roboId: data.robo_id, categoria: data.categoria as Publicacao["categoria"],
      descricao: data.descricao, publicadaEm: data.publicada_em,
    };
    const proximasPublicacoes = [publicacao, ...publicacoesLocais]
      .sort((a, b) => b.publicadaEm.localeCompare(a.publicadaEm))
      .slice(0, LIMITE_PUBLICACOES);

    setRobos((atuais) => atuais.map((robo) => (robo.id === id ? atualizado : robo)));
    setPublicacoesLocais(proximasPublicacoes);
    return atualizado;
  }

  function cadastrarUsuario(dados: DadosCadastroUsuario) {
    const usuario: Usuario = { id: Date.now(), login: dados.login.trim(), tipo: dados.tipo };
    setUsuarios((atuais) => [...atuais, usuario]);
  }

  async function cadastrarCliente(dados: DadosCadastroCliente) {
    const supabase = createClient();
    const { data, error } = await supabase.from("clientes").insert({ nome: dados.nome.trim(), tenant: dados.tenant.trim(), cor: dados.cor }).select("id,nome,tenant,cor").single();
    if (error) throw error;
    const cliente = data as Cliente;
    setClientes((atuais) => [...atuais, cliente]);
    return cliente;
  }

  async function importarRobos(itens: DadosImportacaoRobo[]) {
    const supabase = createClient();
    const clientesAtualizados = [...clientes];
    const clientesPorNome = new Map(clientesAtualizados.map((cliente) => [normalizarIdentificador(cliente.nome), cliente]));
    const tenantsEmUso = new Set(clientesAtualizados.map((cliente) => cliente.tenant));
    const corPacotePorNome = new Map<string, Robo["pacoteCor"]>();
    robos.forEach((robo) => {
      const chaveNomePacote = normalizarIdentificador(robo.pacote);
      if (!corPacotePorNome.has(chaveNomePacote)) corPacotePorNome.set(chaveNomePacote, robo.pacoteCor);
    });

    const novosRobos: Robo[] = [];
    for (const dados of itens) {
      const { alteracoesRealizadas, clienteNome, ...cadastro } = dados;
      const chaveCliente = normalizarIdentificador(clienteNome);
      const chavePacote = normalizarIdentificador(cadastro.pacote);
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
        const { data: clienteCriado, error: erroCliente } = await supabase.from("clientes").insert({ nome, tenant, cor: "azul" }).select("id,nome,tenant,cor").single();
        if (erroCliente || !clienteCriado) throw erroCliente ?? new Error("Cliente não retornado após o cadastro.");
        cliente = { ...clienteCriado, cor: clienteCriado.cor as Cliente["cor"] };
        clientesAtualizados.push(cliente);
        clientesPorNome.set(chaveCliente, cliente);
        tenantsEmUso.add(tenant);
      }
      const clienteCor = cliente.cor;
      const pacoteCor = corPacotePorNome.get(chavePacote) ?? cadastro.pacoteCor;
      corPacotePorNome.set(chavePacote, pacoteCor);
      const { data: roboCriado, error: erroRobo } = await supabase.from("robos").insert({
        cliente_id: cliente.id, cliente_cor: clienteCor, nome: cadastro.nome, sistema: cadastro.sistema, court_name: cadastro.courtName,
        ideal: cadastro.ideal, max: cadastro.max, pacote: cadastro.pacote, pacote_cor: pacoteCor, descricao: cadastro.descricao,
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
        clienteCor,
        pacoteCor,
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

  async function atualizarCliente(id: string, dados: DadosCadastroCliente) {
    const atual = clientes.find((cliente) => cliente.id === id);
    if (!atual) return null;
    const supabase = createClient();
    const atualizado = { ...atual, nome: dados.nome.trim(), tenant: dados.tenant.trim(), cor: dados.cor };
    const { error } = await supabase.from("clientes").update({ nome: atualizado.nome, tenant: atualizado.tenant, cor: atualizado.cor }).eq("id", id);
    if (error) throw error;
    setClientes((atuais) => atuais.map((cliente) => cliente.id === id ? atualizado : cliente));
    setRobos((atuais) => atuais.map((robo) => robo.clienteId === id ? { ...robo, clienteCor: atualizado.cor } : robo));
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
    atualizarCapacidadeRobo,
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
