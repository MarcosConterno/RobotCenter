"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowLeft, Bot, LoaderCircle, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

function getCopyFormData(robot: Robo): DadosFormularioRobo {
  const data = getFormData(robot);
  return {
    ...data,
    nome: `Cópia de ${robot.nome}`,
    regras: robot.regras.map((regra) => ({ descricao: regra.descricao })),
    regrasForaDocumentacao: robot.regrasForaDocumentacao.map((regra) => ({ descricao: regra.descricao })),
    alteracoesRealizadas: [],
    uploadedDocumentationPath: null,
    uploadedDocumentationName: null,
    uploadedDocumentationFile: null,
  };
}

export default function RobotFormRoute({ mode, robotId, copySourceId, defaultProductType = "INTEGRADOR" }: { mode: "create" | "edit"; robotId?: string; copySourceId?: string; defaultProductType?: TipoProdutoRobo }) {
  const router = useRouter();
  const { isAdmin, isMaster, isClient, canDuplicateRobots, canEditClientRobots, clientId, status: accessStatus } = useAdminAccess();
  const [deleteError, setDeleteError] = useState("");
  const [deletingRobot, setDeletingRobot] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
  const copySource = mode === "create" && copySourceId ? robos.find((item) => item.id === copySourceId) : undefined;
  const isCopy = mode === "create" && Boolean(copySourceId);
  const product = getRobotProductByType(robot?.productType ?? copySource?.productType ?? defaultProductType);
  const canEditRobot = (mode === "create" && isCopy ? canDuplicateRobots && Boolean(copySource) : isAdmin) || (
    mode === "edit"
    && isClient
    && canEditClientRobots
    && Boolean(clientId)
    && robot?.clienteId === clientId
  );

  if (accessStatus === "loading" || carregandoRobos) return <div className={styles.message}>Carregando formulário...</div>;
  if (mode === "edit" && !robot && deletingRobot) {
    return <div className={`${styles.message} ${styles.redirectMessage}`} role="status"><LoaderCircle size={17} /> Robô excluído. Redirecionando...</div>;
  }
  if (isCopy && !copySource) return <div className={`${styles.message} ${styles.error}`}>Robô de origem não encontrado ou acesso não autorizado.</div>;
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

  async function deleteRobot() {
    if (!robot) return;
    setDeleteError("");
    setDeletingRobot(true);
    try {
      await excluirRobo(robot.id);
      setDeleteDialogOpen(false);
      router.replace(getRobotProductPath(robot.productType));
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir o robô.");
      setDeletingRobot(false);
    }
  }

  const backHref = robot ? `/robos/${robot.id}` : copySource ? `/robos/${copySource.id}` : getRobotProductPath(defaultProductType);
  return (
    <div className={styles.routeContent}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href={backHref}><ArrowLeft size={13} /> Robôs</Link>
        <span>/</span>
        {robot ? <><Link href={`/robos/${robot.id}`}>{robot.nome}</Link><span>/</span></> : null}
        <strong>{isCopy ? "Criar cópia" : mode === "create" ? "Novo robô" : "Editar"}</strong>
      </nav>

      <header className={styles.header}>
        <span className={styles.icon}><Bot size={22} /></span>
        <div><span>{product.label.toLocaleUpperCase("pt-BR")}</span><h1>{isCopy ? `Criar cópia de ${copySource?.nome}` : mode === "create" ? "Cadastrar novo robô" : `Editar ${robot?.nome}`}</h1><p>{isCopy ? "Revise os dados copiados e altere o que for necessário antes de salvar." : "Configure identificação, execução e capacidade do robô."}</p></div>
      </header>

      <RobotForm
        clientes={clientes}
        robos={robos}
        currentRobotId={robot?.id}
        alteracoesExistentes={robot?.alteracoes ?? []}
        key={`${mode}-${robot?.id ?? copySource?.id ?? "new"}`}
        initialValues={robot ? getFormData(robot) : copySource ? getCopyFormData(copySource) : undefined}
        defaultProductType={copySource?.productType ?? defaultProductType}
        mode={mode}
        clientScoped={!isAdmin}
        onCancel={() => router.push(backHref)}
        onDelete={mode === "edit" && isMaster ? () => { setDeleteError(""); setDeleteDialogOpen(true); } : undefined}
        deletePending={deletingRobot}
        onSubmit={saveRobot}
      />
      {deleteError ? <p className={styles.error} role="alert">{deleteError}</p> : null}

      <Dialog.Root open={deleteDialogOpen} onOpenChange={(open) => { if (!deletingRobot) setDeleteDialogOpen(open); }}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content
            className={styles.dialogContent}
            onEscapeKeyDown={(event) => { if (deletingRobot) event.preventDefault(); }}
            onPointerDownOutside={(event) => { if (deletingRobot) event.preventDefault(); }}
          >
            <div className={styles.dialogIcon} aria-hidden="true"><AlertTriangle size={22} /></div>
            <div className={styles.dialogBody}>
              <Dialog.Title className={styles.dialogTitle}>Excluir robô permanentemente?</Dialog.Title>
              <Dialog.Description className={styles.dialogDescription}>
                Você está prestes a excluir <strong>{robot?.nome}</strong>. O cadastro será removido do banco e esta ação não poderá ser desfeita.
              </Dialog.Description>
              <div className={styles.dialogWarning}>
                Fluxos, solicitações e documentação histórica serão preservados sem vínculo com este robô.
              </div>
            </div>
            <Dialog.Close className={styles.dialogClose} aria-label="Fechar confirmação" disabled={deletingRobot}>
              <X size={17} />
            </Dialog.Close>
            {deleteError ? <p className={styles.dialogError} role="alert">{deleteError}</p> : null}
            <div className={styles.dialogActions}>
              <Dialog.Close className={styles.dialogCancel} disabled={deletingRobot}>Cancelar</Dialog.Close>
              <button className={styles.dialogDelete} type="button" onClick={() => void deleteRobot()} disabled={deletingRobot}>
                <Trash2 size={15} />
                {deletingRobot ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
