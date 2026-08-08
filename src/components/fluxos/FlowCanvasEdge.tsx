"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export interface FlowCanvasEdgeData extends Record<string, unknown> {
  tipo?: string;
  rotulo?: string;
  condicao?: string;
  fila?: string;
  descricao?: string;
}

export default function FlowCanvasEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const data = (props.data ?? {}) as FlowCanvasEdgeData;
  const labels = [data.tipo, data.condicao, data.fila ? `Fila: ${data.fila}` : ""].filter(Boolean);

  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      {labels.length ? (
        <EdgeLabelRenderer>
          <div
            className={`flow-edge-label${props.selected ? " is-selected" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {labels.map((label) => <span key={label}>{label}</span>)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
