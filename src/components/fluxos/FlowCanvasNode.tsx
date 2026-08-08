"use client";

import { Bot, Box, FileText, GitBranch, StickyNote, Zap } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { Robo } from "@/domain/entities";

export interface FlowCanvasNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  kind: "robot" | "trigger" | "system" | "decision" | "note" | "text" | "group";
  robot?: Robo;
}

const icons = { robot: Bot, trigger: Zap, system: Box, decision: GitBranch, note: StickyNote, text: FileText, group: Box };

export default function FlowCanvasNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowCanvasNodeData;
  const Icon = icons[nodeData.kind] ?? Box;
  const robot = nodeData.robot;
  return (
    <div className={`flow-node flow-node--${nodeData.kind}${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-node__heading"><Icon size={14} /><span>{nodeData.kind === "robot" ? "ROBÔ" : nodeData.kind.toUpperCase()}</span></div>
      <strong>{robot?.nome ?? nodeData.label}</strong>
      {robot ? (
        <div className="flow-node__robot-meta"><span>{robot.ambiente}</span><span>{robot.courtName}</span><span>{robot.sistema}</span></div>
      ) : nodeData.description ? <p>{nodeData.description}</p> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
