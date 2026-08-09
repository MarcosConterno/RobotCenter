"use client";

import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import type { DadosFormularioRobo, Robo } from "@/domain/entities";

import RobotForm from "./RobotForm";
import styles from "./RobotFormRoute.module.css";

const MARCADOR_REGRA_DOCUMENTACAO = "[REGRA_DOCUMENTACAO]";
const MARCADOR_REGRA_FORA_DOCUMENTACAO = "[REGRA_FORA_DOCUMENTACAO]";

function getAddedRules(newRules: DadosFormularioRobo["regras"], currentRules: Robo["regras"] = []) {
  const current = new Set(currentRules.map((rule) => rule.descricao.trim().toLocaleLowerCase("pt-BR")));
  return newRules
    .map((rule) => rule.descricao.trim())
    .filter((description) => description && !current.has(description.toLocaleLowerCase("pt-BR")));
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

export default function RobotFormRoute({ mode, robotId }: { mode: "create" | "edit"; robotId?: string }) {
  const router = useRouter();
  const { isAdmin, status: accessStatus } = useAdminAccess();
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

  if (accessStatus === "loading" || carregandoRobos) return <div className={styles.message}>Carregando formulário...</div>;
  if (!isAdmin) return <div className={`${styles.message} ${styles.error}`}>Acesso negado. Somente Admin pode cadastrar ou editar robôs.</div>;
  if (mode === "edit" && !robot) return <div className={`${styles.message} ${styles.error}`}>Robô não encontrado ou acesso não autorizado.</div>;

  async function saveRobot(data: DadosFormularioRobo, publish: boolean) {
    const documentationRules = getAddedRules(data.regras, robot?.regras);
    const outsideDocumentationRules = getAddedRules(data.regrasForaDocumentacao, robot?.regrasForaDocumentacao);
    const savedRobot = mode === "create"
      ? await cadastrarRobo(data)
      : robot
        ? await atualizarRobo(robot.id, data)
        : null;

    if (!savedRobot) return;
    if (publish) {
      const publicationDescription = [
        ...data.alteracoesRealizadas.map((change) => change.descricao.trim()).filter(Boolean),
        ...documentationRules.map((description) => `${MARCADOR_REGRA_DOCUMENTACAO} ${description}`),
        ...outsideDocumentationRules.map((description) => `${MARCADOR_REGRA_FORA_DOCUMENTACAO} ${description}`),
      ].join(" • ");
      await publicarAlteracoes(savedRobot.id, savedRobot, publicationDescription);
    }
    router.push(`/robos/${savedRobot.id}`);
  }

  function deleteRobot() {
    if (!robot) return;
    excluirRobo(robot.id);
    router.push("/robos");
  }

  const backHref = robot ? `/robos/${robot.id}` : "/robos";
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
        <div><span>ROBÔS</span><h1>{mode === "create" ? "Cadastrar novo robô" : `Editar ${robot?.nome}`}</h1><p>Configure os dados, regras e a Documentação Upada do robô.</p></div>
      </header>

      <RobotForm
        clientes={clientes}
        robos={robos}
        currentRobotId={robot?.id}
        alteracoesExistentes={robot?.alteracoes ?? []}
        key={`${mode}-${robot?.id ?? "new"}`}
        initialValues={robot ? getFormData(robot) : undefined}
        mode={mode}
        onCancel={() => router.push(backHref)}
        onDelete={mode === "edit" ? deleteRobot : undefined}
        onSubmit={saveRobot}
      />
    </div>
  );
}
