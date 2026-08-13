"use client";

import { Bot, Clock3, FileText, GitFork, KeyRound, Pencil, Plus, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import AccessControlCenter from "@/components/settings/AccessControlCenter";
import SettingsNavigation from "@/components/settings/SettingsNavigation";
import RobotCatalogSettings from "@/components/settings/RobotCatalogSettings";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import { CORES_BADGE_ROBO, TIPOS_USUARIO, type CorBadgeRobo, type TipoUsuario, type Usuario } from "@/domain/entities";
import { PALETAS_BADGE_ROBO } from "@/domain/badge-colors";
import { dadosCadastroClienteSchema, dadosCadastroUsuarioSchema, primeiraMensagemErro } from "@/domain/validation";

type CadastroAtivo = "usuarios" | "clientes" | "cadastros" | "permissoes";

interface PermissionRole { id: string; codigo: string; nome: string; descricao: string | null }
interface PermissionItem { id: string; codigo: string; recurso: string; acao: string; descricao: string | null; roles: string[] }
interface ClientMetric { clientId: string; robots: number; flows: number; documents: number; updatedAt: string }

const CLIENT_ROLE_BLOCKED_PERMISSIONS = new Set([
  "robots.create", "robots.update", "robots.archive", "robots.capacity.update", "robots.duplicate",
  "publications.create", "robot_catalog.manage", "robot_center_documentation.manage",
  "budgets.read", "budgets.create", "budgets.update", "budgets.dictionary.manage",
  "clients.manage", "users.read", "users.manage", "access_control.read",
]);

export default function ConfiguracoesPage() {
  const {
    clientes,
    cadastrarCliente: adicionarCliente,
    atualizarCliente,
    excluirCliente,
  } = useAppData();
  const { isAdmin: adminAutorizado, isMaster, isClient, permissions: accessPermissions, status: statusAutorizacao, error: erroAutorizacao } = useAdminAccess();
  const carregandoAutorizacao = statusAutorizacao === "loading";
  const [cadastroAtivo, setCadastroAtivo] = useState<CadastroAtivo>("usuarios");
  const cadastroVisivel: CadastroAtivo = isClient ? "clientes" : cadastroAtivo;
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>("Operador");
  const [clienteUsuarioId, setClienteUsuarioId] = useState("");
  const [podeEditarRobosCliente, setPodeEditarRobosCliente] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [tenant, setTenant] = useState("");
  const [corCliente, setCorCliente] = useState<CorBadgeRobo>(() =>
    CORES_BADGE_ROBO[clientes.length % CORES_BADGE_ROBO.length],
  );
  const [erroUsuario, setErroUsuario] = useState("");
  const [sucessoUsuario, setSucessoUsuario] = useState("");
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [erroCliente, setErroCliente] = useState("");
  const [usuariosGerenciados, setUsuariosGerenciados] = useState<Usuario[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [erroListaUsuarios, setErroListaUsuarios] = useState("");
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState<string | number | null>(null);
  const [usuarioEditandoLogin, setUsuarioEditandoLogin] = useState("");
  const [usuarioEditandoEmail, setUsuarioEditandoEmail] = useState("");
  const [usuarioEditandoTipo, setUsuarioEditandoTipo] = useState<TipoUsuario>("Operador");
  const [usuarioEditandoClienteId, setUsuarioEditandoClienteId] = useState("");
  const [usuarioEditandoPodeEditarRobos, setUsuarioEditandoPodeEditarRobos] = useState(false);
  const [usuarioExcluindo, setUsuarioExcluindo] = useState<Usuario | null>(null);
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);
  const [clienteEditandoNome, setClienteEditandoNome] = useState("");
  const [clienteEditandoTenant, setClienteEditandoTenant] = useState("");
  const [clienteEditandoCor, setClienteEditandoCor] = useState<CorBadgeRobo>("azul");
  const [clienteExcluindoId, setClienteExcluindoId] = useState<string | null>(null);
  const [clienteSubstitutoId, setClienteSubstitutoId] = useState("");
  const [excluindoCliente, setExcluindoCliente] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | number | null>(null);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");
  const [clientMetrics, setClientMetrics] = useState<Record<string, ClientMetric>>({});
  const [loadingClientMetrics, setLoadingClientMetrics] = useState(false);
  const [clientMetricsLoaded, setClientMetricsLoaded] = useState(false);
  const [clientMetricsError, setClientMetricsError] = useState("");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("aba");
    if (requestedTab === "usuarios" || requestedTab === "clientes" || requestedTab === "cadastros" || requestedTab === "permissoes") setCadastroAtivo(requestedTab);
  }, []);

  const carregarMetricasClientes = useCallback(async () => {
    setLoadingClientMetrics(true);
    setClientMetricsError("");
    try {
      const response = await fetch("/api/admin/client-metrics", { cache: "no-store" });
      const payload = await response.json() as { metrics?: ClientMetric[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os indicadores dos clientes.");
      setClientMetrics(Object.fromEntries((payload.metrics ?? []).map((metric) => [metric.clientId, metric])));
    } catch (metricError) {
      setClientMetricsError(metricError instanceof Error ? metricError.message : "Não foi possível carregar os indicadores dos clientes.");
    } finally {
      setLoadingClientMetrics(false);
      setClientMetricsLoaded(true);
    }
  }, []);

  const carregarUsuarios = useCallback(async () => {
    setCarregandoUsuarios(true);
    setErroListaUsuarios("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = await response.json() as {
        users?: Usuario[];
        currentUserId?: string;
        error?: string;
      };

      if (!response.ok) {
        setErroListaUsuarios(payload.error ?? "Não foi possível listar os usuários.");
        return;
      }

      setUsuariosGerenciados(payload.users ?? []);
      setUsuarioAtualId(payload.currentUserId ?? null);
    } catch {
      setErroListaUsuarios("Não foi possível listar os usuários.");
    } finally {
      setCarregandoUsuarios(false);
    }
  }, []);

  useEffect(() => {
    if (adminAutorizado) void carregarUsuarios();
  }, [adminAutorizado, carregarUsuarios]);

  useEffect(() => {
    if (adminAutorizado && cadastroVisivel === "clientes" && !clientMetricsLoaded && !loadingClientMetrics) void carregarMetricasClientes();
  }, [adminAutorizado, cadastroVisivel, carregarMetricasClientes, clientMetricsLoaded, loadingClientMetrics]);

  useEffect(() => {
    if (!adminAutorizado || (permissionRoles.length && permissions.length)) return;
    setLoadingPermissions(true);
    setPermissionsError("");
    void fetch("/api/admin/permissions", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { roles?: PermissionRole[]; permissions?: PermissionItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as permissões.");
        setPermissionRoles(payload.roles ?? []);
        setPermissions(payload.permissions ?? []);
      })
      .catch((error) => setPermissionsError(error instanceof Error ? error.message : "Não foi possível carregar as permissões."))
      .finally(() => setLoadingPermissions(false));
  }, [adminAutorizado, permissionRoles.length, permissions.length]);

  async function cadastrarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = dadosCadastroUsuarioSchema.safeParse({ login, email, senha, tipo: tipoUsuario, clienteId: clienteUsuarioId || null, podeEditarRobosCliente });
    if (!result.success) {
      setErroUsuario(primeiraMensagemErro(result.error));
      return;
    }

    setErroUsuario("");
    setSucessoUsuario("");
    setSalvandoUsuario(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: result.data.login,
          email: result.data.email,
          password: result.data.senha,
          tipo: result.data.tipo,
          clientId: result.data.clienteId ?? null,
          canEditClientRobots: result.data.podeEditarRobosCliente,
        }),
      });
      const payload = await response.json() as { error?: string };

      if (!response.ok) {
        setErroUsuario(payload.error ?? "Não foi possível cadastrar o usuário.");
        return;
      }

      setLogin("");
      setEmail("");
      setSenha("");
      setTipoUsuario("Operador");
      setClienteUsuarioId("");
      setPodeEditarRobosCliente(false);
      setSucessoUsuario("Usuário cadastrado com sucesso.");
      setUsuariosGerenciados((atuais) => [...atuais, payload as Usuario]);
    } catch {
      setErroUsuario("Não foi possível comunicar com o servidor.");
    } finally {
      setSalvandoUsuario(false);
    }
  }

  function iniciarEdicaoUsuario(usuario: Usuario) {
    setUsuarioEditandoId(usuario.id);
    setUsuarioEditandoLogin(usuario.login);
    setUsuarioEditandoEmail(usuario.email ?? "");
    setUsuarioEditandoTipo(usuario.tipo);
    setUsuarioEditandoClienteId(usuario.clienteId ?? "");
    setUsuarioEditandoPodeEditarRobos(usuario.podeEditarRobosCliente === true);
    setErroUsuario("");
    setSucessoUsuario("");
  }

  async function salvarUsuario(usuarioId: string | number) {
    const identificador = String(usuarioId);
    const loginNormalizado = usuarioEditandoLogin.trim();
    const emailNormalizado = usuarioEditandoEmail.trim();
    if (!loginNormalizado || !emailNormalizado) {
      setErroUsuario("Informe o nome e o email do usuário.");
      return;
    }
    if (usuarioEditandoTipo === "Cliente" && !usuarioEditandoClienteId) {
      setErroUsuario("Usuário Cliente deve estar vinculado a um cliente.");
      return;
    }

    setAcaoEmAndamento(usuarioId);
    setErroUsuario("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: identificador,
          login: loginNormalizado,
          email: emailNormalizado,
          tipo: usuarioEditandoTipo,
          clientId: usuarioEditandoClienteId || null,
          canEditClientRobots: usuarioEditandoTipo === "Cliente" && usuarioEditandoPodeEditarRobos,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setErroUsuario(payload.error ?? "Não foi possível atualizar o usuário.");
        return;
      }

      setUsuarioEditandoId(null);
      setSucessoUsuario("Usuário atualizado com sucesso.");
      setUsuariosGerenciados((atuais) =>
        atuais.map((usuario) => String(usuario.id) === identificador ? payload as Usuario : usuario),
      );
    } catch {
      setErroUsuario("Não foi possível comunicar com o servidor.");
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  async function removerUsuario(usuario: Usuario) {
    if (String(usuario.id) === usuarioAtualId) {
      setErroUsuario("Você não pode excluir o próprio usuário.");
      return;
    }
    setAcaoEmAndamento(usuario.id);
    setErroUsuario("");
    setSucessoUsuario("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(usuario.id) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setErroUsuario(payload.error ?? "Não foi possível excluir o usuário.");
        return;
      }

      setUsuariosGerenciados((atuais) => atuais.filter((item) => item.id !== usuario.id));
      setSucessoUsuario("Usuário excluído e acesso desativado.");
      setUsuarioExcluindo(null);
    } catch {
      setErroUsuario("Não foi possível comunicar com o servidor.");
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  function iniciarEdicaoCliente(cliente: (typeof clientes)[number]) {
    setClienteEditandoId(cliente.id);
    setClienteEditandoNome(cliente.nome);
    setClienteEditandoTenant(cliente.tenant);
    setClienteEditandoCor(cliente.cor);
    setErroCliente("");
  }

  async function salvarCliente(clienteId: string) {
    const result = dadosCadastroClienteSchema.safeParse({
      nome: clienteEditandoNome,
      tenant: clienteEditandoTenant,
      cor: clienteEditandoCor,
    });
    if (!result.success) {
      setErroCliente(primeiraMensagemErro(result.error));
      return;
    }

    try {
      await atualizarCliente(clienteId, result.data);
      await carregarMetricasClientes();
      setClienteEditandoId(null);
      setErroCliente("");
    } catch {
      setErroCliente("Não foi possível atualizar o cliente.");
    }
  }

  function abrirExclusaoCliente(cliente: (typeof clientes)[number]) {
    if (!isMaster) {
      setErroCliente("Somente o usuário Master pode excluir clientes e remapear seus usuários.");
      return;
    }
    if ((clientMetrics[cliente.id]?.robots ?? 0) > 0) {
      setErroCliente("O cliente não pode ser excluído porque possui robôs ativos vinculados.");
      return;
    }
    setClienteExcluindoId(cliente.id);
    setClienteSubstitutoId("");
    setErroCliente("");
  }

  function abrirExclusaoUsuario(usuario: Usuario) {
    setErroUsuario("");
    setSucessoUsuario("");
    setUsuarioExcluindo(usuario);
  }

  async function confirmarExclusaoCliente() {
    if (!clienteExcluindoId) return;
    setExcluindoCliente(true);
    setErroCliente("");
    try {
      await excluirCliente(clienteExcluindoId, clienteSubstitutoId || null);
      setUsuariosGerenciados((atuais) => atuais.map((usuario) => usuario.clienteId === clienteExcluindoId
        ? { ...usuario, clienteId: clienteSubstitutoId || null }
        : usuario));
      setClienteExcluindoId(null);
      setClienteSubstitutoId("");
    } catch (deleteError) {
      const message = deleteError && typeof deleteError === "object" && "message" in deleteError
        ? String(deleteError.message)
        : "Não foi possível excluir o cliente.";
      setErroCliente(message);
    } finally {
      setExcluindoCliente(false);
    }
  }

  async function cadastrarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = dadosCadastroClienteSchema.safeParse({ nome: nomeCliente, tenant, cor: corCliente });
    if (!result.success) {
      setErroCliente(primeiraMensagemErro(result.error));
      return;
    }

    try {
      await adicionarCliente(result.data);
      await carregarMetricasClientes();
      setNomeCliente("");
      setTenant("");
      setCorCliente(CORES_BADGE_ROBO[(clientes.length + 1) % CORES_BADGE_ROBO.length]);
      setErroCliente("");
    } catch (createError) {
      setErroCliente(createError instanceof Error ? createError.message : "Não foi possível cadastrar o cliente.");
    }
  }

  return (
    <AppShell title="Configurações">
      <div className="settings-page" style={pageStyle}>
        {cadastroVisivel !== "permissoes" && <header style={pageHeaderStyle}>
          <span style={pageEyebrowStyle}>CONFIGURAÇÕES</span>
          <h1 style={titleStyle}>Administração do sistema</h1>
          <p style={subtitleStyle}>Gerencie usuários, clientes e permissões de acesso do Robot Center.</p>
        </header>}

        <SettingsNavigation active={cadastroVisivel} onSelect={setCadastroAtivo} />

        {cadastroVisivel === "usuarios" ? (
          <section style={sectionStyle} aria-label="Cadastro de usuários">
            <div style={sectionHeadingStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Novo usuário</h2>
                <p style={sectionSubtitleStyle}>Defina o acesso e o perfil de utilização.</p>
              </div>
            </div>

            {adminAutorizado ? <form onSubmit={cadastrarUsuario} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Nome</span>
                <input
                  value={login}
                  onChange={(event) => { setLogin(event.target.value); setErroUsuario(""); setSucessoUsuario(""); }}
                  placeholder="Nome do usuário"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setErroUsuario(""); setSucessoUsuario(""); }}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Senha</span>
                <input
                  type="password"
                  value={senha}
                  onChange={(event) => { setSenha(event.target.value); setErroUsuario(""); setSucessoUsuario(""); }}
                  placeholder="Digite uma senha"
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Tipo de usuário</span>
                <select
                  value={tipoUsuario}
                  onChange={(event) => { const tipo = event.target.value as TipoUsuario; setTipoUsuario(tipo); if (tipo !== "Cliente") setPodeEditarRobosCliente(false); setErroUsuario(""); setSucessoUsuario(""); }}
                  style={inputStyle}
                >
                  {(permissionRoles.length ? permissionRoles.filter((role) => role.codigo !== "master").map((role) => role.nome) : [...TIPOS_USUARIO]).map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Cliente {tipoUsuario === "Cliente" ? "*" : "(opcional)"}</span>
                <select
                  value={clienteUsuarioId}
                  onChange={(event) => { setClienteUsuarioId(event.target.value); setErroUsuario(""); setSucessoUsuario(""); }}
                  required={tipoUsuario === "Cliente"}
                  style={inputStyle}
                >
                  <option value="">Nenhum cliente</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </select>
              </label>

              {tipoUsuario === "Cliente" && clienteUsuarioId ? <label style={permissionToggleStyle}>
                <input type="checkbox" checked={podeEditarRobosCliente} onChange={(event) => setPodeEditarRobosCliente(event.target.checked)} />
                <span><strong>Pode editar robôs</strong><small>Permite alterar somente os robôs do Cliente vinculado. Não permite cadastrar, excluir ou transferir robôs.</small></span>
              </label> : null}

              <button type="submit" style={primaryButtonStyle} disabled={salvandoUsuario}>
                <Plus size={17} />
                {salvandoUsuario ? "Cadastrando..." : "Cadastrar usuário"}
              </button>
              {erroUsuario && <p role="alert" style={formErrorStyle}>{erroUsuario}</p>}
              {sucessoUsuario && <p role="status" style={formSuccessStyle}>{sucessoUsuario}</p>}
            </form> : <p role={erroAutorizacao ? "alert" : "status"} style={accessNoticeStyle}>
              {carregandoAutorizacao ? "Validando permissões..." : erroAutorizacao || "Somente administradores podem cadastrar ou alterar usuários."}
            </p>}

            {adminAutorizado && carregandoUsuarios && <p role="status" style={accessNoticeStyle}>Carregando usuários cadastrados...</p>}
            {erroListaUsuarios && <p role="alert" style={accessNoticeStyle}>{erroListaUsuarios}</p>}

            <CadastroLista
              titulo="Usuários cadastrados"
              vazio="Nenhum usuário cadastrado."
              quantidade={usuariosGerenciados.length}
            >
              {usuariosGerenciados.map((usuario) => (
                <div key={usuario.id} style={listItemStyle}>
                  {usuarioEditandoId === usuario.id ? (
                    <div style={editGridStyle}>
                      <input aria-label="Nome" value={usuarioEditandoLogin} onChange={(event) => setUsuarioEditandoLogin(event.target.value)} style={compactInputStyle} />
                      <input aria-label="Email" type="email" value={usuarioEditandoEmail} onChange={(event) => setUsuarioEditandoEmail(event.target.value)} style={compactInputStyle} />
                      <select aria-label="Tipo de usuário" value={usuarioEditandoTipo} onChange={(event) => { const tipo = event.target.value as TipoUsuario; setUsuarioEditandoTipo(tipo); if (tipo !== "Cliente") setUsuarioEditandoPodeEditarRobos(false); }} style={compactInputStyle}>
                        {(permissionRoles.length ? permissionRoles.filter((role) => role.codigo !== "master").map((role) => role.nome) : [...TIPOS_USUARIO]).map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                      </select>
                      <select aria-label="Cliente vinculado" value={usuarioEditandoClienteId} onChange={(event) => setUsuarioEditandoClienteId(event.target.value)} required={usuarioEditandoTipo === "Cliente"} style={compactInputStyle}>
                        <option value="">Nenhum cliente</option>
                        {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                      </select>
                      {usuarioEditandoTipo === "Cliente" && usuarioEditandoClienteId ? <label style={compactPermissionToggleStyle}>
                        <input type="checkbox" checked={usuarioEditandoPodeEditarRobos} onChange={(event) => setUsuarioEditandoPodeEditarRobos(event.target.checked)} />
                        <span>Pode editar robôs</span>
                      </label> : null}
                    </div>
                  ) : (
                    <div style={itemContentStyle}>
                      <span style={itemNameStyle}>{usuario.login}</span>
                      {usuario.email && <span style={itemSecondaryStyle}>{usuario.email}</span>}
                      {usuario.clienteId && <span style={itemSecondaryStyle}>Cliente: {clientes.find((cliente) => cliente.id === usuario.clienteId)?.nome ?? "Cliente não encontrado"}</span>}
                      {usuario.tipo === "Cliente" && <span style={itemSecondaryStyle}>Edição de robôs: {usuario.podeEditarRobosCliente ? "Permitida" : "Somente leitura"}</span>}
                    </div>
                  )}
                  <div style={itemActionsStyle}>
                    {usuarioEditandoId === usuario.id ? (
                      <>
                        <IconButton label="Salvar usuário" onClick={() => void salvarUsuario(usuario.id)} disabled={acaoEmAndamento === usuario.id}><Save size={16} /></IconButton>
                        <IconButton label="Cancelar edição" onClick={() => setUsuarioEditandoId(null)}><X size={16} /></IconButton>
                        {!usuario.isMaster && <IconButton label={`Excluir ${usuario.login}`} danger onClick={() => abrirExclusaoUsuario(usuario)} disabled={String(usuario.id) === usuarioAtualId || acaoEmAndamento === usuario.id}><Trash2 size={16} /></IconButton>}
                      </>
                    ) : (
                      <>
                        <span style={userTypeStyle}>{isMaster && usuario.isMaster ? "Master" : usuario.tipo}</span>
                        {adminAutorizado && (!usuario.isMaster || isMaster) && <IconButton label={`Editar ${usuario.login}`} onClick={() => iniciarEdicaoUsuario(usuario)}><Pencil size={16} /></IconButton>}
                        {adminAutorizado && !usuario.isMaster && <IconButton label={`Excluir ${usuario.login}`} danger onClick={() => abrirExclusaoUsuario(usuario)} disabled={String(usuario.id) === usuarioAtualId || acaoEmAndamento === usuario.id}><Trash2 size={16} /></IconButton>}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {erroUsuario && <p role="alert" style={formErrorStyle}>{erroUsuario}</p>}
              {sucessoUsuario && <p role="status" style={formSuccessStyle}>{sucessoUsuario}</p>}
            </CadastroLista>
          </section>
        ) : cadastroVisivel === "clientes" ? (
          <section style={sectionStyle} aria-label="Cadastro de clientes">
            <div style={sectionHeadingStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Novo cliente</h2>
                <p style={sectionSubtitleStyle}>Cadastre o cliente e seu tenant de acesso.</p>
              </div>
            </div>

            {adminAutorizado ? <form onSubmit={cadastrarCliente} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Nome</span>
                <input
                  value={nomeCliente}
                  onChange={(event) => { setNomeCliente(event.target.value); setErroCliente(""); }}
                  placeholder="Nome do cliente"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Tenant</span>
                <input
                  value={tenant}
                  onChange={(event) => { setTenant(event.target.value); setErroCliente(""); }}
                  placeholder="Identificador do tenant"
                  required
                  style={inputStyle}
                />
              </label>

              <ColorField label="Cor do cliente" value={corCliente} onChange={setCorCliente} />

              <button type="submit" style={primaryButtonStyle}>
                <Plus size={17} />
                Cadastrar cliente
              </button>
              {erroCliente && <p role="alert" style={formErrorStyle}>{erroCliente}</p>}
            </form> : <p role={erroAutorizacao ? "alert" : "status"} style={accessNoticeStyle}>
              {carregandoAutorizacao ? "Validando permissões..." : erroAutorizacao || "Somente administradores podem cadastrar ou alterar clientes."}
            </p>}

            <CadastroLista
              titulo="Clientes cadastrados"
              vazio="Nenhum cliente cadastrado."
              quantidade={clientes.length}
              quantidadeLabel={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
            >
              {clientes.map((cliente) => (
                <div key={cliente.id} className={clienteEditandoId === cliente.id ? undefined : "settings-client-row"} style={clienteEditandoId === cliente.id ? listItemStyle : undefined}>
                  {clienteEditandoId === cliente.id ? (
                    <div style={editGridStyle}>
                      <input aria-label="Nome do cliente" value={clienteEditandoNome} onChange={(event) => setClienteEditandoNome(event.target.value)} style={compactInputStyle} />
                      <input aria-label="Tenant do cliente" value={clienteEditandoTenant} onChange={(event) => setClienteEditandoTenant(event.target.value)} style={compactInputStyle} />
                      <ColorField label="Cor" value={clienteEditandoCor} onChange={setClienteEditandoCor} compact />
                    </div>
                  ) : (
                    <>
                    <div className="settings-client-identity">
                      <span className="settings-client-avatar" style={{ color: PALETAS_BADGE_ROBO[cliente.cor].texto, background: PALETAS_BADGE_ROBO[cliente.cor].fundo, borderColor: PALETAS_BADGE_ROBO[cliente.cor].borda }}>{cliente.nome.trim().charAt(0).toUpperCase() || "C"}</span>
                      <div className="settings-client-copy"><strong>{cliente.nome}</strong><span>{cliente.tenant}</span></div>
                      <span style={{ ...clientColorBadgeStyle, color: PALETAS_BADGE_ROBO[cliente.cor].texto, background: PALETAS_BADGE_ROBO[cliente.cor].fundo, borderColor: PALETAS_BADGE_ROBO[cliente.cor].borda }}>Cor do cliente</span>
                    </div>
                    <ClientMetricCell icon={<Bot size={17} />} value={clientMetrics[cliente.id]?.robots ?? 0} label="Robôs" tone="blue" loading={loadingClientMetrics} />
                    <ClientMetricCell icon={<GitFork size={17} />} value={clientMetrics[cliente.id]?.flows ?? 0} label="Fluxos" tone="purple" loading={loadingClientMetrics} />
                    <ClientMetricCell icon={<FileText size={17} />} value={clientMetrics[cliente.id]?.documents ?? 0} label="Documentos" tone="green" loading={loadingClientMetrics} />
                    <div className="settings-client-updated"><Clock3 size={13} /><span>Atualizado em<strong>{formatClientMetricDate(clientMetrics[cliente.id]?.updatedAt)}</strong></span></div>
                    </>
                  )}
                  {adminAutorizado && (
                    <div style={itemActionsStyle}>
                      {clienteEditandoId === cliente.id ? (
                        <>
                          <IconButton label="Salvar cliente" onClick={() => void salvarCliente(cliente.id)}><Save size={16} /></IconButton>
                          <IconButton label="Cancelar edição" onClick={() => setClienteEditandoId(null)}><X size={16} /></IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton label={`Editar ${cliente.nome}`} onClick={() => iniciarEdicaoCliente(cliente)}><Pencil size={16} /></IconButton>
                          {isMaster && <IconButton label={`Excluir ${cliente.nome}`} danger onClick={() => abrirExclusaoCliente(cliente)}><Trash2 size={16} /></IconButton>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {clientMetricsError && <p role="alert" style={formErrorStyle}>{clientMetricsError}</p>}
              {erroCliente && <p role="alert" style={formErrorStyle}>{erroCliente}</p>}
            </CadastroLista>
          </section>
        ) : cadastroVisivel === "cadastros" ? (
          <RobotCatalogSettings canManage={isMaster || accessPermissions.includes("robot_catalog.manage")} />
        ) : (
          <AccessControlCenter
            roles={permissionRoles}
            permissions={permissions}
            loading={loadingPermissions}
            error={permissionsError}
            onSaved={setPermissions}
          />
        )}
      </div>
      {clienteExcluindoId && (() => {
        const cliente = clientes.find((item) => item.id === clienteExcluindoId);
        const vinculados = usuariosGerenciados.filter((usuario) => usuario.clienteId === clienteExcluindoId);
        return <div className="settings-client-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !excluindoCliente) setClienteExcluindoId(null); }}>
          <section className="settings-client-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-client-delete-title">
            <header><div><span>EXCLUSÃO DE CLIENTE</span><h2 id="settings-client-delete-title">Arquivar {cliente?.nome ?? "cliente"}</h2></div><button type="button" disabled={excluindoCliente} aria-label="Fechar" onClick={() => setClienteExcluindoId(null)}><X size={17} /></button></header>
            <p>{vinculados.length === 0 ? "Este cliente não possui usuários ativos vinculados." : `${vinculados.length} ${vinculados.length === 1 ? "usuário está vinculado" : "usuários estão vinculados"} a este cliente.`}</p>
            {vinculados.length > 0 && <div className="settings-client-delete-users">{vinculados.map((usuario) => <span key={usuario.id}>{usuario.login}<small>{usuario.tipo}</small></span>)}</div>}
            <label><span>Destino dos usuários vinculados</span><select value={clienteSubstitutoId} onChange={(event) => setClienteSubstitutoId(event.target.value)}><option value="">Sem cliente — remover vínculo</option>{clientes.filter((item) => item.id !== clienteExcluindoId).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><small>Todos os usuários listados serão atualizados na mesma transação.</small></label>
            <div className="settings-client-delete-warning">Robôs ativos continuam bloqueando a exclusão. Dados históricos não serão removidos.</div>
            {erroCliente && <div className="settings-client-delete-error" role="alert">{erroCliente}</div>}
            <footer><button type="button" disabled={excluindoCliente} onClick={() => setClienteExcluindoId(null)}>Cancelar</button><button type="button" className="is-danger" disabled={excluindoCliente} onClick={() => void confirmarExclusaoCliente()}><Trash2 size={14} />{excluindoCliente ? "Arquivando..." : "Remapear e arquivar"}</button></footer>
          </section>
        </div>;
      })()}
      {usuarioExcluindo && <div className="settings-client-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && acaoEmAndamento !== usuarioExcluindo.id) setUsuarioExcluindo(null); }}>
        <section className="settings-client-delete-dialog settings-user-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-user-delete-title">
          <header><div><span>EXCLUSÃO DE USUÁRIO</span><h2 id="settings-user-delete-title">Excluir {usuarioExcluindo.login}?</h2></div><button type="button" disabled={acaoEmAndamento === usuarioExcluindo.id} aria-label="Fechar" onClick={() => setUsuarioExcluindo(null)}><X size={17} /></button></header>
          <div className="settings-user-delete-identity"><span>{usuarioExcluindo.login.trim().charAt(0).toUpperCase() || "U"}</span><div><strong>{usuarioExcluindo.login}</strong><small>{usuarioExcluindo.email || "Email não informado"} · {usuarioExcluindo.tipo}</small></div></div>
          <p>O usuário perderá o acesso ao Robot Center. O perfil será arquivado para preservar históricos e registros de auditoria.</p>
          <div className="settings-client-delete-warning">Esta ação não pode ser desfeita pela interface.</div>
          {erroUsuario && <div className="settings-client-delete-error" role="alert">{erroUsuario}</div>}
          <footer><button type="button" disabled={acaoEmAndamento === usuarioExcluindo.id} onClick={() => setUsuarioExcluindo(null)}>Cancelar</button><button type="button" className="is-danger" disabled={acaoEmAndamento === usuarioExcluindo.id} onClick={() => void removerUsuario(usuarioExcluindo)}><Trash2 size={14} />{acaoEmAndamento === usuarioExcluindo.id ? "Excluindo..." : "Excluir usuário"}</button></footer>
        </section>
      </div>}
    </AppShell>
  );
}

function PermissionsPanel({ roles, permissions, loading, error, isMaster, onSaved }: {
  roles: PermissionRole[];
  permissions: PermissionItem[];
  loading: boolean;
  error: string;
  isMaster: boolean;
  onSaved: (permissions: PermissionItem[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  useEffect(() => {
    setDraft(Object.fromEntries(permissions.map((permission) => [permission.id, [...permission.roles]])));
  }, [permissions]);

  const filteredPermissions = permissions.filter((permission) => {
    const term = permissionSearch.trim().toLocaleLowerCase("pt-BR");
    return (!term || `${permission.codigo} ${permission.descricao ?? ""} ${resourceLabel(permission.recurso)}`.toLocaleLowerCase("pt-BR").includes(term))
      && (selectedRole === "all" || (draft[permission.id] ?? permission.roles).includes(selectedRole));
  });
  const groups = filteredPermissions.reduce<Record<string, PermissionItem[]>>((result, permission) => {
    (result[permission.recurso] ??= []).push(permission);
    return result;
  }, {});
  const visibleRoles = selectedRole === "all" ? roles : roles.filter((role) => role.codigo === selectedRole);
  const pendingChanges = permissions.reduce((total, permission) => total + roles.filter((role) => permission.roles.includes(role.codigo) !== (draft[permission.id] ?? []).includes(role.codigo)).length, 0);
  const canEdit = (permission: PermissionItem, role: PermissionRole) => {
    if (permission.codigo === "robots.duplicate") return false;
    if (role.codigo === "master") return false;
    if (permission.recurso === "stack_requests" && ["cliente", "suporte"].includes(role.codigo)) return false;
    if (role.codigo === "cliente" && CLIENT_ROLE_BLOCKED_PERMISSIONS.has(permission.codigo)) return false;
    return true;
  };
  const toggleRole = (permissionId: string, roleCode: string) => setDraft((current) => {
    const selected = new Set(current[permissionId] ?? []);
    if (selected.has(roleCode)) selected.delete(roleCode); else selected.add(roleCode);
    return { ...current, [permissionId]: [...selected] };
  });
  const cancelEditing = () => {
    setDraft(Object.fromEntries(permissions.map((permission) => [permission.id, [...permission.roles]])));
    setEditing(false);
    setSaveError("");
  };
  const savePermissions = async () => {
    const changes = permissions.flatMap((permission) => roles.flatMap((role) => {
      if (!canEdit(permission, role)) return [];
      const before = permission.roles.includes(role.codigo);
      const enabled = (draft[permission.id] ?? []).includes(role.codigo);
      return before === enabled ? [] : [{ permissionId: permission.id, roleId: role.id, enabled }];
    }));
    if (!changes.length) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar as permissões.");
      const updated = permissions.map((permission) => ({ ...permission, roles: [...(draft[permission.id] ?? [])] }));
      onSaved(updated);
      setEditing(false);
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  };

  return <section style={sectionStyle} aria-label="Painel de permissões">
    <div style={sectionHeadingStyle}>
      <div><h2 style={sectionTitleStyle}>{isMaster ? "Painel do administrador Master" : "Painel do administrador"}</h2><p style={sectionSubtitleStyle}>Mapa completo das liberações por área e dos perfis autorizados.</p></div>
      <div style={permissionHeaderActionsStyle}>
        <span style={isMaster ? masterBadgeStyle : adminBadgeStyle}><ShieldCheck size={14} /> {isMaster ? "Acesso Master" : "Acesso Admin"}</span>
        {editing ? <>
          <button type="button" style={secondaryActionStyle} onClick={cancelEditing} disabled={saving}><X size={14} /> Cancelar</button>
          <button type="button" style={primaryActionStyle} onClick={() => void savePermissions()} disabled={saving}><Save size={14} /> {saving ? "Salvando..." : `Salvar alterações${pendingChanges ? ` (${pendingChanges})` : ""}`}</button>
        </> : <button type="button" style={secondaryActionStyle} onClick={() => { setEditing(true); setSaveError(""); }}><Pencil size={14} /> Editar permissões</button>}
      </div>
    </div>
    {loading && <p style={accessNoticeStyle}>Carregando mapa de permissões...</p>}
    {error && <p role="alert" style={formErrorStyle}>{error}</p>}
    {saveError && <p role="alert" style={formErrorStyle}>{saveError}</p>}
    {!loading && !error && <>
      <div style={permissionToolbarStyle}><label style={permissionSearchStyle}><Search size={14} /><input style={permissionSearchInputStyle} value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Buscar permissão ou módulo" /></label><button type="button" style={selectedRole === "all" ? selectedRoleFilterStyle : roleFilterStyle} onClick={() => setSelectedRole("all")}>Todos os perfis</button></div>
      <div style={roleSummaryStyle}>
        {roles.map((role) => <button type="button" key={role.id} style={{ ...roleCardStyle, ...(selectedRole === role.codigo ? selectedRoleCardStyle : {}) }} title={role.descricao ?? undefined} onClick={() => setSelectedRole((current) => current === role.codigo ? "all" : role.codigo)}>
          <span style={roleCardIconStyle}><ShieldCheck size={12} /></span>
          <div style={roleCardContentStyle}><strong style={roleCardTitleStyle}>{role.nome}</strong><span style={roleCardDescriptionStyle}>{role.descricao}</span></div>
        </button>)}
      </div>
      <div style={permissionGroupsStyle}>
        {Object.entries(groups).map(([resource, items]) => <article key={resource} style={permissionGroupStyle}>
          <header style={permissionGroupHeaderStyle}><KeyRound size={15} /><strong>{resourceLabel(resource)}</strong></header>
          <div>
            {items.map((permission) => <div key={permission.id} style={permissionRowStyle}>
              <div style={permissionIdentityStyle}><strong>{permission.descricao || permission.acao}</strong><span>{permission.codigo}</span></div>
              <div style={permissionRolesStyle}>{editing
                ? visibleRoles.map((role) => <label key={role.id} style={{ ...permissionRoleOptionStyle, ...((draft[permission.id] ?? []).includes(role.codigo) ? selectedPermissionRoleStyle : {}), ...(!canEdit(permission, role) ? disabledPermissionRoleStyle : {}) }} title={!canEdit(permission, role) ? permission.codigo === "robots.duplicate" ? "A duplicação de robôs é exclusiva de Admin e Master." : role.codigo === "master" ? "As permissões do Master são protegidas." : role.codigo === "cliente" && CLIENT_ROLE_BLOCKED_PERMISSIONS.has(permission.codigo) ? "Use a liberação individual no cadastro do usuário Cliente." : "Este perfil não pode acessar Solicitações de Stack." : undefined}>
                    <input type="checkbox" checked={(draft[permission.id] ?? []).includes(role.codigo)} disabled={!canEdit(permission, role) || saving} onChange={() => toggleRole(permission.id, role.codigo)} style={permissionCheckboxStyle} />
                    {role.nome}
                  </label>)
                : visibleRoles.map((role) => {
                    const allowed = permission.roles.includes(role.codigo);
                    return <span key={role.id} style={allowed ? rolePillStyle : unselectedRolePillStyle} aria-label={`${role.nome}: ${allowed ? "permitido" : "não permitido"}`}>{role.nome}</span>;
                  })}
              </div>
            </div>)}
          </div>
        </article>)}
      </div>
    </>}
  </section>;
}

function resourceLabel(resource: string) {
  const labels: Record<string, string> = {
    access_control: "Controle de acesso", budgets: "Orçamentos", clients: "Clientes", dashboard: "Dashboard", flows: "Fluxos",
    publications: "Publicações", robot_center_documentation: "Documentação Robot Center", robots: "Robôs",
    settings: "Configurações", robot_catalog: "Cadastros", tutorials: "Tutoriais", users: "Usuários",
    stack_requests: "Solicitações de Stack",
  };
  return labels[resource] ?? resource.replaceAll("_", " ");
}

function ColorField({ label, value, onChange, compact = false }: { label: string; value: CorBadgeRobo; onChange: (value: CorBadgeRobo) => void; compact?: boolean }) {
  return (
    <div style={{ ...fieldStyle, ...(compact ? { alignSelf: "center" } : {}) }}>
      <span style={labelStyle}>{label}</span>
      <div role="radiogroup" aria-label={label} style={colorOptionsStyle}>
        {CORES_BADGE_ROBO.map((cor) => {
          const palette = PALETAS_BADGE_ROBO[cor];
          return (
      <button
        key={cor}
        type="button"
        className={`shared-color-option${value === cor ? " is-selected" : ""}`}
        role="radio"
              aria-checked={value === cor}
              aria-label={cor}
              title={cor}
              onClick={() => onChange(cor)}
              style={{
                ...colorButtonStyle,
                color: palette.texto,
                background: palette.fundo,
                borderColor: value === cor ? palette.texto : palette.borda,
                boxShadow: value === cor ? `0 0 0 2px ${palette.borda}` : "none",
              }}
            >
              <span style={{ ...colorDotStyle, background: palette.texto }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
  label,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{ ...iconButtonStyle, ...(danger ? dangerButtonStyle : {}), ...(disabled ? disabledButtonStyle : {}) }}
    >
      {children}
    </button>
  );
}

function ClientMetricCell({ icon, value, label, tone, loading }: { icon: React.ReactNode; value: number; label: string; tone: "blue" | "purple" | "green"; loading: boolean }) {
  return <div className={`settings-client-metric is-${tone}`}>
    <span>{icon}</span>
    <div><strong>{loading ? "—" : value}</strong><small>{label}</small></div>
  </div>;
}

function formatClientMetricDate(value?: string) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function CadastroLista({
  titulo,
  vazio,
  quantidade,
  quantidadeLabel,
  children,
}: {
  titulo: string;
  vazio: string;
  quantidade: number;
  quantidadeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={listSectionStyle}>
      <div style={listHeaderStyle}>
        <h3 style={listTitleStyle}>{titulo}</h3>
        <span style={countStyle}>{quantidadeLabel ?? quantidade}</span>
      </div>
      {quantidade === 0 ? <p style={emptyStyle}>{vazio}</p> : <div style={listStyle}>{children}</div>}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
  width: "100%",
  maxWidth: 1480,
  margin: "0 auto",
};

const pageHeaderStyle: React.CSSProperties = { display: "grid", gap: 0 };
const pageEyebrowStyle: React.CSSProperties = { color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: "1.3px" };

const titleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "var(--text-strong)",
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "var(--muted)",
  fontSize: 14,
};

const masterBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", border: "1px solid color-mix(in srgb, var(--accent) 42%, var(--border))", borderRadius: 999, color: "var(--accent)", background: "var(--accent-soft)", fontSize: 11, fontWeight: 750 };
const adminBadgeStyle: React.CSSProperties = { ...masterBadgeStyle, color: "var(--text-2)", background: "var(--surface)", borderColor: "var(--border)" };
const permissionHeaderActionsStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8 };
const secondaryActionStyle: React.CSSProperties = { display: "inline-flex", minHeight: 34, alignItems: "center", justifyContent: "center", gap: 7, padding: "0 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 11, fontWeight: 700, cursor: "pointer" };
const primaryActionStyle: React.CSSProperties = { ...secondaryActionStyle, borderColor: "var(--accent)", background: "var(--accent)", color: "var(--on-accent)" };
const roleSummaryStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, padding: "11px 18px", borderBottom: "1px solid var(--separator)", background: "color-mix(in srgb, var(--surface) 38%, transparent)" };
const roleCardStyle: React.CSSProperties = { display: "flex", minWidth: 0, maxWidth: 225, alignItems: "center", gap: 7, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", color: "var(--text-2)", textAlign: "left", cursor: "pointer" };
const selectedRoleCardStyle: React.CSSProperties = { borderColor: "var(--accent)", background: "var(--accent-soft)" };
const permissionToolbarStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 18px 0" };
const permissionSearchStyle: React.CSSProperties = { display: "flex", minWidth: 260, flex: "1 1 320px", alignItems: "center", gap: 8, minHeight: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", background: "var(--surface)" };
const permissionSearchInputStyle: React.CSSProperties = { width: "100%", border: 0, outline: 0, background: "transparent", color: "var(--text)", fontSize: 11 };
const roleFilterStyle: React.CSSProperties = { minHeight: 34, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", color: "var(--text-2)", fontSize: 10, fontWeight: 700, cursor: "pointer" };
const selectedRoleFilterStyle: React.CSSProperties = { ...roleFilterStyle, borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" };
const roleCardIconStyle: React.CSSProperties = { display: "inline-grid", width: 24, height: 24, placeItems: "center", flex: "0 0 auto", borderRadius: 6, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)" };
const roleCardContentStyle: React.CSSProperties = { display: "grid", minWidth: 0, gap: 1 };
const roleCardTitleStyle: React.CSSProperties = { color: "var(--text-strong)", fontSize: 10.5, lineHeight: 1.2 };
const roleCardDescriptionStyle: React.CSSProperties = { overflow: "hidden", color: "var(--muted)", fontSize: 9, lineHeight: 1.2, textOverflow: "ellipsis", whiteSpace: "nowrap" };
const permissionGroupsStyle: React.CSSProperties = { display: "grid", gap: 12, padding: 18 };
const permissionGroupStyle: React.CSSProperties = { overflow: "hidden", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" };
const permissionGroupHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", color: "var(--accent)", background: "var(--surface)", borderBottom: "1px solid var(--separator)" };
const permissionRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", alignItems: "center", gap: 14, padding: "11px 13px", borderBottom: "1px solid var(--separator)" };
const permissionIdentityStyle: React.CSSProperties = { display: "grid", gap: 4 };
const permissionRolesStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 };
const permissionRoleOptionStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text-2)", fontSize: 10, fontWeight: 700, cursor: "pointer" };
const selectedPermissionRoleStyle: React.CSSProperties = { color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 55%, var(--border))", background: "var(--accent-soft)" };
const disabledPermissionRoleStyle: React.CSSProperties = { cursor: "not-allowed", opacity: 0.48 };
const permissionCheckboxStyle: React.CSSProperties = { width: 14, height: 14, margin: 0, accentColor: "var(--accent)" };
const rolePillStyle: React.CSSProperties = { padding: "4px 7px", borderRadius: 999, color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 38%, var(--border))", fontSize: 10, fontWeight: 700 };
const unselectedRolePillStyle: React.CSSProperties = { ...rolePillStyle, color: "var(--muted)", background: "var(--surface)", borderColor: "var(--border)", opacity: 0.7 };

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--card)",
  boxShadow: "var(--shadow)",
};

const sectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "20px 22px",
  borderBottom: "1px solid var(--separator)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--text-strong)",
  fontSize: 18,
  fontWeight: 700,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "var(--muted)",
  fontSize: 13,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  alignItems: "end",
  padding: 22,
  borderBottom: "1px solid var(--separator)",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const permissionToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  minHeight: 42,
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 9,
  background: "var(--surface)",
  color: "var(--text-2)",
  cursor: "pointer",
};

const compactPermissionToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
  color: "var(--text-2)",
  fontSize: 12,
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0 12px",
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 42,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  background: "var(--accent)",
  color: "var(--on-accent)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const listSectionStyle: React.CSSProperties = {
  padding: 22,
};

const listHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const listTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--text-strong)",
  fontSize: 15,
  fontWeight: 700,
};

const countStyle: React.CSSProperties = {
  display: "inline-flex",
  minWidth: 24,
  height: 24,
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  borderRadius: 999,
  background: "var(--accent-soft)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 700,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 16,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  minHeight: 48,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0 14px",
  background: "var(--surface)",
};

const itemNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--text-strong)",
  fontSize: 14,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemContentStyle: React.CSSProperties = {
  display: "flex",
  minWidth: 0,
  flex: 1,
  alignItems: "center",
  gap: 12,
};

const itemSecondaryStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--muted)",
  fontSize: 12,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemActionsStyle: React.CSSProperties = {
  display: "flex",
  flex: "0 0 auto",
  alignItems: "center",
  gap: 8,
};

const editGridStyle: React.CSSProperties = {
  display: "grid",
  minWidth: 0,
  flex: 1,
  gridTemplateColumns: "repeat(2, minmax(150px, 1fr))",
  gap: 8,
  padding: "8px 0",
};

const compactInputStyle: React.CSSProperties = {
  ...inputStyle,
  height: 36,
  fontSize: 13,
};

const iconButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 34,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--border)",
  borderRadius: 7,
  background: "var(--card)",
  color: "var(--text)",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  borderColor: "var(--danger)",
  background: "var(--danger-soft)",
  color: "var(--danger)",
};

const disabledButtonStyle: React.CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.45,
};

const userTypeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  borderRadius: 999,
  padding: "4px 9px",
  border: "1px solid var(--border)",
  background: "var(--accent-soft)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 700,
};

const tenantStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "var(--muted)",
  fontSize: 13,
};

const clientColorBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 750,
};

const colorOptionsStyle: React.CSSProperties = {
  display: "flex",
  minHeight: 36,
  alignItems: "center",
  gap: 7,
  flexWrap: "nowrap",
};

const colorButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 30,
  height: 30,
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid",
  borderRadius: 9,
  cursor: "pointer",
};

const colorDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
};

const emptyStyle: React.CSSProperties = {
  margin: "16px 0 0",
  color: "var(--faint)",
  fontSize: 13,
};

const formErrorStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  margin: 0,
  color: "var(--danger)",
  fontSize: 12,
};

const formSuccessStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  margin: 0,
  color: "var(--success)",
  fontSize: 12,
};

const accessNoticeStyle: React.CSSProperties = {
  margin: 0,
  padding: 22,
  borderBottom: "1px solid var(--separator)",
  color: "var(--muted)",
  fontSize: 13,
};
