"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle, MinusCircle, Package, RefreshCw, Wifi, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Robo } from "@/domain/entities";

import styles from "./RobotVersionSyncDialog.module.css";

const CONNECTOR_URL = "http://127.0.0.1:47831";
type LoopbackRequestInit = RequestInit & { targetAddressSpace: "loopback" };

function fetchConnector(path: string, init: RequestInit = {}) {
  return fetch(`${CONNECTOR_URL}${path}`, { ...init, targetAddressSpace: "loopback" } as LoopbackRequestInit);
}

type ItemStatus = "pending" | "checking" | "updated" | "unchanged" | "error";
interface SyncItem {
  packageName: string;
  robotNames: string[];
  currentVersions: string[];
  foundVersion?: string;
  status: ItemStatus;
  message?: string;
}

interface RobotVersionSyncDialogProps {
  robots: Robo[];
  onClose: () => void;
  onComplete: () => void;
}

function initialItems(robots: Robo[]): SyncItem[] {
  const grouped = new Map<string, Robo[]>();
  robots.forEach((robot) => {
    const packageName = robot.pacote.trim();
    if (packageName) grouped.set(packageName, [...(grouped.get(packageName) ?? []), robot]);
  });
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([packageName, entries]) => ({
    packageName,
    robotNames: entries.map((robot) => robot.nome),
    currentVersions: [...new Set(entries.map((robot) => robot.versao))],
    status: "pending",
  }));
}

