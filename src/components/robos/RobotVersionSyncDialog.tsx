"use client";

import { AlertTriangle, CheckCircle2, Cloud, LoaderCircle, MinusCircle, Package, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Robo } from "@/domain/entities";

import styles from "./RobotVersionSyncDialog.module.css";

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

  async function syncPackage(packageName: string) {
    const response = await fetch("/api/admin/robot-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageName }),
    });
    const payload = await response.json() as { status?: "updated" | "unchanged"; version?: string; error?: string };
    if (!response.ok || !payload.status || !payload.version) throw new Error(payload.error ?? "Não foi possível sincronizar a versão.");
    return { status: payload.status, version: payload.version };
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
      setPhase("running");
      for (const packageName of packages) {
        patchItem(packageName, { status: "checking", message: "Consultando o Notion..." });
        try {
          const result = await syncPackage(packageName);
          patchItem(packageName, {
            status: result.status,
            foundVersion: result.version,
            message: result.status === "updated" ? "Atualizado" : "Já está atualizado",
          });
        } catch (error) {
          patchItem(packageName, { status: "error", message: error instanceof Error ? error.message : "Não foi possível consultar o Notion." });
        }
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
          <p>Lendo no Notion a versão correspondente de cada pacote.</p>
        </div>
        <button type="button" className={styles.closeButton} disabled={busy} aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </header>

      {phase === "unavailable" ? <div className={styles.unavailable}>
        <span><AlertTriangle size={22} /></span>
        <h3>Não foi possível concluir a consulta ao Notion.</h3>
        <p>Verifique a conexão e as variáveis da integração configuradas no servidor.</p>
        <div className={styles.footerActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Fechar</button><button type="button" className={styles.primaryButton} onClick={() => void run()}><RefreshCw size={15} /> Tentar novamente</button></div>
      </div> : <>
        <div className={styles.connection}><Cloud size={14} /><span>Conexão com Notion</span><strong>{phase === "connecting" ? "Preparando..." : "Disponível"}</strong></div>
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
