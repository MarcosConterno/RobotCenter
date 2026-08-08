"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
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
import {
  AlignVerticalJustifyCenter,
  Bot,
  Box,
  Copy,
  GitBranch,
  History,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Save,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import type { EdgeFluxo, Fluxo, NodeFluxo, Robo, TipoNodeFluxo, ViewportFluxo } from "@/domain/entities";
import FlowCanvasEdge from "./FlowCanvasEdge";
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

type CanvasNode = Node<FlowCanvasNodeData>;
type PanelTab = "properties" | "history";
interface CanvasSnapshot { nodes: CanvasNode[]; edges: Edge[] }

const nodeTypes = { flowNode: FlowCanvasNode };
const edgeTypes = { flowEdge: FlowCanvasEdge };
const connectionTypes = ["Envia para", "Dispara", "Processa", "Gera Job", "Depende de", "Condição"] as const;
const palette = [
  { section: "Robôs", items: [{ label: "Robô", kind: "robot" as const, icon: Bot }] },
  { section: "Sistemas Externos", items: ["Kortex", "Consulta Processual", "Movimentos/Push", "Peticionamento"].map((label) => ({ label, kind: "system" as const, icon: Box })) },
  { section: "Estrutura", items: [
    { label: "Decisão", kind: "decision" as const, icon: GitBranch },
    { label: "Regra", kind: "decision" as const, icon: GitBranch },
    { label: "Grupo / Contexto", kind: "group" as const, icon: Box },
    { label: "Anotação", kind: "note" as const, icon: StickyNote },
  ] },
];

function cloneSnapshot(nodes: CanvasNode[], edges: Edge[]): CanvasSnapshot {
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

function toCanvasNodes(nodes: NodeFluxo[], robos: Robo[], editable: boolean): CanvasNode[] {
  const groupPositions = new Map(nodes.filter((node) => node.tipo === "group").map((node) => [node.id, { x: node.posicaoX, y: node.posicaoY }]));
  return [...nodes].sort((a, b) => Number(b.tipo === "group") - Number(a.tipo === "group")).map((node) => {
    const saved = node.dados as Partial<FlowCanvasNodeData>;
    const previousParent = typeof saved.parentId === "string" ? groupPositions.get(saved.parentId) : undefined;
    const isGroup = node.tipo === "group";
    const savedWidth = Number(saved.width ?? 0);
    const savedHeight = Number(saved.height ?? 0);
    const minimumHeight = node.tipo === "robot" || node.tipo === "system" ? 140 : node.tipo === "decision" || node.tipo === "trigger" ? 90 : 105;
    return {
      id: node.id,
      type: "flowNode",
      position: { x: node.posicaoX + (previousParent?.x ?? 0), y: node.posicaoY + (previousParent?.y ?? 0) },
      zIndex: isGroup ? 0 : 1,
      style: isGroup
        ? { width: savedWidth || 360, height: savedHeight || 240 }
        : savedWidth && savedHeight
          ? { width: Math.max(savedWidth, node.tipo === "decision" ? 150 : 175), height: Math.max(savedHeight, minimumHeight) }
          : { width: node.tipo === "decision" ? 150 : 175, height: minimumHeight },
      data: {
        ...saved,
        label: String(saved.label ?? "Elemento"),
        description: String(saved.description ?? ""),
        kind: node.tipo,
        robot: node.roboId ? robos.find((robot) => robot.id === node.roboId) : undefined,
        robotId: node.roboId,
        parentId: null,
        decisionMode: node.tipo === "decision"
          ? saved.decisionMode ?? (String(saved.label ?? "").toLowerCase().includes("decisão") ? "decision" : "rule")
          : undefined,
        editable,
      },
    };
  });
}

function toCanvasEdges(edges: EdgeFluxo[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.nodeOrigemId,
    target: edge.nodeDestinoId,
    data: { tipo: edge.tipo, rotulo: edge.rotulo, condicao: edge.condicao, fila: edge.fila, descricao: edge.descricao },
    type: "flowEdge",
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

export default function FlowEditor(props: FlowEditorProps) {
  return <ReactFlowProvider><FlowEditorInner {...props} /></ReactFlowProvider>;
}

function FlowEditorInner({ fluxo, initialNodes, initialEdges, robos, editable, onDirtyChange, onSave, onOpenRobot, expanded, onToggleExpanded, onOpenHistory }: FlowEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pastRef = useRef<CanvasSnapshot[]>([]);
  const futureRef = useRef<CanvasSnapshot[]>([]);
  const dragSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const clipboardRef = useRef<CanvasNode[]>([]);
  const { screenToFlowPosition, getViewport, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<CanvasNode[]>(() => toCanvasNodes(initialNodes, robos, editable));
  const [edges, setEdges] = useState<Edge[]>(() => toCanvasEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("properties");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [elementsCollapsed, setElementsCollapsed] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const markDirty = useCallback(() => onDirtyChange(true), [onDirtyChange]);

  useEffect(() => {
    setNodes((current) => {
      if (!current.some((node) => node.parentId)) return current;
      const positions = new Map(current.filter((node) => node.data.kind === "group").map((node) => [node.id, node.position]));
      return current.map((node) => {
        if (!node.parentId) return node;
        const parentPosition = positions.get(node.parentId);
        return {
          ...node,
          parentId: undefined,
          extent: undefined,
          expandParent: false,
          position: { x: node.position.x + (parentPosition?.x ?? 0), y: node.position.y + (parentPosition?.y ?? 0) },
          data: { ...node.data, parentId: null },
        };
      });
    });
  }, []);

  const remember = useCallback(() => {
    pastRef.current.push(cloneSnapshot(nodes, edges));
    if (pastRef.current.length > 60) pastRef.current.shift();
    futureRef.current = [];
  }, [edges, nodes]);

  const restore = useCallback((snapshot: CanvasSnapshot) => {
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    markDirty();
  }, [markDirty]);

  const undo = useCallback(() => {
    const snapshot = pastRef.current.pop();
    if (!snapshot || !editable) return;
    futureRef.current.push(cloneSnapshot(nodes, edges));
    restore(snapshot);
  }, [editable, edges, nodes, restore]);

  const redo = useCallback(() => {
    const snapshot = futureRef.current.pop();
    if (!snapshot || !editable) return;
    pastRef.current.push(cloneSnapshot(nodes, edges));
    restore(snapshot);
  }, [editable, edges, nodes, restore]);

  const deleteSelection = useCallback(() => {
    if (!editable) return;
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    if (selectedNodeId) selectedIds.add(selectedNodeId);
    const edgeIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));
    if (selectedEdgeId) edgeIds.add(selectedEdgeId);
    if (!selectedIds.size && !edgeIds.size) return;
    remember();
    setNodes((current) => current.filter((node) => !selectedIds.has(node.id) && !selectedIds.has(node.parentId ?? "")));
    setEdges((current) => current.filter((edge) => !edgeIds.has(edge.id) && !selectedIds.has(edge.source) && !selectedIds.has(edge.target)));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    markDirty();
  }, [editable, edges, markDirty, nodes, remember, selectedEdgeId, selectedNodeId]);

  const copySelection = useCallback(() => {
    const selected = nodes.filter((node) => node.selected || node.id === selectedNodeId);
    clipboardRef.current = structuredClone(selected);
  }, [nodes, selectedNodeId]);

  const pasteSelection = useCallback(() => {
    if (!editable || !clipboardRef.current.length) return;
    remember();
    const ids = new Map(clipboardRef.current.map((node) => [node.id, crypto.randomUUID()]));
    const copies = clipboardRef.current.map((node) => ({
      ...node,
      id: ids.get(node.id)!,
      parentId: node.parentId ? ids.get(node.parentId) : undefined,
      position: { x: node.position.x + 28, y: node.position.y + 28 },
      selected: true,
      data: { ...node.data, parentId: node.parentId ? ids.get(node.parentId) : undefined },
    }));
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...copies]);
    markDirty();
  }, [editable, markDirty, remember]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (command && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (command && event.key.toLowerCase() === "c") { event.preventDefault(); copySelection(); }
      else if (command && event.key.toLowerCase() === "v") { event.preventDefault(); pasteSelection(); }
      else if (command && event.key.toLowerCase() === "d") { event.preventDefault(); copySelection(); pasteSelection(); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelection(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelection, deleteSelection, pasteSelection, redo, undo]);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    if (!editable) return;
    setNodes((current) => applyNodeChanges(changes, current));
    const hasUserChange = changes.some((change) =>
      change.type === "add"
      || change.type === "remove"
      || change.type === "replace"
      || (change.type === "position" && change.dragging !== undefined)
      || (change.type === "dimensions" && change.resizing === true)
    );
    if (hasUserChange) markDirty();
  }, [editable, markDirty]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!editable) return;
    if (changes.some((change) => change.type === "remove")) remember();
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((change) => change.type !== "select")) markDirty();
  }, [editable, markDirty, remember]);

  const onConnect = useCallback((connection: Connection) => {
    if (!editable) return;
    remember();
    const id = crypto.randomUUID();
    setEdges((current) => addEdge({
      ...connection,
      id,
      type: "flowEdge",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { tipo: "Envia para", rotulo: "", condicao: "", fila: "", descricao: "" },
    }, current));
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
    setPanelTab("properties");
    markDirty();
  }, [editable, markDirty, remember]);

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
    const defaultRobot = item.kind === "robot" ? robos[0] : undefined;
    if (item.kind === "robot" && !defaultRobot) { setErro("Este cliente não possui robôs disponíveis."); return; }
    remember();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const isGroup = item.kind === "group";
    const minimumHeight = item.kind === "robot" || item.kind === "system" ? 140 : item.kind === "decision" ? 90 : 105;
    setNodes((current) => [...current, {
      id: crypto.randomUUID(),
      type: "flowNode",
      position,
      style: isGroup ? { width: 360, height: 240 } : { width: item.kind === "decision" ? 150 : 175, height: minimumHeight },
      zIndex: isGroup ? 0 : 1,
      data: {
        label: defaultRobot?.nome ?? item.label,
        kind: item.kind,
        robot: defaultRobot,
        robotId: defaultRobot?.id,
        description: item.kind === "decision" ? "Defina a condição" : "",
        decisionMode: item.kind === "decision" ? item.label === "Decisão" ? "decision" : "rule" : undefined,
        width: isGroup ? 360 : undefined,
        height: isGroup ? 240 : undefined,
        editable,
      },
    }]);
    markDirty();
  }

  function updateNode(patch: Partial<FlowCanvasNodeData>) {
    if (!selectedNodeId || !editable) return;
    remember();
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node));
    markDirty();
  }

  const updateNodeById = useCallback((nodeId: string, patch: Partial<FlowCanvasNodeData>) => {
    if (!editable) return;
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node));
    markDirty();
  }, [editable, markDirty]);

  function updateEdge(field: string, value: string) {
    if (!selectedEdgeId || !editable) return;
    remember();
    setEdges((current) => current.map((edge) => edge.id === selectedEdgeId ? { ...edge, data: { ...(edge.data ?? {}), [field]: value } } : edge));
    markDirty();
  }

  function organizeFlow() {
    if (!editable) return;
    remember();
    const movable = nodes.filter((node) => node.data.kind !== "group" && !node.parentId);
    const ids = new Set(movable.map((node) => node.id));
    const indegree = new Map(movable.map((node) => [node.id, 0]));
    edges.forEach((edge) => { if (ids.has(edge.source) && ids.has(edge.target)) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1); });
    const levels = new Map<string, number>();
    let queue = movable.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
    queue.forEach((id) => levels.set(id, 0));
    while (queue.length) {
      const next: string[] = [];
      queue.forEach((source) => edges.filter((edge) => edge.source === source && ids.has(edge.target)).forEach((edge) => {
        levels.set(edge.target, Math.max(levels.get(edge.target) ?? 0, (levels.get(source) ?? 0) + 1));
        indegree.set(edge.target, (indegree.get(edge.target) ?? 1) - 1);
        if (indegree.get(edge.target) === 0) next.push(edge.target);
      }));
      queue = next;
    }
    movable.forEach((node) => { if (!levels.has(node.id)) levels.set(node.id, 0); });
    const rows = new Map<number, string[]>();
    movable.forEach((node) => rows.set(levels.get(node.id) ?? 0, [...(rows.get(levels.get(node.id) ?? 0) ?? []), node.id]));
    const positions = new Map<string, { x: number; y: number }>();
    rows.forEach((row, level) => row.forEach((id, index) => positions.set(id, { x: (index - (row.length - 1) / 2) * 260, y: level * 190 })));
    setNodes((current) => current.map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node));
    markDirty();
  }

  function handleNodeDragStop(_: MouseEvent | TouchEvent) {
    if (!editable) return;
    if (dragSnapshotRef.current) {
      pastRef.current.push(dragSnapshotRef.current);
      futureRef.current = [];
      dragSnapshotRef.current = null;
    }
  }

  async function save() {
    setSalvando(true);
    setErro("");
    const mappedNodes: NodeFluxo[] = nodes.map((node) => ({
      id: node.id,
      fluxoId: fluxo.id,
      tipo: node.data.kind,
      roboId: node.data.robotId ?? node.data.robot?.id ?? null,
      posicaoX: node.position.x,
      posicaoY: node.position.y,
      dados: {
        label: node.data.label,
        description: node.data.description ?? "",
        observations: node.data.observations ?? "",
        decisionMode: node.data.kind === "decision"
          ? node.data.decisionMode ?? (node.data.label.toLowerCase().includes("decisão") ? "decision" : "rule")
          : null,
        parentId: null,
        width: node.measured?.width ?? node.style?.width ?? null,
        height: node.measured?.height ?? node.style?.height ?? null,
      },
    }));
    const mappedEdges: EdgeFluxo[] = edges.map((edge) => ({
      id: edge.id,
      fluxoId: fluxo.id,
      nodeOrigemId: edge.source,
      nodeDestinoId: edge.target,
      tipo: String(edge.data?.tipo ?? "Envia para"),
      rotulo: String(edge.data?.rotulo ?? ""),
      condicao: String(edge.data?.condicao ?? ""),
      fila: String(edge.data?.fila ?? ""),
      descricao: String(edge.data?.descricao ?? ""),
    }));
    try {
      await onSave(mappedNodes, mappedEdges, getViewport());
      onDirtyChange(false);
      pastRef.current = [];
      futureRef.current = [];
    } catch (error) {
      console.error("Falha ao salvar o fluxo", error);
      const detail = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Erro não identificado pelo Supabase.";
      setErro(`Não foi possível salvar as alterações. ${detail}`);
    } finally {
      setSalvando(false);
    }
  }

  const nodeNames = useMemo(() => new Map(nodes.map((node) => [node.id, node.data.robot?.nome ?? node.data.label])), [nodes]);
  const renderedNodes = useMemo(() => [...nodes]
    .sort((a, b) => Number(b.data.kind === "group") - Number(a.data.kind === "group"))
    .map((node) => ({
    ...node,
    data: {
      ...node.data,
      editable,
      editing: editingNodeId === node.id,
      robotOptions: robos,
      onInlineUpdate: (patch: Partial<FlowCanvasNodeData>) => updateNodeById(node.id, patch),
      onInlineFinish: () => setEditingNodeId(null),
    },
  })), [editable, editingNodeId, nodes, robos, updateNodeById]);

  function toggleElementsPanel() {
    setElementsCollapsed((current) => !current);
    window.requestAnimationFrame(() => void fitView({ padding: 0.16, duration: 220 }));
    window.setTimeout(() => void fitView({ padding: 0.16, duration: 180 }), 230);
  }

  return (
    <div className={`flow-editor-shell${expanded ? " is-expanded" : ""}${elementsCollapsed ? " has-collapsed-elements" : ""}`}>
      <aside className={`flow-elements-panel${elementsCollapsed ? " is-collapsed" : ""}`}>
        <div className="flow-elements-heading">
          <span className="flow-panel-title">ELEMENTOS</span>
          <button type="button" aria-label={elementsCollapsed ? "Expandir elementos" : "Recolher elementos"} title={elementsCollapsed ? "Expandir elementos" : "Recolher elementos"} onClick={toggleElementsPanel}>
            {elementsCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
        {palette.map((group) => <section key={group.section}><h3>{group.section}</h3>{group.items.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.label} title={item.label} draggable={editable} disabled={!editable} onDragStart={(event) => dragStart(event, item.kind, item.label)}><Icon size={14} /><span>{item.label}</span></button>;
        })}</section>)}
      </aside>

      <div className="flow-canvas" ref={wrapperRef} onDrop={drop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}>
        {erro ? <div className="flow-canvas-error">{erro}</div> : null}
        <div className="flow-canvas-toolbar">
          {editable ? <>
            <button type="button" title="Desfazer (Ctrl+Z)" onClick={undo}><Undo2 size={15} /></button>
            <button type="button" title="Refazer (Ctrl+Y)" onClick={redo}><Redo2 size={15} /></button>
            <button type="button" title="Duplicar (Ctrl+D)" onClick={() => { copySelection(); pasteSelection(); }}><Copy size={15} /></button>
            <button type="button" title="Excluir (Delete)" onClick={deleteSelection}><Trash2 size={15} /></button>
            <button type="button" onClick={organizeFlow}><AlignVerticalJustifyCenter size={15} />Organizar Fluxo</button>
            <button className="is-primary" type="button" disabled={salvando} onClick={() => void save()}><Save size={15} />{salvando ? "Salvando..." : "Salvar"}</button>
          </> : null}
          <button type="button" onClick={onToggleExpanded}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{expanded ? "Reduzir" : "Ampliar"}</button>
        </div>
        <ReactFlow
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={() => { dragSnapshotRef.current = cloneSnapshot(nodes, edges); }}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable={editable}
          nodesConnectable={editable}
          elementsSelectable
          selectionOnDrag
          panOnDrag={[1, 2]}
          multiSelectionKeyCode={["Control", "Meta", "Shift"]}
          deleteKeyCode={null}
          defaultViewport={fluxo.viewport as Viewport}
          onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setEditingNodeId(null); setPanelTab("properties"); }}
          onNodeDoubleClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
            setPanelTab("properties");
            if (editable && node.data.kind !== "system") { remember(); setEditingNodeId(node.id); }
          }}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); setPanelTab("properties"); }}
          onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
          fitView={initialNodes.length > 0}
        >
          <Background color="var(--border)" gap={22} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <aside className="flow-properties-panel">
        <div className="flow-panel-tabs" role="tablist" aria-label="Painel do fluxo">
          <button className={panelTab === "properties" ? "is-active" : ""} type="button" onClick={() => setPanelTab("properties")}>PROPRIEDADES</button>
          <button className={panelTab === "history" ? "is-active" : ""} type="button" onClick={() => { setPanelTab("history"); onOpenHistory(); }}><History size={12} />HISTÓRICO</button>
        </div>

        {selectedNode ? (
          <NodeProperties node={selectedNode} robos={robos} editable={editable} updateNode={updateNode} onOpenRobot={onOpenRobot} />
        ) : selectedEdge ? (
          <EdgeProperties edge={selectedEdge} nodeNames={nodeNames} editable={editable} updateEdge={updateEdge} />
        ) : (
          <div className="flow-properties-empty"><GitBranch size={24} /><p>Selecione um elemento ou uma conexão para ver suas propriedades.</p></div>
        )}
      </aside>
    </div>
  );
}

