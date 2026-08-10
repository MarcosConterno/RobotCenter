"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import AppShell from "@/components/layout/AppShell";
import { useAppData } from "@/data/AppDataProvider";
import { AMBIENTES_ROBO } from "@/domain/entities";
import type { RobotProductDefinition } from "@/domain/robot-products";

import RobotHeader from "./RobotHeader";
import RobotImportDialog from "./RobotImportDialog";
import RobotTable from "./RobotTable";
import RobotVersionSyncDialog from "./RobotVersionSyncDialog";

const TODAS_OPCOES = "Todos";
const ambientes = [TODAS_OPCOES, ...AMBIENTES_ROBO] as const;
const statusOptions = [TODAS_OPCOES, "Ativo", "Inativo"] as const;

export default function RobotProductListPage({ product }: { product: RobotProductDefinition }) {
  const router = useRouter();
  const { canManageRobots, isAdmin } = useAdminAccess();
  const { robos, clientes, importarRobos, recarregarDados } = useAppData();
  const productRobots = useMemo(() => robos.filter((robot) => robot.productType === product.productType), [product.productType, robos]);
  const [robotSelecionadoDoDashboard, setRobotSelecionadoDoDashboard] = useState<string | null>(null);
  const [robotParaEditarId, setRobotParaEditarId] = useState<string | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [clienteId, setClienteId] = useState(TODAS_OPCOES);
  const [pacote, setPacote] = useState(TODAS_OPCOES);
  const [sistema, setSistema] = useState(TODAS_OPCOES);
  const [ambiente, setAmbiente] = useState(TODAS_OPCOES);
  const [status, setStatus] = useState(TODAS_OPCOES);
  const [tribunal, setTribunal] = useState(TODAS_OPCOES);
  const [tribunalSystem, setTribunalSystem] = useState(TODAS_OPCOES);
  const [importOpen, setImportOpen] = useState(false);
  const [versionSyncOpen, setVersionSyncOpen] = useState(false);
  const dashboardSelectionAppliedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRobotSelecionadoDoDashboard(params.get("robot")?.trim() ?? null);
    setRobotParaEditarId(params.get("edit")?.trim() ?? null);
  }, []);

  const pacotes = useMemo(() => [TODAS_OPCOES, ...Array.from(new Set(productRobots.map((robot) => robot.pacote))).sort()], [productRobots]);
  const sistemas = useMemo(() => [TODAS_OPCOES, ...Array.from(new Set(productRobots.map((robot) => robot.sistema))).sort()], [productRobots]);
  const tribunais = useMemo(() => [TODAS_OPCOES, ...Array.from(new Set(productRobots.map((robot) => robot.tribunal).filter((value): value is string => Boolean(value)))).sort()], [productRobots]);
  const tribunalSystems = useMemo(() => [TODAS_OPCOES, ...Array.from(new Set(productRobots.map((robot) => robot.tribunalSystem).filter((value): value is string => Boolean(value)))).sort()], [productRobots]);

  const robotsFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLocaleLowerCase("pt-BR");
    return productRobots.filter((robot) => {
      const correspondePesquisa = !termo || [robot.nome, robot.courtName, robot.sistema, robot.pacote, robot.stack, robot.fila, robot.command, robot.tribunal, robot.tribunalSystem]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(termo));
      return correspondePesquisa
        && (pacote === TODAS_OPCOES || robot.pacote === pacote)
        && (clienteId === TODAS_OPCOES || robot.clienteId === clienteId)
        && (sistema === TODAS_OPCOES || robot.sistema === sistema)
        && (ambiente === TODAS_OPCOES || robot.ambiente === ambiente)
        && (tribunal === TODAS_OPCOES || robot.tribunal === tribunal)
        && (tribunalSystem === TODAS_OPCOES || robot.tribunalSystem === tribunalSystem)
        && (status === TODAS_OPCOES || (status === "Ativo" ? robot.ativo : !robot.ativo));
    });
  }, [ambiente, clienteId, pacote, pesquisa, productRobots, sistema, status, tribunal, tribunalSystem]);

  useEffect(() => {
    if (!robotSelecionadoDoDashboard || dashboardSelectionAppliedRef.current) return;
    const robot = robos.find((item) => item.nome.toLocaleLowerCase("pt-BR") === robotSelecionadoDoDashboard.toLocaleLowerCase("pt-BR"));
    if (robot) {
      router.replace(`/robos/${robot.id}`);
      dashboardSelectionAppliedRef.current = true;
    }
  }, [robos, robotSelecionadoDoDashboard, router]);

  useEffect(() => {
    if (!canManageRobots || !robotParaEditarId) return;
    const robot = robos.find((item) => item.id === robotParaEditarId);
    if (robot) router.replace(`/robos/${robot.id}/editar`);
  }, [canManageRobots, robos, robotParaEditarId, router]);

  function limparFiltros() {
    setPesquisa(""); setClienteId(TODAS_OPCOES); setPacote(TODAS_OPCOES); setSistema(TODAS_OPCOES);
    setAmbiente(TODAS_OPCOES); setStatus(TODAS_OPCOES); setTribunal(TODAS_OPCOES); setTribunalSystem(TODAS_OPCOES);
  }

  return <>
    <AppShell title={product.label}>
      <RobotHeader
        title={product.label} description={product.description}
        pesquisa={pesquisa} onPesquisaChange={setPesquisa}
        clienteId={clienteId} clientes={clientes.map((client) => ({ value: client.id, label: client.nome }))} onClienteChange={setClienteId}
        pacote={pacote} pacotes={pacotes} onPacoteChange={setPacote}
        sistema={sistema} sistemas={sistemas} onSistemaChange={setSistema}
        ambiente={ambiente} ambientes={ambientes} onAmbienteChange={setAmbiente}
        status={status} statusOptions={statusOptions} onStatusChange={setStatus}
        tribunal={product.requiresTribunal ? tribunal : undefined} tribunais={tribunais} onTribunalChange={setTribunal}
        tribunalSystem={product.requiresTribunal ? tribunalSystem : undefined} tribunalSystems={tribunalSystems} onTribunalSystemChange={setTribunalSystem}
        totalRobots={robotsFiltrados.length} onLimparFiltros={limparFiltros}
        onNovoRobot={() => router.push(`/robos/novo?product=${product.productType}`)} canCreate={canManageRobots}
        canImport={canManageRobots} onImport={() => setImportOpen(true)}
        canSyncVersions={isAdmin} onSyncVersions={() => setVersionSyncOpen(true)}
      />
      <div style={{ marginTop: 24 }}><RobotTable robots={robotsFiltrados} selectedRobot={null} onSelectRobot={(robot) => router.push(`/robos/${robot.id}`)} /></div>
    </AppShell>
    {canManageRobots && <RobotImportDialog open={importOpen} robos={productRobots} clientes={clientes} defaultProductType={product.productType} onClose={() => setImportOpen(false)} onImport={async (items) => { await importarRobos(items); }} />}
    {isAdmin && versionSyncOpen && <RobotVersionSyncDialog robots={productRobots} onClose={() => setVersionSyncOpen(false)} onComplete={recarregarDados} />}
  </>;
}
