"use client";

import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import type { DadosFormularioRobo, Robo, TipoProdutoRobo } from "@/domain/entities";
import { getRobotProductByType, getRobotProductPath } from "@/domain/robot-products";

import RobotForm from "./RobotForm";
import styles from "./RobotFormRoute.module.css";

const ROBOT_FIELD_LABELS: Partial<Record<keyof DadosFormularioRobo, string>> = {
  nome: "nome", sistema: "sistema", courtName: "tribunal", ideal: "capacidade ideal", max: "capacidade máxima",
  pacote: "pacote", descricao: "descrição", ambiente: "ambiente", ativo: "status", stack: "stack", fila: "fila",
  versao: "versão", command: "command", productType: "produto", tribunal: "tribunal", tribunalSystem: "sistema do tribunal",
  responsavel: "responsável", disparo: "disparo", gatilhoDeRoboId: "gatilho de origem", gatilhoParaRoboId: "gatilho de destino",
};

function describeRobotChanges(previous: Robo | undefined, current: DadosFormularioRobo) {
  if (!previous) return `Robô ${current.nome} cadastrado.`;
  const changed = (Object.keys(ROBOT_FIELD_LABELS) as (keyof DadosFormularioRobo)[])
    .filter((field) => previous[field as keyof Robo] !== current[field])
    .map((field) => ROBOT_FIELD_LABELS[field]);
  return changed.length ? `Campos alterados: ${changed.join(", ")}.` : `Cadastro do robô ${current.nome} salvo.`;
}

function getFormData(robot: Robo): DadosFormularioRobo {
  const {
    id: _id,
    ultimaPublicacaoEm: _ultimaPublicacaoEm,
    alteracoes: _alteracoes,
    clienteCor: _clienteCor,
    robotCenterDocumentation: _robotCenterDocumentation,
    ...data
  } = robot;
  return { ...data, alteracoesRealizadas: [] };
}

export default function RobotFormRoute({ mode, robotId, defaultProductType = "INTEGRADOR" }: { mode: "create" | "edit"; robotId?: string; defaultProductType?: TipoProdutoRobo }) {
  const router = useRouter();
  const { isAdmin, isClient, canEditClientRobots, clientId, status: accessStatus } = useAdminAccess();
  const {
    robos,
    clientes,
    carregandoRobos,
    cadastrarRobo,
    atualizarRobo,
    excluirRobo,
    publicarAlteracoes,
  } = useAppData();
  const robot = mode === "edit" ? robos.find((item) => item.id === robotId) : undefined;
  const product = getRobotProductByType(robot?.productType ?? defaultProductType);
  const canEditRobot = isAdmin || (
    mode === "edit"
    && isClient
    && canEditClientRobots
    && Boolean(clientId)
    && robot?.clienteId === clientId
  );

  if (accessStatus === "loading" || carregandoRobos) return <div className={styles.message}>Carregando formulário...</div>;
  if (!canEditRobot) return <div className={`${styles.message} ${styles.error}`}>Acesso negado. Sua conta não possui autorização para editar este robô.</div>;
  if (mode === "edit" && !robot) return <div className={`${styles.message} ${styles.error}`}>Robô não encontrado ou acesso não autorizado.</div>;

  async function saveRobot(data: DadosFormularioRobo) {
    const publicationDescription = describeRobotChanges(robot, data);
    const savedRobot = mode === "create"
      ? await cadastrarRobo(data)
      : robot
        ? await atualizarRobo(robot.id, data)
        : null;

    if (!savedRobot) return;
    await publicarAlteracoes(savedRobot.id, savedRobot, publicationDescription);
    router.push(`/robos/${savedRobot.id}`);
  }

  function deleteRobot() {
    if (!robot) return;
    excluirRobo(robot.id);
    router.push(getRobotProductPath(robot.productType));
  }

  const backHref = robot ? `/robos/${robot.id}` : getRobotProductPath(defaultProductType);
  return (
    <div className={styles.routeContent}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href={backHref}><ArrowLeft size={13} /> Robôs</Link>
        <span>/</span>
        {robot ? <><Link href={`/robos/${robot.id}`}>{robot.nome}</Link><span>/</span></> : null}
        <strong>{mode === "create" ? "Novo robô" : "Editar"}</strong>
      </nav>

      <header className={styles.header}>
        <span className={styles.icon}><Bot size={22} /></span>
        <div><span>{product.label.toLocaleUpperCase("pt-BR")}</span><h1>{mode === "create" ? "Cadastrar novo robô" : `Editar ${robot?.nome}`}</h1><p>Configure identificação, execução e capacidade do robô.</p></div>
      </header>

      <RobotForm
        clientes={clientes}
        robos={robos}
        currentRobotId={robot?.id}
        alteracoesExistentes={robot?.alteracoes ?? []}
        key={`${mode}-${robot?.id ?? "new"}`}
        initialValues={robot ? getFormData(robot) : undefined}
        defaultProductType={defaultProductType}
        mode={mode}
        clientScoped={!isAdmin}
        onCancel={() => router.push(backHref)}
        onDelete={mode === "edit" && isAdmin ? deleteRobot : undefined}
        onSubmit={saveRobot}
      />
    </div>
  );
}
