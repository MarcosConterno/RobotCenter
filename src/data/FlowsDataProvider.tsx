"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  DadosNovoFluxo,
  EdgeFluxo,
  Fluxo,
  NodeFluxo,
  VersaoFluxo,
  ViewportFluxo,
} from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";

interface DetalhesFluxo {
  fluxo: Fluxo;
  nodes: NodeFluxo[];
  edges: EdgeFluxo[];
  versoes: VersaoFluxo[];
}

interface FlowsDataContextValue {
  fluxos: Fluxo[];
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
  carregarDetalhes: (id: string) => Promise<DetalhesFluxo | null>;
  criarFluxo: (dados: DadosNovoFluxo) => Promise<Fluxo>;
  salvarFluxo: (fluxo: Fluxo, nodes: NodeFluxo[], edges: EdgeFluxo[], viewport: ViewportFluxo) => Promise<void>;
  publicarFluxo: (id: string, snapshot: Record<string, unknown>) => Promise<number>;
  excluirFluxo: (id: string) => Promise<void>;
}

const FlowsDataContext = createContext<FlowsDataContextValue | null>(null);

function mapearFluxo(item: {
  id: string; client_id: string; name: string; description: string; version: number;
  status: string; viewport: Json; created_by: string; created_at: string; updated_at: string;
}, counts: { robots?: number; edges?: number } = {}): Fluxo {
  const viewport = item.viewport as unknown as Partial<ViewportFluxo>;
  return {
    id: item.id,
    clienteId: item.client_id,
    nome: item.name,
    descricao: item.description,
    versao: item.version,
    status: item.status as Fluxo["status"],
    viewport: {
      x: Number(viewport.x ?? 0),
      y: Number(viewport.y ?? 0),
      zoom: Number(viewport.zoom ?? 1),
    },
    criadoPor: item.created_by,
    criadorNome: "",
    criadoEm: item.created_at,
    atualizadoEm: item.updated_at,
    quantidadeRobos: counts.robots ?? 0,
    quantidadeConexoes: counts.edges ?? 0,
  };
}

