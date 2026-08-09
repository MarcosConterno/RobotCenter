import { redirect } from "next/navigation";
import TutorialEditorPage from "@/components/tutorials/TutorialEditorPage";
import { getTutorialAccess } from "@/server/tutorials/access";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getTutorialAccess();
  if (!access.user) redirect("/login");
  if (!access.canManage) redirect("/configuracoes?acesso=negado");
  const { id } = await params;
  return <TutorialEditorPage tutorialId={id} />;
}
