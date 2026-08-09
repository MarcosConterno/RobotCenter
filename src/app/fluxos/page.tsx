"use client";

import { Bot, CalendarPlus, Clock3, GitFork, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { useAdminAccess } from "@/auth/AdminAccessProvider";
import AppShell from "@/components/layout/AppShell";
import { useAppData } from "@/data/AppDataProvider";
import { useFlowsData } from "@/data/FlowsDataProvider";
import { formatarData } from "@/domain/formatters";

export default function FluxosPage() {
  const router = useRouter();
  const { clientes } = useAppData();
  const { fluxos, carregando, erro, excluirFluxo } = useFlowsData();
  const { isClient, canCreateFlows, canDeleteFlows } = useAdminAccess();
  const [pesquisa, setPesquisa] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const resultados = useMemo(() => {
    const termo = pesquisa.trim().toLocaleLowerCase("pt-BR");
    return fluxos.filter((fluxo) => {
      const correspondeCliente = !clienteId || fluxo.clienteId === clienteId;
      const correspondePesquisa = !termo || `${fluxo.nome} ${fluxo.descricao}`.toLocaleLowerCase("pt-BR").includes(termo);
      return correspondeCliente && correspondePesquisa;
    });
  }, [clienteId, fluxos, pesquisa]);

  async function removerFluxo(id: string, nome: string) {
    if (!window.confirm(`Excluir o fluxo “${nome}” e todo o seu histórico?`)) return;
    setExcluindo(id);
    try { await excluirFluxo(id); } finally { setExcluindo(null); }
  }

  return (
    <AppShell title="Fluxos">
      <section className="flows-page">
        <header className="flows-heading" data-tour="flows-heading">
          <div>
            <span className="flows-eyebrow">FLUXOS</span>
            <h1>Documentação visual das automações</h1>
            <p>Mapeie robôs, sistemas, decisões e regras de negócio por cliente.</p>
          </div>
          {canCreateFlows && (
            <div className="flows-page-actions">
              <button className="flow-primary-button" type="button" onClick={() => setNovoAberto(true)}>
                <Plus size={16} /> Novo fluxo
              </button>
            </div>
          )}
        </header>

        <div className="flows-filters">
          <label className="flows-search">
            <Search size={16} />
            <input value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} placeholder="Buscar por nome ou descrição..." />
          </label>
          {!isClient && (
            <label className="flows-client-filter">
              <span>Cliente</span>
              <select value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
                <option value="">Todos os clientes</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </select>
            </label>
          )}
        </div>

        {erro && <div className="flow-message is-error">{erro}</div>}
        {carregando ? (
          <div className="flow-message">Carregando fluxos...</div>
        ) : resultados.length === 0 ? (
          <div className="flows-empty"><GitFork size={28} /><strong>Nenhum fluxo encontrado</strong><span>Ajuste os filtros ou crie o primeiro fluxo.</span></div>
        ) : (
          <div className="flows-grid">
            {resultados.map((fluxo) => {
              const cliente = clientes.find((item) => item.id === fluxo.clienteId);
              return (
                <article
                  className="flow-card"
                  key={fluxo.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/fluxos/${fluxo.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/fluxos/${fluxo.id}`);
                    }
                  }}
                >
                  <div className="flow-card__top">
                    <span className="flow-card__client"><GitFork size={12} />{cliente?.nome ?? "Cliente"}</span>
                    <div className="flow-card__top-actions">
                      <span className={`flow-status is-${fluxo.status}`}>{fluxo.status === "publicado" ? "Publicado" : "Rascunho"}</span>
                      {canDeleteFlows && (
                        <button
                          type="button"
                          aria-label={`Excluir ${fluxo.nome}`}
                          disabled={excluindo === fluxo.id}
                          onClick={(event) => { event.stopPropagation(); void removerFluxo(fluxo.id, fluxo.nome); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flow-card__title"><span><GitFork size={17} /></span><h2>{fluxo.nome}</h2></div>
                  <p>{fluxo.descricao || "Sem descrição."}</p>
                  <div className="flow-card__facts">
                    <span><Bot size={13} /><strong>{fluxo.quantidadeRobos}</strong> robôs</span>
                    <span><CalendarPlus size={13} />Criado em {formatarData(fluxo.criadoEm)}</span>
                    <span><Clock3 size={13} />Alterado em {formatarData(fluxo.atualizadoEm)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {novoAberto && <NovoFluxoDialog onClose={() => setNovoAberto(false)} />}
    </AppShell>
  );
}

function NovoFluxoDialog({ onClose }: { onClose: () => void }) {
  const { clientes } = useAppData();
  const { criarFluxo } = useFlowsData();
  const [clienteId, setClienteId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!clienteId || !nome.trim()) return;
    setSalvando(true); setErro("");
    try {
      const fluxo = await criarFluxo({ clienteId, nome, descricao });
      window.location.assign(`/fluxos/${fluxo.id}`);
    } catch {
      setErro("Não foi possível criar o fluxo.");
      setSalvando(false);
    }
  }

  return (
    <div className="flow-dialog-backdrop" onMouseDown={onClose}>
      <form className="flow-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>NOVO FLUXO</span><h2>Criar documentação visual</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header>
        <label>Cliente *<select required value={clienteId} onChange={(event) => setClienteId(event.target.value)}><option value="">Selecione</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></label>
        <label>Nome *<input required value={nome} onChange={(event) => setNome(event.target.value)} /></label>
        <label>Descrição<textarea rows={4} value={descricao} onChange={(event) => setDescricao(event.target.value)} /></label>
        {erro && <div className="flow-message is-error">{erro}</div>}
        <footer><button type="button" onClick={onClose}>Cancelar</button><button className="flow-primary-button" disabled={salvando} type="submit">{salvando ? "Criando..." : "Criar fluxo"}</button></footer>
      </form>
    </div>
  );
}