export function FlowsDataProvider({ children }: { children: ReactNode }) {
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const supabase = createClient();
    const [flowsResult, nodesResult, edgesResult] = await Promise.all([
      supabase.from("flows").select("id,client_id,name,description,version,status,viewport,created_by,created_at,updated_at").order("updated_at", { ascending: false }),
      supabase.from("flow_nodes").select("flow_id,type"),
      supabase.from("flow_edges").select("flow_id"),
    ]);
    if (flowsResult.error || nodesResult.error || edgesResult.error) {
      setErro("Não foi possível carregar os fluxos.");
      setCarregando(false);
      return;
    }
    setFluxos((flowsResult.data ?? []).map((flow) => mapearFluxo(flow, {
      robots: (nodesResult.data ?? []).filter((node) => node.flow_id === flow.id && node.type === "robot").length,
      edges: (edgesResult.data ?? []).filter((edge) => edge.flow_id === flow.id).length,
    })));
    setCarregando(false);
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const carregarDetalhes = useCallback(async (id: string) => {
    const supabase = createClient();
    const [flowResult, nodesResult, edgesResult, versionsResult, creatorResult] = await Promise.all([
      supabase.from("flows").select("id,client_id,name,description,version,status,viewport,created_by,created_at,updated_at").eq("id", id).maybeSingle(),
      supabase.from("flow_nodes").select("id,flow_id,type,robot_id,position_x,position_y,data").eq("flow_id", id),
      supabase.from("flow_edges").select("id,flow_id,source_node_id,target_node_id,type,label,condition,queue,description,label_width,label_height").eq("flow_id", id),
      supabase.from("flow_versions").select("id,flow_id,version,snapshot,created_by,created_at").eq("flow_id", id).order("version", { ascending: false }),
      supabase.rpc("get_flow_creator_name", { target_flow_id: id }),
    ]);
    const error = flowResult.error ?? nodesResult.error ?? edgesResult.error ?? versionsResult.error;
    if (error) throw error;
    if (!flowResult.data) return null;
    return {
      fluxo: { ...mapearFluxo(flowResult.data), criadorNome: creatorResult.data ?? "" },
      nodes: (nodesResult.data ?? []).map((node) => ({
        id: node.id, fluxoId: node.flow_id, tipo: node.type as NodeFluxo["tipo"], roboId: node.robot_id,
        posicaoX: node.position_x, posicaoY: node.position_y, dados: node.data as Record<string, unknown>,
      })),
      edges: (edgesResult.data ?? []).map((edge) => ({
        id: edge.id, fluxoId: edge.flow_id, nodeOrigemId: edge.source_node_id,
        nodeDestinoId: edge.target_node_id, tipo: edge.type, rotulo: edge.label,
        condicao: edge.condition, fila: edge.queue, descricao: edge.description,
        rotuloLargura: edge.label_width, rotuloAltura: edge.label_height,
      })),
      versoes: (versionsResult.data ?? []).map((version) => ({
        id: version.id, fluxoId: version.flow_id, versao: version.version,
        snapshot: version.snapshot as Record<string, unknown>, criadoPor: version.created_by, criadoEm: version.created_at,
      })),
    };
  }, []);

  const criarFluxo = useCallback(async (dados: DadosNovoFluxo) => {
    const { data, error } = await createClient().from("flows").insert({
      client_id: dados.clienteId,
      name: dados.nome.trim(),
      description: dados.descricao.trim(),
    }).select("id,client_id,name,description,version,status,viewport,created_by,created_at,updated_at").single();
    if (error) throw error;
    const fluxo = mapearFluxo(data);
    setFluxos((atuais) => [fluxo, ...atuais]);
    return fluxo;
  }, []);

  const salvarFluxo = useCallback(async (
    fluxo: Fluxo,
    nodes: NodeFluxo[],
    edges: EdgeFluxo[],
    viewport: ViewportFluxo,
  ) => {
    const supabase = createClient();
    const { error: flowError } = await supabase.from("flows").update({
      name: fluxo.nome.trim(), description: fluxo.descricao.trim(), viewport: viewport as unknown as Json,
    }).eq("id", fluxo.id);
    if (flowError) throw flowError;

    if (nodes.length) {
      const { error } = await supabase.from("flow_nodes").upsert(nodes.map((node) => ({
        id: node.id, flow_id: fluxo.id, type: node.tipo, robot_id: node.roboId,
        position_x: node.posicaoX, position_y: node.posicaoY, data: node.dados as Json,
      })));
      if (error) throw error;
    }

    const { data: currentEdges, error: currentEdgesError } = await supabase.from("flow_edges").select("id").eq("flow_id", fluxo.id);
    if (currentEdgesError) throw currentEdgesError;
    const edgeIds = new Set(edges.map((edge) => edge.id));
    const removedEdgeIds = (currentEdges ?? []).filter((edge) => !edgeIds.has(edge.id)).map((edge) => edge.id);
    if (removedEdgeIds.length) {
      const { error } = await supabase.from("flow_edges").delete().in("id", removedEdgeIds);
      if (error) throw error;
    }
    if (edges.length) {
      const { error } = await supabase.from("flow_edges").upsert(edges.map((edge) => ({
        id: edge.id, flow_id: fluxo.id, source_node_id: edge.nodeOrigemId,
        target_node_id: edge.nodeDestinoId, type: edge.tipo, label: edge.rotulo,
        condition: edge.condicao, queue: edge.fila, description: edge.descricao,
        label_width: edge.rotuloLargura, label_height: edge.rotuloAltura,
      })));
      if (error) throw error;
    }

    const { data: currentNodes, error: currentNodesError } = await supabase.from("flow_nodes").select("id").eq("flow_id", fluxo.id);
    if (currentNodesError) throw currentNodesError;
    const nodeIds = new Set(nodes.map((node) => node.id));
    const removedNodeIds = (currentNodes ?? []).filter((node) => !nodeIds.has(node.id)).map((node) => node.id);
    if (removedNodeIds.length) {
      const { error } = await supabase.from("flow_nodes").delete().in("id", removedNodeIds);
      if (error) throw error;
    }
    await recarregar();
  }, [recarregar]);

  const publicarFluxo = useCallback(async (id: string, snapshot: Record<string, unknown>) => {
    const { data, error } = await createClient().rpc("publish_flow", {
      target_flow_id: id,
      target_snapshot: snapshot as Json,
    });
    if (error) throw error;
    await recarregar();
    return data;
  }, [recarregar]);

  const excluirFluxo = useCallback(async (id: string) => {
    const { error } = await createClient().from("flows").delete().eq("id", id);
    if (error) throw error;
    setFluxos((atuais) => atuais.filter((fluxo) => fluxo.id !== id));
  }, []);

  const value = useMemo(() => ({
    fluxos, carregando, erro, recarregar, carregarDetalhes, criarFluxo, salvarFluxo, publicarFluxo, excluirFluxo,
  }), [carregarDetalhes, carregando, criarFluxo, erro, excluirFluxo, fluxos, publicarFluxo, recarregar, salvarFluxo]);

  return <FlowsDataContext.Provider value={value}>{children}</FlowsDataContext.Provider>;
}

export function useFlowsData() {
  const context = useContext(FlowsDataContext);
  if (!context) throw new Error("useFlowsData deve ser usado dentro de FlowsDataProvider.");
  return context;
}
