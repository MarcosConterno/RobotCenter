"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import AppShell from "@/components/layout/AppShell";
import RobotDetails from "@/components/robos/RobotDetails";
import { useAppData } from "@/data/AppDataProvider";

export default function RobotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { robos, clientes, carregandoRobos } = useAppData();
  const robot = robos.find((item) => item.id === id);
  const cliente = robot ? clientes.find((item) => item.id === robot.clienteId) : undefined;

  return (
    <AppShell title="Robôs">
      <main className="robot-detail-route">
        <nav className="robot-detail-route__breadcrumb" aria-label="Navegação estrutural">
          <Link href="/robos"><ArrowLeft size={13} /> Robôs</Link>
          {cliente ? <><span>/</span><span>{cliente.nome}</span></> : null}
          <span>/</span><strong>{robot?.nome ?? "Detalhes"}</strong>
        </nav>
        {carregandoRobos
          ? <div className="robot-detail-route__message">Carregando robô...</div>
          : robot
            ? <RobotDetails robot={robot} clientes={clientes} robos={robos} />
            : <div className="robot-detail-route__message is-error">Robô não encontrado ou acesso não autorizado.</div>}
      </main>
    </AppShell>
  );
}
