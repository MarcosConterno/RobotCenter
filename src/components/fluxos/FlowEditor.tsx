"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { Bot, Box, FileText, GitBranch, History, Link2, Maximize2, Minimize2, Save, StickyNote, Type, Zap } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";

import type { EdgeFluxo, Fluxo, NodeFluxo, Robo, TipoNodeFluxo, ViewportFluxo } from "@/domain/entities";
import FlowCanvasNode, { type FlowCanvasNodeData } from "./FlowCanvasNode";

interface FlowEditorProps {
  fluxo: Fluxo;
  initialNodes: NodeFluxo[];
  initialEdges: EdgeFluxo[];
  robos: Robo[];
  editable: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (nodes: NodeFluxo[], edges: EdgeFluxo[], viewport: ViewportFluxo) => Promise<void>;
  onOpenRobot: (robotId: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenHistory: () => void;
}

const nodeTypes = { flowNode: FlowCanvasNode };
const palette = [
  { section: "Robôs", items: ["Orquestradora", "Job Pai", "Job Filho", "Executora", "Genérico"], kind: "robot" as const, icon: Bot },
  { section: "Gatilhos", items: ["Agendamento", "Evento", "Manual"], kind: "trigger" as const, icon: Zap },
  { section: "Sistemas", items: ["Kortex", "Legal One", "Redmine", "Banco de Dados", "API Externa"], kind: "system" as const, icon: Box },
  { section: "Conectores", items: ["Conexão"], kind: "text" as const, icon: Link2 },
  { section: "Anotações", items: ["Nota", "Texto", "Grupo", "Decisão"], kind: "note" as const, icon: StickyNote },
];

function toCanvasNodes(nodes: NodeFluxo[], robos: Robo[]): Node<FlowCanvasNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "flowNode",
    position: { x: node.posicaoX, y: node.posicaoY },
    data: {
      label: String(node.dados.label ?? "Elemento"),
      description: String(node.dados.description ?? ""),
      kind: node.tipo,
      robot: node.roboId ? robos.find((robot) => robot.id === node.roboId) : undefined,
      robotId: node.roboId,
      ...node.dados,
    },
  }));
}

function toCanvasEdges(edges: EdgeFluxo[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.nodeOrigemId,
    target: edge.nodeDestinoId,
    label: edge.rotulo,
    data: {
      tipo: edge.tipo,
      rotulo: edge.rotulo,
      condicao: edge.condicao,
      descricao: edge.descricao,
    },
    type: "smoothstep",
  }));
}

export default function FlowEditor(props: FlowEditorProps) {
  return <ReactFlowProvider><FlowEditorInner {...props} /></ReactFlowProvider>;
}