function NodeProperties({ node, robos, editable, updateNode, onOpenRobot }: {
  node: CanvasNode;
  robos: Robo[];
  editable: boolean;
  updateNode: (patch: Partial<FlowCanvasNodeData>) => void;
  onOpenRobot: (id: string) => void;
}) {
  const robot = node.data.robot;
  return <div className="flow-properties-form">
    <label>Tipo<input value={node.data.kind === "system" ? "Sistema Externo" : node.data.kind === "decision" ? "Decisão / Regra" : node.data.kind} readOnly /></label>
    {node.data.kind === "robot" ? <>
      {editable ? <label>Robô<select value={robot?.id ?? ""} onChange={(event) => { const selected = robos.find((item) => item.id === event.target.value); if (selected) updateNode({ robot: selected, robotId: selected.id, label: selected.nome }); }}>{robos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label> : null}
      <label>Nome<input value={robot?.nome ?? ""} readOnly /></label>
      <label>Descrição<textarea value={robot?.descricao ?? ""} readOnly /></label>
      <label>Sistema<input value={robot?.sistema ?? ""} readOnly /></label>
      <label>Stack<input value={robot?.stack ?? ""} readOnly /></label>
      <label>Ambiente<input value={robot?.ambiente ?? ""} readOnly /></label>
      <label>Status<input value={robot?.ativo ? "Ativo" : "Inativo"} readOnly /></label>
      <label>Agendamento<input value={robot?.disparo ?? "Não informado"} readOnly /></label>
      <label>Versão<input value={robot?.versao ?? ""} readOnly /></label>
      <label>Observações<textarea value={node.data.observations ?? ""} readOnly={!editable} onChange={(event) => updateNode({ observations: event.target.value })} /></label>
      {robot ? <button className="flow-secondary-button" type="button" onClick={() => onOpenRobot(robot.id)}>Abrir robô</button> : null}
    </> : <>
      <label>Nome<input value={node.data.label} readOnly={!editable} onChange={(event) => updateNode({ label: event.target.value })} /></label>
      <label>{node.data.kind === "decision" ? "Condição" : node.data.kind === "system" ? "Descrição / Regras" : "Descrição"}<textarea value={node.data.description ?? ""} readOnly={!editable} onChange={(event) => updateNode({ description: event.target.value })} /></label>
      <label>Observações<textarea value={node.data.observations ?? ""} readOnly={!editable} onChange={(event) => updateNode({ observations: event.target.value })} /></label>
    </>}
  </div>;
}

function EdgeProperties({ edge, nodeNames, editable, updateEdge }: { edge: Edge; nodeNames: Map<string, string>; editable: boolean; updateEdge: (field: string, value: string) => void }) {
  return <div className="flow-properties-form flow-edge-properties">
    <label>Origem<input value={nodeNames.get(edge.source) ?? edge.source} readOnly /></label>
    <label>Destino<input value={nodeNames.get(edge.target) ?? edge.target} readOnly /></label>
    <label>Tipo<select value={String(edge.data?.tipo ?? "Envia para")} disabled={!editable} onChange={(event) => updateEdge("tipo", event.target.value)}>{connectionTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
    <label>Condição opcional<input value={String(edge.data?.condicao ?? "")} readOnly={!editable} onChange={(event) => updateEdge("condicao", event.target.value)} /></label>
    <label>Fila opcional<input value={String(edge.data?.fila ?? "")} readOnly={!editable} onChange={(event) => updateEdge("fila", event.target.value)} /></label>
    <label>Descrição opcional<textarea value={String(edge.data?.descricao ?? "")} readOnly={!editable} onChange={(event) => updateEdge("descricao", event.target.value)} /></label>
  </div>;
}
