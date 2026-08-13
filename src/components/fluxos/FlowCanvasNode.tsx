"use client";

import { Bot, Box, FileText, GitBranch, StickyNote } from "lucide-react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

import type { Robo, TipoNodeFluxo } from "@/domain/entities";

export interface FlowCanvasNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  kind: TipoNodeFluxo;
  robot?: Robo;
  robotId?: string | null;
  observations?: string;
  decisionMode?: "rule" | "decision";
  parentId?: string | null;
  width?: number;
  height?: number;
  editable?: boolean;
  editing?: boolean;
  robotOptions?: Robo[];
  onInlineUpdate?: (patch: Partial<FlowCanvasNodeData>) => void;
  onInlineFinish?: () => void;
}

const icons = {
  robot: Bot,
  trigger: GitBranch,
  system: Box,
  decision: GitBranch,
  note: StickyNote,
  text: FileText,
  group: Box,
};

const kindLabels: Record<TipoNodeFluxo, string> = {
  robot: "ROBÔ",
  trigger: "REGRA",
  system: "SISTEMA EXTERNO",
  decision: "DECISÃO / REGRA",
  note: "ANOTAÇÃO",
  text: "ANOTAÇÃO",
  group: "CONTEXTO",
};

export default function FlowCanvasNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowCanvasNodeData;
  const Icon = icons[nodeData.kind] ?? Box;
  const robot = nodeData.robot;
  const isGroup = nodeData.kind === "group";
  const isDecision = nodeData.kind === "decision" || nodeData.kind === "trigger";
  const decisionMode = nodeData.decisionMode ?? (nodeData.label.toLowerCase().includes("decisão") ? "decision" : "rule");
  const isDiamond = isDecision && decisionMode === "decision";
  const canResize = Boolean(selected && nodeData.editable);
  const minimumHeight = nodeData.kind === "robot" || nodeData.kind === "system" ? 140 : isDecision ? 90 : 105;
  const inlineEditor = nodeData.editing ? (
    <div
      className={`flow-node__inline-editor flow-node__inline-editor--${nodeData.kind} nodrag nowheel`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {nodeData.kind === "robot" ? (
        <select aria-label="Robô do elemento" value={robot?.id ?? ""} onChange={(event) => {
          const selectedRobot = nodeData.robotOptions?.find((item) => item.id === event.target.value);
          if (selectedRobot) nodeData.onInlineUpdate?.({ robot: selectedRobot, robotId: selectedRobot.id, label: selectedRobot.nome });
        }}>
          {nodeData.robotOptions?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      ) : nodeData.kind === "system" ? (
        <textarea
          aria-label="Descrição e regras do sistema externo"
          placeholder="Descreva regras, operações e contexto deste sistema..."
          value={nodeData.description ?? ""}
          onChange={(event) => nodeData.onInlineUpdate?.({ description: event.target.value })}
        />
      ) : <>
        <input aria-label="Nome do elemento" value={nodeData.label} onChange={(event) => nodeData.onInlineUpdate?.({ label: event.target.value })} />
        <textarea
          aria-label={isDecision ? "Condição" : "Descrição do elemento"}
          value={nodeData.description ?? ""}
          onChange={(event) => nodeData.onInlineUpdate?.({ description: event.target.value })}
        />
      </>}
      <button type="button" onClick={() => nodeData.onInlineFinish?.()}>Concluir</button>
    </div>
  ) : null;

  if (isGroup) {
    return (
      <div className={`flow-node flow-node--group${selected ? " is-selected" : ""}`}>
        <NodeResizer
          color="var(--accent)"
          isVisible={canResize}
          minWidth={280}
          minHeight={180}
        />
        <div className="flow-node__heading"><Icon size={13} /><span>{kindLabels.group}</span></div>
        {inlineEditor ?? <strong>{nodeData.label}</strong>}
      </div>
    );
  }

  return (
    <div className={`flow-node flow-node--${nodeData.kind}${isDiamond ? " is-diamond" : ""}${selected ? " is-selected" : ""}`}>
      <NodeResizer
        color="var(--accent)"
        isVisible={canResize}
        minWidth={isDecision ? 150 : 175}
        minHeight={minimumHeight}
      />
      <Handle className="flow-node__handle flow-node__handle--top" type="target" position={Position.Top} />
      <Handle id="target-left" className="flow-node__handle flow-node__handle--left" type="target" position={Position.Left} />
      <div className="flow-node__content">
      <div className="flow-node__heading"><Icon size={14} /><span>{isDecision ? decisionMode === "decision" ? "DECISÃO" : "REGRA" : kindLabels[nodeData.kind]}</span></div>
      {inlineEditor ?? <>
        <strong>{robot?.nome ?? nodeData.label}</strong>
        {robot ? (
          <>
            {robot.descricao ? <p>{robot.descricao}</p> : null}
            <div className="flow-node__robot-meta">
              {robot.kortex ? <span className="is-kortex">Kortex</span> : null}
              <span title={robot.stack}>Stack: {robot.stack || "Não informado"}</span>
              <span title={robot.command}>Command: {robot.command || "Não informado"}</span>
              <span title={robot.pacote}>Pacote: {robot.pacote || "Não informado"}</span>
              <span className={robot.ativo ? "is-active" : ""}>{robot.ambiente}</span>
            </div>
          </>
        ) : isDecision ? (
          <div className="flow-node__condition">{nodeData.description || "Defina a condição"}</div>
        ) : (
          <>
            {nodeData.description ? <p className="flow-node__description">{nodeData.description}</p> : null}
          </>
        )}
      </>}
      </div>

      <Handle className="flow-node__handle flow-node__handle--bottom" type="source" position={Position.Bottom} />
      <Handle id="source-right" className="flow-node__handle flow-node__handle--right" type="source" position={Position.Right} />
    </div>
  );
}
