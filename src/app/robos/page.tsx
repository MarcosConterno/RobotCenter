"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import RobotHeader from "@/components/robos/RobotHeader";
import RobotTable from "@/components/robos/RobotTable";
import RobotDetails from "@/components/robos/RobotDetails";
import RobotDrawer from "@/components/robos/RobotDrawer";
import { robotsMock } from "@/components/robos/robots.mock";
import RobotForm from "@/components/robos/RobotForm";
import type { Robot, RobotFormData } from "@/types/robot";

const ambientes = [
  "Todos",
  "Produção",
  "Teste",
  "Desenvolvimento",
] as const;

type DrawerMode = "create" | "edit";

export default function RobosPage() {
  const router = useRouter();
  const [robotSelecionadoDoDashboard, setRobotSelecionadoDoDashboard] =
    useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [cliente, setCliente] = useState("Todos");
  const [sistema, setSistema] = useState("Todos");
  const [ambiente, setAmbiente] = useState("Todos");
  const [status, setStatus] = useState("Todos");

  const [selectedRobot, setSelectedRobot] =
    useState<Robot | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const dashboardSelectionAppliedRef = useRef(false);

  function abrirModalRobot(robot: Robot) {
    setSelectedRobot(robot);
    setDetailsOpen(true);
  }

  function fecharModalDetalhes() {
    setDetailsOpen(false);
  }

  function handlePesquisaChange(value: string) {
    setPesquisa(value);
    setDetailsOpen(false);
  }

  function handleClienteChange(value: string) {
    setCliente(value);
    setDetailsOpen(false);
  }

  function handleSistemaChange(value: string) {
    setSistema(value);
    setDetailsOpen(false);
  }

  function handleAmbienteChange(value: string) {
    setAmbiente(value);
    setDetailsOpen(false);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setDetailsOpen(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setRobotSelecionadoDoDashboard(params.get("robot")?.trim() ?? null);
  }, []);

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [drawerMode, setDrawerMode] =
    useState<DrawerMode>("edit");

  const [robots, setRobots] =
    useState<Robot[]>(robotsMock);

const clientes = useMemo(() => {
  return [
    "Todos",
    ...Array.from(
      new Set(
        robots.map((robot) => robot.pacote)
      )
    ).sort(),
  ];
}, [robots]);

const sistemas = useMemo(() => {
  return [
    "Todos",
    ...Array.from(
      new Set(
        robots.map((robot) => robot.sistema)
      )
    ).sort(),
  ];
}, [robots]);

const statusOptions = ["Todos", "Ativo", "Inativo"] as const;

  const robotsFiltrados = useMemo(() => {
    const termoPesquisa = pesquisa.trim().toLocaleLowerCase("pt-BR");

    return robots.filter((robot) => {
      const busca =
        !termoPesquisa ||
        [robot.nome, robot.sistema, robot.pacote, robot.stack, robot.fila].some((valor) =>
          valor.toLocaleLowerCase("pt-BR").includes(termoPesquisa)
        );

      const filtroCliente =
        cliente === "Todos" ||
        robot.pacote === cliente;

      const filtroSistema =
        sistema === "Todos" ||
        robot.sistema === sistema;

      const filtroAmbiente =
        ambiente === "Todos" ||
        robot.ambiente === ambiente;

      const filtroStatus =
        status === "Todos" ||
        (status === "Ativo" && robot.ativo) ||
        (status === "Inativo" && !robot.ativo);

      return (
        busca &&
        filtroCliente &&
        filtroSistema &&
        filtroAmbiente &&
        filtroStatus
      );
    });
  }, [robots, pesquisa, cliente, sistema, ambiente, status]);

  useEffect(() => {
    if (!robotSelecionadoDoDashboard) {
      if (robotsFiltrados.length === 0) {
        setSelectedRobot(null);
        setDetailsOpen(false);
      }
      return;
    }

    if (dashboardSelectionAppliedRef.current) {
      return;
    }

    const robotEncontrado = robots.find(
      (robot) =>
        robot.nome.toLocaleLowerCase("pt-BR") ===
        robotSelecionadoDoDashboard.toLocaleLowerCase("pt-BR")
    );

    if (robotEncontrado) {
      setSelectedRobot(robotEncontrado);
      setDetailsOpen(true);
      setPesquisa("");
      setCliente("Todos");
      setSistema("Todos");
      setAmbiente("Todos");
      setStatus("Todos");
      dashboardSelectionAppliedRef.current = true;
    }
  }, [robots, robotsFiltrados, selectedRobot, robotSelecionadoDoDashboard]);

  function fecharDrawer() {
  setDrawerOpen(false);
}

function salvarRobot(data: RobotFormData) {
  if (drawerMode === "create") {
const novoRobot: Robot = {
  id: Date.now(),
  nome: data.nome,
  sistema: data.sistema,
  pacote: data.pacote,
  ambiente: data.ambiente,
      ultimaPublicacao: new Date().toLocaleDateString("pt-BR"),
      descricao: data.descricao,
      stack: data.stack,
      fila: data.fila,
      versao: data.versao,
      responsavel: data.responsavel,
      ativo: data.ativo,
      alteracaoRealizada: data.alteracaoRealizada,
      regras: data.regras.filter((regra) => regra.trim()).map((regra) => regra.trim()),
    };

    setRobots((old) => [...old, novoRobot]);
    setSelectedRobot(novoRobot);
    fecharDrawer();

    return;
  }

  if (!selectedRobot) return;

  const robotAtualizado: Robot = {
    ...selectedRobot,
    nome: data.nome,
    sistema: data.sistema,
    pacote: data.pacote,
    ambiente: data.ambiente,
    descricao: data.descricao,
    stack: data.stack,
    fila: data.fila,
    versao: data.versao,
    responsavel: data.responsavel,
    ativo: data.ativo,
    alteracaoRealizada: data.alteracaoRealizada,
    regras: data.regras.filter((regra) => regra.trim()).map((regra) => regra.trim()),
  };

  setRobots((old) =>
    old.map((robot) =>
      robot.id === robotAtualizado.id
        ? robotAtualizado
        : robot
    )
  );

  setSelectedRobot(robotAtualizado);

  fecharDrawer();
}

function excluirRobot() {
  if (!selectedRobot) return;

  setRobots((old) => old.filter((robot) => robot.id !== selectedRobot.id));
  setSelectedRobot(null);
  fecharDrawer();
}

function publicarAlteracoes(robot: Robot) {
  const robotPublicado = {
    ...robot,
    ultimaPublicacao: new Date().toLocaleDateString("pt-BR"),
  };
  const publicacao = {
    id: Date.now(),
    category: "Atualização do Robô",
    robot: robotPublicado,
    description: robot.alteracaoRealizada.trim() || `Novas alterações foram publicadas para o robô ${robot.nome}.`,
    publishedAt: "agora",
  };

  try {
    const anteriores = JSON.parse(localStorage.getItem("robot-center-publications") ?? "[]");
    localStorage.setItem("robot-center-publications", JSON.stringify([publicacao, ...anteriores].slice(0, 20)));
  } catch {
    localStorage.setItem("robot-center-publications", JSON.stringify([publicacao]));
  }

  setRobots((atuais) => atuais.map((item) => item.id === robot.id ? robotPublicado : item));
  setSelectedRobot(robotPublicado);
  router.push("/dashboard");
}

  return (
    <>
      <AppShell title="Robôs">
        <RobotHeader
          pesquisa={pesquisa}
          onPesquisaChange={handlePesquisaChange}
          cliente={cliente}
          clientes={clientes}
          onClienteChange={handleClienteChange}
          sistema={sistema}
          sistemas={sistemas}
          onSistemaChange={handleSistemaChange}
          ambiente={ambiente}
          ambientes={ambientes}
          onAmbienteChange={handleAmbienteChange}
          status={status}
          statusOptions={statusOptions}
          onStatusChange={handleStatusChange}
          totalRobots={robotsFiltrados.length}
          onLimparFiltros={() => {
            setPesquisa("");
            setCliente("Todos");
            setSistema("Todos");
            setAmbiente("Todos");
            setStatus("Todos");
            setDetailsOpen(false);
          }}
          onNovoRobot={() => {
            setDrawerMode("create");
            setDrawerOpen(true);
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 24,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              flex: 1,
            }}
          >
            <RobotTable
              robots={robotsFiltrados}
              selectedRobot={selectedRobot}
              onSelectRobot={abrirModalRobot}
            />
          </div>
        </div>

        {detailsOpen && selectedRobot && (
          <div
            onClick={() => setDetailsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2, 6, 23, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              zIndex: 50,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(860px, 100%)",
                maxHeight: "90vh",
                overflow: "auto",
                borderRadius: 16,
                border: "1px solid #273449",
                background: "#0F172A",
                boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderBottom: "1px solid #273449",
                }}
              >
                <div style={{ color: "#FFF", fontWeight: 700 }}>
                  Detalhes do robô
                </div>
                <button
                  type="button"
                  onClick={fecharModalDetalhes}
                  style={{
                    border: "1px solid #334155",
                    background: "transparent",
                    color: "#FFF",
                    padding: "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  Fechar
                </button>
              </div>

              <div style={{ padding: 20 }}>
                <RobotDetails
                  robot={selectedRobot}
                  onPublish={publicarAlteracoes}
                  onEdit={(robot) => {
                    setSelectedRobot(robot);
                    setDrawerMode("edit");
                    setDrawerOpen(true);
                    fecharModalDetalhes();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell>

      <RobotDrawer
        open={drawerOpen}
        title={
          drawerMode === "create"
            ? "Novo Robô"
            : "Editar Robô"
        }
        onClose={() => setDrawerOpen(false)}
      >
<RobotForm
  key={drawerMode + (selectedRobot?.id ?? "new")}
  nome={
    drawerMode === "edit"
      ? selectedRobot?.nome
      : undefined
  }
  sistema={
    drawerMode === "edit"
      ? selectedRobot?.sistema
      : undefined
  }
  pacote={
  drawerMode === "edit"
    ? selectedRobot?.pacote
    : undefined
}
  ambiente={
    drawerMode === "edit"
      ? selectedRobot?.ambiente
      : undefined
  }
  descricao={
    drawerMode === "edit"
      ? selectedRobot?.descricao
      : undefined
  }
  stack={
    drawerMode === "edit"
      ? selectedRobot?.stack
      : undefined
  }
  fila={
    drawerMode === "edit"
      ? selectedRobot?.fila
      : undefined
  }
  versao={
    drawerMode === "edit"
      ? selectedRobot?.versao
      : undefined
  }
  responsavel={
    drawerMode === "edit"
      ? selectedRobot?.responsavel
      : undefined
  }
  alteracaoRealizada={
    drawerMode === "edit"
      ? selectedRobot?.alteracaoRealizada
      : undefined
  }
  regras={
    drawerMode === "edit"
      ? selectedRobot?.regras
      : undefined
  }
  ativo={
    drawerMode === "edit"
      ? selectedRobot?.ativo
      : true
  }
  submitText={
    drawerMode === "create"
      ? "Cadastrar Robô"
      : "Salvar Alterações"
  }
  isEdit={drawerMode === "edit"}
  onCancel={fecharDrawer}
  onDelete={excluirRobot}
  onSubmit={salvarRobot}
/>
      </RobotDrawer>
    </>
  );
}
