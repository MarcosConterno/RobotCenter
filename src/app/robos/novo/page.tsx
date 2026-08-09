import AppShell from "@/components/layout/AppShell";
import RobotFormRoute from "@/components/robos/RobotFormRoute";

export default function NewRobotPage() {
  return <AppShell title="Robôs"><RobotFormRoute mode="create" /></AppShell>;
}
