"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import RobotHeader from "@/components/robos/RobotHeader";
import RobotImportDialog from "@/components/robos/RobotImportDialog";
import RobotTable from "@/components/robos/RobotTable";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import { AMBIENTES_ROBO } from "@/domain/entities";

const TODAS_OPCOES = "Todos";
const ambientes = [TODAS_OPCOES, ...AMBIENTES_ROBO] as const;
const statusOptions = [TODAS_OPCOES, "Ativo", "Inativo"] as const;

export default function RobosPage() {
  const router = useRouter();
  const { canManageRobots } = useAdminAccess();
  const { robos, clientes, importarRobos } = useAppData();
  const [robotSelecionadoDoDashboard, setRobotSelecionadoDoDashboard] = useState<string | null>(null);
  const [robotParaEditarId, setRobotParaEditarId] = useState<string | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [clienteId, setClienteId] = useState(TODAS_OPCOES);
  const [pacote, setPacote] = useState(TODAS_OPCOES);
  const [sistema, setSistema] = useState(TODAS_OPCOES);
  const [ambiente, setAmbiente] = useState(TODAS_OPCOES);
  const [status, setStatus] = useState(TODAS_OPCOES);
  const [importOpen, setImportOpen] = useState(false);
  const dashboardSelectionAppliedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRobotSelecionadoDoDashboard(params.get("robot")?.trim() ?? null);
    setRobotParaEditarId(params.get("edit")?.trim() ?? null);
  }, []);

  const pacotes = useMemo(
    () => [TODAS_OPCOES, ...Array.from(new Set(robos.map((robo) => robo.pacote))).sort()],
    [robos],
  );
  const sistemas = useMemo(
    () => [TODAS_OPCOES, ...Array.from(new Set(robos.map((robo) => robo.sistema))).sort()],
    [robos],
  );

  const robotsFiltrados = useMemo(() => {
    const termoPesquisa = pesquisa.trim().toLocaleLowerCase("pt-BR");

    return robos.filter((robo) => {
      const correspondePesquisa =
        !termoPesquisa ||
        [robo.nome, robo.sistema, robo.pacote, robo.stack, robo.fila].some((valor) =>
          valor.toLocaleLowerCase("pt-BR").includes(termoPesquisa),
        );
      const correspondePacote = pacote === TODAS_OPCOES || robo.pacote === pacote;
      const correspondeCliente = clienteId === TODAS_OPCOES || robo.clienteId === clienteId;
      const correspondeSistema = sistema === TODAS_OPCOES || robo.sistema === sistema;
      const correspondeAmbiente = ambiente === TODAS_OPCOES || robo.ambiente === ambiente;
      const correspondeStatus =
        status === TODAS_OPCOES ||
        (status === "Ativo" && robo.ativo) ||
        (status === "Inativo" && !robo.ativo);

      return correspondePesquisa && correspondeCliente && correspondePacote && correspondeSistema && correspondeAmbiente && correspondeStatus;
    });
  }, [ambiente, clienteId, pacote, pesquisa, robos, sistema, status]);

  useEffect(() => {
    if (!robotSelecionadoDoDashboard || dashboardSelectionAppliedRef.current) return;

    const robotEncontrado = robos.find(
      (robo) => robo.nome.toLocaleLowerCase("pt-BR") === robotSelecionadoDoDashboard.toLocaleLowerCase("pt-BR"),
    );

    if (robotEncontrado) {
      router.replace(`/robos/${robotEncontrado.id}`);
      dashboardSelectionAppliedRef.current = true;
    }
  }, [robos, robotSelecionadoDoDashboard, router]);

  useEffect(() => {
    if (!canManageRobots || !robotParaEditarId) return;
    const robotEncontrado = robos.find((robo) => robo.id === robotParaEditarId);
    if (!robotEncontrado) return;
    setRobotParaEditarId(null);
    router.replace(`/robos/${robotEncontrado.id}/editar`);
  }, [canManageRobots, robos, robotParaEditarId, router]);

  function fecharDetalhesAoFiltrar(action: () => void) {
    action();
  }

  function limparFiltros() {
    setPesquisa("");
    setClienteId(TODAS_OPCOES);
    setPacote(TODAS_OPCOES);
    setSistema(TODAS_OPCOES);
    setAmbiente(TODAS_OPCOES);
    setStatus(TODAS_OPCOES);
  }

  return (
    <>
      <AppShell title="Robôs">
        <RobotHeader
          pesquisa={pesquisa}
          onPesquisaChange={(value) => fecharDetalhesAoFiltrar(() => setPesquisa(value))}
          clienteId={clienteId}
          clientes={clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome }))}
          onClienteChange={(value) => fecharDetalhesAoFiltrar(() => setClienteId(value))}
          pacote={pacote}
          pacotes={pacotes}
          onPacoteChange={(value) => fecharDetalhesAoFiltrar(() => setPacote(value))}
          sistema={sistema}
          sistemas={sistemas}
          onSistemaChange={(value) => fecharDetalhesAoFiltrar(() => setSistema(value))}
          ambiente={ambiente}
          ambientes={ambientes}
          onAmbienteChange={(value) => fecharDetalhesAoFiltrar(() => setAmbiente(value))}
          status={status}
          statusOptions={statusOptions}
          onStatusChange={(value) => fecharDetalhesAoFiltrar(() => setStatus(value))}
          totalRobots={robotsFiltrados.length}
          onLimparFiltros={limparFiltros}
          onNovoRobot={() => router.push("/robos/novo")}
          canCreate={canManageRobots}
          canImport={canManageRobots}
          onImport={() => setImportOpen(true)}
        />

        <div style={{ marginTop: 24 }}>
          <RobotTable
            robots={robotsFiltrados}
            selectedRobot={null}
            onSelectRobot={(robo) => router.push(`/robos/${robo.id}`)}
          />
        </div>
      </AppShell>

      {canManageRobots && <RobotImportDialog
        open={importOpen}
        robos={robos}
        clientes={clientes}
        onClose={() => setImportOpen(false)}
        onImport={async (items) => {
          await importarRobos(items);
        }}
      />}
    </>
  );
}