function FlowEditorInner({ fluxo, initialNodes, initialEdges, robos, editable, onDirtyChange, onSave, onOpenRobot, expanded, onToggleExpanded, onOpenHistory }: FlowEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const [nodes, setNodes] = useState<Node<FlowCanvasNodeData>[]>(() => toCanvasNodes(initialNodes, robos));
  const [edges, setEdges] = useState<Edge[]>(() => toCanvasEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);

  const markDirty = useCallback(() => onDirtyChange(true), [onDirtyChange]);
  const onNodesChange = useCallback((changes: NodeChange<Node<FlowCanvasNodeData>>[]) => {
    if (!editable) return;
    setNodes((current) => applyNodeChanges(changes, current));
    markDirty();
  }, [editable, markDirty]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!editable) return;
    setEdges((current) => applyEdgeChanges(changes, current));
    markDirty();
  }, [editable, markDirty]);
  const onConnect = useCallback((connection: Connection) => {
    if (!editable) return;
    setEdges((current) => addEdge({ ...connection, id: crypto.randomUUID(), type: "smoothstep", data: { tipo: "Gatilho", rotulo: "", condicao: "", descricao: "" } }, current));
    markDirty();
  }, [editable, markDirty]);

  function dragStart(event: DragEvent, kind: TipoNodeFluxo, label: string) {
    event.dataTransfer.setData("application/robot-center-flow", JSON.stringify({ kind, label }));
    event.dataTransfer.effectAllowed = "move";
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    if (!editable || !wrapperRef.current) return;
    const raw = event.dataTransfer.getData("application/robot-center-flow");
    if (!raw) return;
    const item = JSON.parse(raw) as { kind: TipoNodeFluxo; label: string };
    const kind = item.label === "Decisão" ? "decision" : item.label === "Texto" ? "text" : item.label === "Grupo" ? "group" : item.kind;
    const defaultRobot = kind === "robot" ? robos[0] : undefined;
    if (kind === "robot" && !defaultRobot) { setErro("Este cliente não possui robôs disponíveis."); return; }
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setNodes((current) => [...current, {
      id: crypto.randomUUID(), type: "flowNode", position,
      data: { label: defaultRobot?.nome ?? item.label, kind, robot: defaultRobot, robotId: defaultRobot?.id, description: "" },
    }]);
    markDirty();
  }

  function updateNode(patch: Partial<FlowCanvasNodeData>) {
    if (!selectedNodeId || !editable) return;
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node));
    markDirty();
  }

  function updateEdge(field: string, value: string) {
    if (!selectedEdgeId || !editable) return;
    setEdges((current) => current.map((edge) => edge.id === selectedEdgeId ? {
      ...edge, label: field === "rotulo" ? value : edge.label,
      data: { ...(edge.data ?? {}), [field]: value },
    } : edge));
    markDirty();
  }

  async function save() {
    setSalvando(true); setErro("");
    const mappedNodes: NodeFluxo[] = nodes.map((node) => ({
      id: node.id, fluxoId: fluxo.id, tipo: node.data.kind,
      roboId: (node.data.robotId as string | undefined) ?? node.data.robot?.id ?? null,
      posicaoX: node.position.x, posicaoY: node.position.y,
      dados: { label: node.data.label, description: node.data.description ?? "", subtype: node.data.subtype ?? null },
    }));
    const mappedEdges: EdgeFluxo[] = edges.map((edge) => ({
      id: edge.id, fluxoId: fluxo.id, nodeOrigemId: edge.source, nodeDestinoId: edge.target,
      tipo: String(edge.data?.tipo ?? "Gatilho"), rotulo: String(edge.data?.rotulo ?? edge.label ?? ""),
      condicao: String(edge.data?.condicao ?? ""), descricao: String(edge.data?.descricao ?? ""),
    }));
    const viewport = getViewport();
    try {
      await onSave(mappedNodes, mappedEdges, viewport);
      onDirtyChange(false);
    } catch { setErro("Não foi possível salvar as alterações."); }
    finally { setSalvando(false); }
  }

  const paletteGroups = useMemo(() => palette.map((group) => ({ ...group, items: group.items.map((label) => ({ label, kind: group.kind })) })), []);

  return (
    <div className={`flow-editor-shell${expanded ? " is-expanded" : ""}`}>
      <aside className="flow-elements-panel">
        <span className="flow-panel-title">ELEMENTOS</span>
        {paletteGroups.map((group) => <section key={group.section}><h3>{group.section}</h3>{group.items.map((item) => {
          const Icon = group.icon;
          return <button type="button" key={item.label} draggable={editable} disabled={!editable} onDragStart={(event) => dragStart(event, item.kind, item.label)}><Icon size={14} />{item.label}</button>;
        })}</section>)}
      </aside>

      <div className="flow-canvas" ref={wrapperRef} onDrop={drop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}>
        {erro && <div className="flow-canvas-error">{erro}</div>}
        <div className="flow-canvas-toolbar">
          {editable && <button type="button" disabled={salvando} onClick={() => void save()}><Save size={15} />{salvando ? "Salvando..." : "Salvar"}</button>}
          <button type="button" onClick={onToggleExpanded}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{expanded ? "Reduzir" : "Ampliar"}</button>
        </div>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} nodesDraggable={editable} nodesConnectable={editable} elementsSelectable
          defaultViewport={fluxo.viewport as Viewport} onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
          onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }} fitView={initialNodes.length > 0}
        >
          <Background color="var(--border)" gap={22} size={1} /><Controls /><MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <aside className="flow-properties-panel">
        <div className="flow-panel-heading"><span className="flow-panel-title">PROPRIEDADES</span><button type="button" onClick={onOpenHistory}><History size={13} /> Histórico</button></div>
        {selectedNode ? <NodeProperties node={selectedNode} robos={robos} editable={editable} updateNode={updateNode} onOpenRobot={onOpenRobot} />
          : selectedEdge ? <EdgeProperties edge={selectedEdge} editable={editable} updateEdge={updateEdge} />
          : <div className="flow-properties-empty"><Type size={24} /><p>Selecione um elemento ou uma conexão para ver suas propriedades.</p></div>}
      </aside>
    </div>
  );
}

