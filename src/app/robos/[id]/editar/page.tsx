"use client";

import { use } from "react";

import AppShell from "@/components/layout/AppShell";
import RobotFormRoute from "@/components/robos/RobotFormRoute";

export default function EditRobotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppShell title="Robôs"><RobotFormRoute mode="edit" robotId={id} /></AppShell>;
}
