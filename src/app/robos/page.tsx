"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import RobotDetails from "@/components/robos/RobotDetails";
import RobotDrawer from "@/components/robos/RobotDrawer";
import RobotForm from "@/components/robos/RobotForm";
import RobotHeader from "@/components/robos/RobotHeader";
import RobotImportDialog from "@/components/robos/RobotImportDialog";
import RobotTable from "@/components/robos/RobotTable";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import { AMBIENTES_ROBO, type DadosFormularioRobo, type Robo } from "@/domain/entities";

const TODAS_OPCOES = "Todos";
const ambientes = [TODAS_OPCOES, ...AMBIENTES_ROBO] as const;
const statusOptions = [TODAS_OPCOES, "Ativo", "Inativo"] as const;
type DrawerMode = "create" | "edit";

function obterDadosFormulario(robo: Robo): DadosFormularioRobo {
  const { id: _id, ultimaPublicacaoEm: _ultimaPublicacaoEm, alteracoes: _alteracoes, clienteCor: _clienteCor, ...dados } = robo;
  return { ...dados, alteracoesRealizadas: [] };
}

export default function RobosPage() {
  const router = useRouter();
  const { canManageRobots } = useAdminAccess();
  const { robos, clientes, cadastrarRobo, importarRobos, atualizarRobo, excluirRobo, publicarAlteracoes } = useAppData();
  const [robotSelecionadoDoDashboard, setRobotSelecionadoDoDashboard] = useState<string | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [pacote, setPacote] = useState(TODAS_OPCOES);
  const [sistema, setSistema] = useState(TODAS_OPCOES);
  const [ambiente, setAmbiente] = useState(TODAS_OPCOES);
  const [status, setStatus] = useState(TODAS_OPCOES);
  const [selectedRobot, setSelectedRobot] = useState<Robo | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("edit");
  const [importOpen, setImportOpen] = useState(false);
  const dashboardSelectionAppliedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRobotSelecionadoDoDashboard(params.get("robot")?.trim() ?? null);
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
      const correspondeSistema = sistema === TODAS_OPCOES || robo.sistema === sistema;
      const correspondeAmbiente = ambiente === TODAS_OPCOES || robo.ambiente === ambiente;
      const correspondeStatus =
        status === TODAS_OPCOES ||
        (status === "Ativo" && robo.ativo) ||
        (status === "Inativo" && !robo.ativo);

      return correspondePesquisa && correspondePacote && correspondeSistema && correspondeAmbiente && correspondeStatus;
    });
  }, [ambiente, pacote, pesquisa, robos, sistema, status]);

  useEffect(() => {
    if (!robotSelecionadoDoDashboard || dashboardSelectionAppliedRef.current) return;

    const robotEncontrado = robos.find(
      (robo) => robo.nome.toLocaleLowerCase("pt-BR") === robotSelecionadoDoDashboard.toLocaleLowerCase("pt-BR"),
    );

    if (robotEncontrado) {
      setSelectedRobot(robotEncontrado);
      setDetailsOpen(true);
      dashboardSelectionAppliedRef.current = true;
    }
  }, [robos, robotSelecionadoDoDashboard]);

  function fecharDetalhesAoFiltrar(action: () => void) {
    action();
    setDetailsOpen(false);
  }

  async function salvarRobot(dados: DadosFormularioRobo, publicar: boolean) {
    const roboSalvo = drawerMode === "create"
      ? cadastrarRobo(dados)
      : selectedRobot
        ? await atualizarRobo(selectedRobot.id, dados)
        : null;

    if (roboSalvo) {
      if (publicar) {
        const descricaoPublicacao = dados.alteracoesRealizadas
          .map((alteracao) => alteracao.descricao.trim())
          .filter(Boolean)
          .join(" • ");
        const roboPublicado = publicarAlteracoes(roboSalvo.id, roboSalvo, descricaoPublicacao);
        setSelectedRobot(roboPublicado ?? roboSalvo);
        router.push("/dashboard");
      } else {
        setSelectedRobot(roboSalvo);
      }
    }
    setDrawerOpen(false);
  }

  function excluirRobotSelecionado() {
    if (!selectedRobot) return;
    excluirRobo(selectedRobot.id);
    setSelectedRobot(null);
    setDrawerOpen(false);
  }

  function limparFiltros() {
    setPesquisa("");
    setPacote(TODAS_OPCOES);
    setSistema(TODAS_OPCOES);
    setAmbiente(TODAS_OPCOES);
    setStatus(TODAS_OPCOES);
    setDetailsOpen(false);
  }

  return (
    <>
      <AppShell title="Robôs">
        <RobotHeader
          pesquisa={pesquisa}
          onPesquisaChange={(value) => fecharDetalhesAoFiltrar(() => setPesquisa(value))}
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
          onNovoRobot={() => {
            setDrawerMode("create");
            setDrawerOpen(true);
          }}
          canCreate={canManageRobots}
          canImport={canManageRobots}
          onImport={() => setImportOpen(true)}
        />

        <div style={{ marginTop: 24 }}>
          <RobotTable
            robots={robotsFiltrados}
            selectedRobot={selectedRobot}
            onSelectRobot={(robo) => {
              setSelectedRobot(robo);
              setDetailsOpen(true);
            }}
          />
        </div>

        {detailsOpen && selectedRobot && (
          <div onClick={() => setDetailsOpen(false)} style={overlayStyle}>
            <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
              <div style={modalHeaderStyle}>
                <div style={{ color: "var(--text-strong)", fontWeight: 700 }}>Detalhes do robô</div>
                <button type="button" onClick={() => setDetailsOpen(false)} style={closeButtonStyle}>Fechar</button>
              </div>
              <div style={{ padding: 20 }}>
                <RobotDetails
                  robot={selectedRobot}
                  clientes={clientes}
                  onEdit={canManageRobots ? (robo) => {
                    setSelectedRobot(robo);
                    setDrawerMode("edit");
                    setDrawerOpen(true);
                    setDetailsOpen(false);
                  } : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell>

      {canManageRobots && <RobotDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Novo Robô" : "Editar Robô"}
        onClose={() => setDrawerOpen(false)}
      >
        <RobotForm
          clientes={clientes}
          alteracoesExistentes={drawerMode === "edit" && selectedRobot ? selectedRobot.alteracoes : []}
          key={`${drawerMode}-${selectedRobot?.id ?? "new"}`}
          initialValues={drawerMode === "edit" && selectedRobot ? obterDadosFormulario(selectedRobot) : undefined}
          mode={drawerMode}
          onCancel={() => setDrawerOpen(false)}
          onDelete={drawerMode === "edit" ? excluirRobotSelecionado : undefined}
          onSubmit={salvarRobot}
        />
      </RobotDrawer>}
      {canManageRobots && <RobotImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (items) => {
          await importarRobos(items);
          setDetailsOpen(false);
        }}
      />}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24, background: "rgba(2, 6, 23, 0.72)",
};
const modalStyle: React.CSSProperties = {
  width: "min(860px, 100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 16,
  border: "1px solid var(--border)", background: "var(--card)", boxShadow: "var(--shadow)",
};
const modalHeaderStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px",
  borderBottom: "1px solid var(--separator)",
};
const closeButtonStyle: React.CSSProperties = {
  border: "1px solid var(--border)", background: "transparent", color: "var(--text)", padding: "6px 10px", borderRadius: 8,
};
