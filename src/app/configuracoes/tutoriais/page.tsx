import { redirect } from "next/navigation";
import TutorialsAdminPage from "@/components/tutorials/TutorialsAdminPage";
import { getTutorialAccess } from "@/server/tutorials/access";

export default async function Page() {
  const access = await getTutorialAccess();
  if (!access.user) redirect("/login");
  if (!access.canManage) redirect("/configuracoes?acesso=negado");
  return <TutorialsAdminPage />;
}