function NodeProperties({ node, robos, editable, updateNode, onOpenRobot }: {
  node: Node<FlowCanvasNodeData>; robos: Robo[]; editable: boolean;
  updateNode: (patch: Partial<FlowCanvasNodeData>) => void; onOpenRobot: (id: string) => void;
}) {
  const robot = node.data.robot;
  return <div className="flow-properties-form">
    <label>Tipo<input value={node.data.kind} readOnly /></label>
    {node.data.kind === "robot" ? <>
      {editable && <label>Robô<select value={robot?.id ?? ""} onChange={(event) => { const selected = robos.find((item) => item.id === event.target.value); if (selected) updateNode({ robot: selected, robotId: selected.id, label: selected.nome }); }}>{robos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>}
      <label>Nome<input value={robot?.nome ?? ""} readOnly /></label><label>Descrição<textarea value={robot?.descricao ?? ""} readOnly /></label>
      <label>Ambiente<input value={robot?.ambiente ?? ""} readOnly /></label><label>Sistema<input value={robot?.sistema ?? ""} readOnly /></label><label>Status<input value={robot?.ativo ? "Ativo" : "Inativo"} readOnly /></label>
      {robot && <button className="flow-secondary-button" type="button" onClick={() => onOpenRobot(robot.id)}>Abrir robô</button>}
    </> : <>
      <label>Nome<input value={node.data.label} readOnly={!editable} onChange={(event) => updateNode({ label: event.target.value })} /></label>
      <label>Descrição<textarea value={node.data.description ?? ""} readOnly={!editable} onChange={(event) => updateNode({ description: event.target.value })} /></label>
    </>}
    <div className="flow-trigger-summary"><span>Gatilhos de entrada</span><span>Gatilhos de saída</span></div>
  </div>;
}

function EdgeProperties({ edge, editable, updateEdge }: { edge: Edge; editable: boolean; updateEdge: (field: string, value: string) => void }) {
  return <div className="flow-properties-form">
    <label>Origem<input value={edge.source} readOnly /></label><label>Destino<input value={edge.target} readOnly /></label>
    <label>Tipo<input value={String(edge.data?.tipo ?? "Gatilho")} readOnly={!editable} onChange={(event) => updateEdge("tipo", event.target.value)} /></label>
    <label>Rótulo<input value={String(edge.data?.rotulo ?? edge.label ?? "")} readOnly={!editable} onChange={(event) => updateEdge("rotulo", event.target.value)} /></label>
    <label>Condição<textarea value={String(edge.data?.condicao ?? "")} readOnly={!editable} onChange={(event) => updateEdge("condicao", event.target.value)} /></label>
    <label>Descrição<textarea value={String(edge.data?.descricao ?? "")} readOnly={!editable} onChange={(event) => updateEdge("descricao", event.target.value)} /></label>
  </div>;
}
