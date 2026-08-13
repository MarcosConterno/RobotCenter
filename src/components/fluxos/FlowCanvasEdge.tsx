"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, useViewport, type EdgeProps } from "@xyflow/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface FlowCanvasEdgeData extends Record<string, unknown> {
  tipo?: string;
  rotulo?: string;
  condicao?: string;
  fila?: string;
  descricao?: string;
  labelWidth?: number | null;
  labelHeight?: number | null;
  labelOffsetX?: number | null;
  labelOffsetY?: number | null;
  editable?: boolean;
  onLabelResize?: (width: number, height: number) => void;
  onLabelMove?: (offsetX: number, offsetY: number) => void;
  onSelect?: () => void;
}

const exportSafeEdgeStyle = {
  fill: "none",
  stroke: "#64748b",
  strokeWidth: 2.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function FlowCanvasEdge(props: EdgeProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const { zoom } = useViewport();
  const [, labelX, labelY] = getSmoothStepPath(props);
  const data = (props.data ?? {}) as FlowCanvasEdgeData;
  const labels = [data.tipo, data.condicao, data.fila ? `Fila: ${data.fila}` : ""].filter(Boolean);
  const [size, setSize] = useState({ width: data.labelWidth ?? 104, height: Math.max(data.labelHeight ?? 72, 64) });
  const [offset, setOffset] = useState({ x: data.labelOffsetX ?? 0, y: data.labelOffsetY ?? 0 });
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setSize({ width: data.labelWidth ?? 104, height: Math.max(data.labelHeight ?? 72, 64) });
  }, [data.labelHeight, data.labelWidth]);

  useEffect(() => {
    setOffset({ x: data.labelOffsetX ?? 0, y: data.labelOffsetY ?? 0 });
  }, [data.labelOffsetX, data.labelOffsetY]);

  function startMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!data.editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    data.onSelect?.();
    setMoving(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffset = { ...offset };
    let nextOffset = startOffset;
    const effectiveZoom = Math.max(zoom, 0.1);

    function move(pointerEvent: PointerEvent) {
      nextOffset = {
        x: startOffset.x + (pointerEvent.clientX - startX) / effectiveZoom,
        y: startOffset.y + (pointerEvent.clientY - startY) / effectiveZoom,
      };
      setOffset(nextOffset);
    }

    function finish() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      setMoving(false);
      data.onLabelMove?.(Math.round(nextOffset.x), Math.round(nextOffset.y));
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  function startResize(event: ReactPointerEvent<HTMLSpanElement>, horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1) {
    if (!data.editable) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = { ...size };
    let nextSize = startSize;
    const effectiveZoom = Math.max(zoom, 0.1);

    function move(pointerEvent: PointerEvent) {
      const deltaX = (pointerEvent.clientX - startX) / effectiveZoom;
      const deltaY = (pointerEvent.clientY - startY) / effectiveZoom;
      nextSize = {
        width: horizontal === 0 ? startSize.width : Math.min(360, Math.max(88, startSize.width + deltaX * horizontal)),
        height: vertical === 0 ? startSize.height : Math.min(320, Math.max(64, startSize.height + deltaY * vertical)),
      };
      setSize(nextSize);
    }

    function finish() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      data.onLabelResize?.(Math.round(nextSize.width), Math.round(nextSize.height));
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  const waypointX = labelX + offset.x;
  const waypointY = labelY + offset.y;

  function positionFacing(fromX: number, fromY: number, toX: number, toY: number) {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX > 0 ? Position.Right : Position.Left;
    return deltaY > 0 ? Position.Bottom : Position.Top;
  }

  const [sourcePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: waypointX,
    targetY: waypointY,
    targetPosition: positionFacing(waypointX, waypointY, props.sourceX, props.sourceY),
  });
  const [targetPath] = getSmoothStepPath({
    sourceX: waypointX,
    sourceY: waypointY,
    sourcePosition: positionFacing(waypointX, waypointY, props.targetX, props.targetY),
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <BaseEdge id={`${props.id}-source`} path={sourcePath} style={{ ...exportSafeEdgeStyle, ...props.style }} />
      <BaseEdge id={`${props.id}-target`} path={targetPath} markerEnd={props.markerEnd} style={{ ...exportSafeEdgeStyle, ...props.style }} />
      {labels.length ? (
        <EdgeLabelRenderer>
          <div
            ref={labelRef}
            className={`flow-edge-label nodrag nopan${props.selected ? " is-selected" : ""}${props.selected && data.editable ? " is-resizable" : ""}${moving ? " is-moving" : ""}`}
            style={{
              transform: `translate(-50%, -50%) translate(${waypointX}px, ${waypointY}px)`,
              width: `${size.width}px`,
              height: `${size.height}px`,
            }}
            onClick={() => data.onSelect?.()}
            onPointerDown={startMove}
          >
            {labels.map((label) => <span key={label}>{label}</span>)}
            {props.selected && data.editable ? <div className="flow-edge-resize-controls" aria-hidden="true">
              <span className="is-nw" onPointerDown={(event) => startResize(event, -1, -1)} />
              <span className="is-n" onPointerDown={(event) => startResize(event, 0, -1)} />
              <span className="is-ne" onPointerDown={(event) => startResize(event, 1, -1)} />
              <span className="is-e" onPointerDown={(event) => startResize(event, 1, 0)} />
              <span className="is-se" onPointerDown={(event) => startResize(event, 1, 1)} />
              <span className="is-s" onPointerDown={(event) => startResize(event, 0, 1)} />
              <span className="is-sw" onPointerDown={(event) => startResize(event, -1, 1)} />
              <span className="is-w" onPointerDown={(event) => startResize(event, -1, 0)} />
            </div> : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
