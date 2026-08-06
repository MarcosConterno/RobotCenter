"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CATEGORIAS_PUBLICACAO,
  type Cliente,
  type DadosCadastroCliente,
  type DadosCadastroUsuario,
  type DadosFormularioRobo,
  type Publicacao,
  type Robo,
  type Usuario,
} from "@/domain/entities";
import { clientesMock, publicacoesMock, robosMock, usuariosMock } from "@/mocks/app.mock";

const PUBLICACOES_STORAGE_KEY = "robot-center-publications";
const PUBLICACOES_STORAGE_VERSION = 1;
const LIMITE_PUBLICACOES_LOCAIS = 20;

interface AppDataContextValue {
  robos: Robo[];
  publicacoes: Publicacao[];
  usuarios: Usuario[];
  clientes: Cliente[];
  cadastrarRobo: (dados: DadosFormularioRobo) => Robo;
  atualizarRobo: (id: number, dados: DadosFormularioRobo) => Robo | null;
  excluirRobo: (id: number) => void;
  publicarAlteracoes: (id: number) => Robo | null;
  cadastrarUsuario: (dados: DadosCadastroUsuario) => void;
  cadastrarCliente: (dados: DadosCadastroCliente) => void;
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
      const roboId = typeof record.roboId === "number" ? record.roboId : legacyRobot?.id;
      const categoria = record.categoria ?? record.category;
      const descricao = record.descricao ?? record.description;
      const publicadaEm = record.publicadaEm ?? new Date().toISOString();

      if (
        typeof record.id !== "number" ||
        typeof roboId !== "number" ||
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
  const [robos, setRobos] = useState<Robo[]>(robosMock);
  const [publicacoesLocais, setPublicacoesLocais] = useState<Publicacao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosMock);
  const [clientes, setClientes] = useState<Cliente[]>(clientesMock);

  useEffect(() => {
    setPublicacoesLocais(lerPublicacoesLocais());
  }, []);

  function cadastrarRobo(dados: DadosFormularioRobo) {
    const novoRobo: Robo = {
      ...dados,
      id: Date.now(),
      ultimaPublicacaoEm: new Date().toISOString(),
    };
    setRobos((atuais) => [...atuais, novoRobo]);
    return novoRobo;
  }

  function atualizarRobo(id: number, dados: DadosFormularioRobo) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const atualizado = { ...atual, ...dados };
    setRobos((atuais) => atuais.map((robo) => (robo.id === id ? atualizado : robo)));
    return atualizado;
  }

  function excluirRobo(id: number) {
    setRobos((atuais) => atuais.filter((robo) => robo.id !== id));
  }

  function publicarAlteracoes(id: number) {
    const atual = robos.find((robo) => robo.id === id);
    if (!atual) return null;

    const publicadaEm = new Date().toISOString();
    const atualizado = { ...atual, ultimaPublicacaoEm: publicadaEm };
    const publicacao: Publicacao = {
      id: Date.now(),
      categoria: "Atualização do Robô",
      roboId: id,
      descricao: atual.alteracaoRealizada.trim() || `Novas alterações foram publicadas para o robô ${atual.nome}.`,
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
    const cliente: Cliente = { id: Date.now(), nome: dados.nome.trim(), tenant: dados.tenant.trim() };
    setClientes((atuais) => [...atuais, cliente]);
  }

  const publicacoes = useMemo(
    () => [...publicacoesLocais, ...publicacoesMock],
    [publicacoesLocais],
  );

  const value: AppDataContextValue = {
    robos,
    publicacoes,
    usuarios,
    clientes,
    cadastrarRobo,
    atualizarRobo,
    excluirRobo,
    publicarAlteracoes,
    cadastrarUsuario,
    cadastrarCliente,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData deve ser usado dentro de AppDataProvider.");
  return context;
}