export default function RobotVersionSyncDialog({ robots, onClose, onComplete }: RobotVersionSyncDialogProps) {
  const startedRef = useRef(false);
  const [items, setItems] = useState(() => initialItems(robots));
  const [phase, setPhase] = useState<"connecting" | "running" | "completed" | "unavailable">("connecting");
  const [showErrors, setShowErrors] = useState(false);

  const processed = items.filter((item) => ["updated", "unchanged", "error"].includes(item.status)).length;
  const updated = items.filter((item) => item.status === "updated").length;
  const unchanged = items.filter((item) => item.status === "unchanged").length;
  const errors = items.filter((item) => item.status === "error").length;
  const percentage = items.length ? Math.round((processed / items.length) * 100) : 0;
  const currentItem = items.find((item) => item.status === "checking");
  const visibleItems = useMemo(() => showErrors ? items.filter((item) => item.status === "error") : items, [items, showErrors]);
  const busy = phase === "connecting" || phase === "running";

  function patchItem(packageName: string, patch: Partial<SyncItem>) {
    setItems((current) => current.map((item) => item.packageName === packageName ? { ...item, ...patch } : item));
  }

  async function applyVersion(packageName: string, version: string) {
    const response = await fetch("/api/admin/robot-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageName, version }),
    });
    const payload = await response.json() as { status?: "updated" | "unchanged"; error?: string };
    if (!response.ok || !payload.status) throw new Error(payload.error ?? "Não foi possível salvar a versão.");
    return payload.status;
  }

  async function run() {
    setPhase("connecting");
    setShowErrors(false);
    setItems(initialItems(robots));
    const packages = initialItems(robots).map((item) => item.packageName);
    if (!packages.length) {
      setPhase("completed");
      return;
    }
    try {
      const health = await fetchConnector("/health", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!health.ok) throw new Error("registry-unavailable");
      setPhase("running");
      const response = await fetchConnector("/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages }),
      });
      if (!response.ok || !response.body) throw new Error("connector-unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const result = JSON.parse(line) as { packageName: string; status: "checking" | "success" | "error"; version?: string };
          if (result.status === "checking") {
            patchItem(result.packageName, { status: "checking", message: "Consultando..." });
          } else if (result.status === "error" || !result.version) {
            patchItem(result.packageName, { status: "error", message: "Não foi possível consultar." });
          } else {
            try {
              const status = await applyVersion(result.packageName, result.version);
              patchItem(result.packageName, {
                status,
                foundVersion: result.version,
                message: status === "updated" ? "Atualizado" : "Já está atualizado",
              });
            } catch {
              patchItem(result.packageName, { status: "error", foundVersion: result.version, message: "Não foi possível salvar." });
            }
          }
        }
        if (done) break;
      }
      setPhase("completed");
      onComplete();
    } catch {
      setPhase("unavailable");
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, []);

  return <div className={styles.overlay} onMouseDown={() => { if (!busy) onClose(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="version-sync-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className={styles.header}>
        <div className={styles.headingIcon}><RefreshCw size={19} className={busy ? styles.spinning : undefined} /></div>
        <div className={styles.headingText}>
          <h2 id="version-sync-title">{phase === "completed" ? "Atualização concluída" : "Atualizando versões"}</h2>
          <p>Consultando os pacotes dos robôs no registry interno.</p>
        </div>
        <button type="button" className={styles.closeButton} disabled={busy} aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </header>

      {phase === "unavailable" ? <div className={styles.unavailable}>
        <span><AlertTriangle size={22} /></span>
        <h3>Não foi possível acessar o registry interno.</h3>
        <p>Verifique o acesso à rede corporativa ou à VPN e confirme que o conector local está iniciado.</p>
        <div className={styles.footerActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Fechar</button><button type="button" className={styles.primaryButton} onClick={() => void run()}><RefreshCw size={15} /> Tentar novamente</button></div>
      </div> : <>
        <div className={styles.connection}><Wifi size={14} /><span>Conexão com registry</span><strong>{phase === "connecting" ? "Validando..." : "Disponível"}</strong></div>
        <div className={styles.progressSection}>
          <div><span>{processed} de {items.length} pacotes verificados</span><strong>{percentage}%</strong></div>
          <div className={styles.progressTrack}><span style={{ width: `${percentage}%` }} /></div>
          {currentItem && <p>Próximo: <strong>{currentItem.packageName}</strong> · Consultando...</p>}
        </div>

        <div className={styles.list} aria-live="polite">
          {visibleItems.map((item) => <div className={styles.item} key={item.packageName}>
            <StatusIcon status={item.status} />
            <div className={styles.itemMain}>
              <strong><Package size={12} /> {item.packageName}</strong>
              <span>{item.robotNames.length} {item.robotNames.length === 1 ? "robô vinculado" : "robôs vinculados"}</span>
              <div className={styles.robotNames}>
                {item.robotNames.map((robotName, index) => <span key={`${robotName}-${index}`} title={robotName}>{robotName}</span>)}
              </div>
            </div>
            <div className={styles.versions}><span>Atual <strong>{item.currentVersions.join(", ")}</strong></span><span>Encontrada <strong>{item.foundVersion ?? "—"}</strong></span></div>
            <span className={`${styles.status} ${styles[item.status]}`}>{item.message ?? (item.status === "pending" ? "Aguardando" : "Consultando...")}</span>
          </div>)}
        </div>

        {phase === "completed" && <footer className={styles.summary}>
          <div><span><strong>{updated}</strong> atualizados</span><span><strong>{unchanged}</strong> sem alteração</span><span><strong>{errors}</strong> erros</span></div>
          <div className={styles.footerActions}>{errors > 0 && <button type="button" className={styles.secondaryButton} onClick={() => setShowErrors((current) => !current)}>{showErrors ? "Ver todos" : "Ver erros"}</button>}<button type="button" className={styles.primaryButton} onClick={onClose}>Fechar</button></div>
        </footer>}
      </>}
    </section>
  </div>;
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "updated") return <CheckCircle2 className={styles.successIcon} size={17} />;
  if (status === "unchanged") return <MinusCircle className={styles.neutralIcon} size={17} />;
  if (status === "error") return <AlertTriangle className={styles.errorIcon} size={17} />;
  if (status === "checking") return <LoaderCircle className={`${styles.neutralIcon} ${styles.spinning}`} size={17} />;
  return <span className={styles.pendingDot} />;
}
