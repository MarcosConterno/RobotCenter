"use client";

import { ArrowLeft, Clock3, Eye, History, Pencil, Rocket, UserRound, X } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import FlowEditor from "@/components/fluxos/FlowEditor";
import AppShell from "@/components/layout/AppShell";
import { useAppData } from "@/data/AppDataProvider";
import { useFlowsData } from "@/data/FlowsDataProvider";
import type { EdgeFluxo, Fluxo, NodeFluxo, VersaoFluxo, ViewportFluxo } from "@/domain/entities";
import { formatarData } from "@/domain/formatters";

interface SnapshotFluxo {
  flow: { name: string; description: string; viewport: ViewportFluxo };
  nodes: NodeFluxo[];
  edges: EdgeFluxo[];
}

export default function FluxoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clientes, robos } = useAppData();
  const { canEditFlows } = useAdminAccess();
  const { carregarDetalhes, salvarFluxo, publicarFluxo } = useFlowsData();
  const [fluxo, setFluxo] = useState<Fluxo | null>(null);
  const [nodes, setNodes] = useState<NodeFluxo[]>([]);
  const [edges, setEdges] = useState<EdgeFluxo[]>([]);
  const [versoes, setVersoes] = useState<VersaoFluxo[]>([]);
  const [modo, setModo] = useState<"view" | "edit">("view");
  const [dirty, setDirty] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [versaoSelecionada, setVersaoSelecionada] = useState<number | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [editorExpandido, setEditorExpandido] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const detalhes = await carregarDetalhes(id);
      if (!detalhes) { setErro("Fluxo não encontrado ou acesso negado."); return; }
      setFluxo(detalhes.fluxo); setNodes(detalhes.nodes); setEdges(detalhes.edges); setVersoes(detalhes.versoes);
    } catch { setErro("Não foi possível abrir este fluxo."); }
    finally { setCarregando(false); }
  }, [carregarDetalhes, id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const cliente = clientes.find((item) => item.id === fluxo?.clienteId);
  const robosDoCliente = useMemo(() => robos.filter((robo) => robo.clienteId === fluxo?.clienteId), [fluxo?.clienteId, robos]);
  const historicoSelecionado = versaoSelecionada ? versoes.find((item) => item.versao === versaoSelecionada) : null;
  const snapshotSelecionado = historicoSelecionado?.snapshot as unknown as SnapshotFluxo | undefined;
  const nodesExibidos = snapshotSelecionado?.nodes ?? nodes;
  const edgesExibidos = snapshotSelecionado?.edges ?? edges;
  const fluxoExibido = fluxo && snapshotSelecionado ? { ...fluxo, nome: snapshotSelecionado.flow.name, descricao: snapshotSelecionado.flow.description, viewport: snapshotSelecionado.flow.viewport } : fluxo;

  async function handleSave(savedNodes: NodeFluxo[], savedEdges: EdgeFluxo[], viewport: ViewportFluxo) {
    if (!fluxo) return;
    await salvarFluxo(fluxo, savedNodes, savedEdges, viewport);
    setNodes(savedNodes); setEdges(savedEdges); setFluxo({ ...fluxo, viewport, atualizadoEm: new Date().toISOString() });
  }

  async function publicar() {
    if (!fluxo || dirty) return;
    setPublicando(true); setErro("");
    const snapshot: SnapshotFluxo = { flow: { name: fluxo.nome, description: fluxo.descricao, viewport: fluxo.viewport }, nodes, edges };
    try {
      await publicarFluxo(fluxo.id, snapshot as unknown as Record<string, unknown>);
      await carregar();
    } catch (error) {
      console.error("Falha ao publicar a versão do fluxo", error);
      const detail = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Erro não identificado pelo Supabase.";
      setErro(`Não foi possível publicar a nova versão. ${detail}`);
    }
    finally { setPublicando(false); }
  }

  if (carregando) return <AppShell title="Fluxos"><div className="flow-message">Carregando fluxo...</div></AppShell>;
  if (!fluxoExibido) return <AppShell title="Fluxos"><div className="flow-message is-error">{erro || "Acesso negado."}</div></AppShell>;

  const isHistorical = Boolean(historicoSelecionado);
  return (
    <AppShell title="Fluxos">
      <section className="flow-detail-page">
        <header className="flow-detail-header">
          <div className="flow-detail-header__copy">
            <div className="flow-breadcrumb"><Link href="/fluxos"><ArrowLeft size={14} /> Fluxos</Link><span>/</span><span>{cliente?.nome ?? "Cliente"}</span><span>/</span><strong>{fluxoExibido.nome}</strong></div>
            <h1>{fluxoExibido.nome}</h1><p>{fluxoExibido.descricao}</p>
            <div className="flow-detail-meta">
              <span className={`flow-status is-${fluxo.status}`}>{isHistorical ? "Histórico" : fluxo.status === "publicado" ? "Publicado" : "Rascunho"}</span>
              <span><Clock3 size={14} /> Última atualização {formatarData(fluxo.atualizadoEm)}</span>
              <span><UserRound size={14} /> Responsável {fluxo.criadorNome || "Usuário"}</span>
            </div>
          </div>
          <div className="flow-detail-actions">
            <div className="flow-mode-toggle"><button className={modo === "view" ? "is-active" : ""} type="button" onClick={() => setModo("view")}><Eye size={14} /> Visualizar</button>{canEditFlows && !isHistorical && <button className={modo === "edit" ? "is-active" : ""} type="button" onClick={() => setModo("edit")}><Pencil size={14} /> Editar</button>}</div>
            {canEditFlows && !isHistorical && <button className="flow-primary-button" type="button" disabled={dirty || publicando} title={dirty ? "Salve as alterações antes de publicar." : undefined} onClick={() => void publicar()}><Rocket size={15} />{publicando ? "Publicando..." : "Publicar versão"}</button>}
          </div>
        </header>

        {dirty && <div className="flow-unpublished-warning">Existem alterações não publicadas. Salve antes de publicar uma nova versão.</div>}
        {erro && <div className="flow-message is-error">{erro}</div>}

        <div className="flow-workspace-main">
          <FlowEditor key={`${versaoSelecionada ?? "current"}-${modo}`} fluxo={fluxoExibido} initialNodes={nodesExibidos} initialEdges={edgesExibidos} robos={robosDoCliente} editable={canEditFlows && modo === "edit" && !isHistorical} onDirtyChange={setDirty} onSave={handleSave} onOpenRobot={() => window.location.assign("/robos")} expanded={editorExpandido} onToggleExpanded={() => setEditorExpandido((current) => !current)} onOpenHistory={() => setHistoricoAberto(true)} />
        </div>

        {historicoAberto && <div className="flow-history-backdrop" onMouseDown={() => setHistoricoAberto(false)}><aside className="flow-history-panel is-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="flow-history-title"><span><History size={15} /> HISTÓRICO</span><button type="button" aria-label="Fechar histórico" onClick={() => setHistoricoAberto(false)}><X size={16} /></button></div><button className={!versaoSelecionada ? "is-current" : ""} type="button" onClick={() => { setVersaoSelecionada(null); setHistoricoAberto(false); }}><strong>v{fluxo.versao} Atual</strong><span>{formatarData(fluxo.atualizadoEm)}</span></button>{versoes.map((version) => <button className={versaoSelecionada === version.versao ? "is-current" : ""} type="button" key={version.id} onClick={() => { setVersaoSelecionada(version.versao); setModo("view"); setDirty(false); setHistoricoAberto(false); }}><strong>v{version.versao}</strong><span>{formatarData(version.criadoEm)}</span></button>)}</aside></div>}
      </section>
    </AppShell>
  );
}
