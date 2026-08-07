"use client";

import { Building2, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import { useAdminAccess } from "@/auth/AdminAccessProvider";
import { useAppData } from "@/data/AppDataProvider";
import { TIPOS_USUARIO, type TipoUsuario, type Usuario } from "@/domain/entities";
import { dadosCadastroClienteSchema, dadosCadastroUsuarioSchema, primeiraMensagemErro } from "@/domain/validation";

type CadastroAtivo = "usuarios" | "clientes";

export default function ConfiguracoesPage() {
  const {
    clientes,
    cadastrarCliente: adicionarCliente,
    atualizarCliente,
    excluirCliente,
  } = useAppData();
  const { isAdmin: adminAutorizado, status: statusAutorizacao, error: erroAutorizacao } = useAdminAccess();
  const carregandoAutorizacao = statusAutorizacao === "loading";
  const [cadastroAtivo, setCadastroAtivo] = useState<CadastroAtivo>("usuarios");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>("Operador");
  const [nomeCliente, setNomeCliente] = useState("");
  const [tenant, setTenant] = useState("");
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
  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);
  const [clienteEditandoNome, setClienteEditandoNome] = useState("");
  const [clienteEditandoTenant, setClienteEditandoTenant] = useState("");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | number | null>(null);

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

  async function cadastrarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = dadosCadastroUsuarioSchema.safeParse({ login, email, senha, tipo: tipoUsuario });
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
    setErroUsuario("");
    setSucessoUsuario("");
  }

  async function salvarUsuario(usuarioId: string | number) {
    const identificador = String(usuarioId);
    const loginNormalizado = usuarioEditandoLogin.trim();
    const emailNormalizado = usuarioEditandoEmail.trim();
    if (!loginNormalizado || !emailNormalizado) {
      setErroUsuario("Informe o login e o email do usuário.");
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
    if (!window.confirm(`Excluir o usuário ${usuario.login}? O acesso será desativado.`)) return;

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
    setErroCliente("");
  }

  function salvarCliente(clienteId: string) {
    const result = dadosCadastroClienteSchema.safeParse({
      nome: clienteEditandoNome,
      tenant: clienteEditandoTenant,
    });
    if (!result.success) {
      setErroCliente(primeiraMensagemErro(result.error));
      return;
    }

    atualizarCliente(clienteId, result.data);
    setClienteEditandoId(null);
    setErroCliente("");
  }

  function removerCliente(cliente: (typeof clientes)[number]) {
    if (!window.confirm(`Excluir o cliente ${cliente.nome}?`)) return;
    if (!excluirCliente(cliente.id)) {
      setErroCliente("O cliente não pode ser excluído porque possui robôs vinculados.");
      return;
    }
    setErroCliente("");
  }

  function cadastrarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = dadosCadastroClienteSchema.safeParse({ nome: nomeCliente, tenant });
    if (!result.success) {
      setErroCliente(primeiraMensagemErro(result.error));
      return;
    }

    adicionarCliente(result.data);
    setNomeCliente("");
    setTenant("");
    setErroCliente("");
  }

  return (
    <AppShell title="Configurações">
      <div style={pageStyle}>
        <div>
          <h1 style={titleStyle}>Cadastros</h1>
          <p style={subtitleStyle}>Gerencie usuários e clientes do Robot Center.</p>
        </div>

        <div style={tabsStyle} role="tablist" aria-label="Tipos de cadastro">
          <button
            type="button"
            role="tab"
            aria-selected={cadastroAtivo === "usuarios"}
            onClick={() => setCadastroAtivo("usuarios")}
            style={{ ...tabStyle, ...(cadastroAtivo === "usuarios" ? activeTabStyle : {}) }}
          >
            <Users size={17} />
            Usuários
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cadastroAtivo === "clientes"}
            onClick={() => setCadastroAtivo("clientes")}
            style={{ ...tabStyle, ...(cadastroAtivo === "clientes" ? activeTabStyle : {}) }}
          >
            <Building2 size={17} />
            Clientes
          </button>
        </div>

        {cadastroAtivo === "usuarios" ? (
          <section style={sectionStyle} aria-label="Cadastro de usuários">
            <div style={sectionHeadingStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Novo usuário</h2>
                <p style={sectionSubtitleStyle}>Defina o acesso e o perfil de utilização.</p>
              </div>
            </div>

            {adminAutorizado ? <form onSubmit={cadastrarUsuario} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Login</span>
                <input
                  value={login}
                  onChange={(event) => { setLogin(event.target.value); setErroUsuario(""); setSucessoUsuario(""); }}
                  placeholder="nome.sobrenome"
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
                onChange={(event) => { setTipoUsuario(event.target.value as TipoUsuario); setErroUsuario(""); setSucessoUsuario(""); }}
                  style={inputStyle}
                >
                  {TIPOS_USUARIO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </label>

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
                      <input aria-label="Login" value={usuarioEditandoLogin} onChange={(event) => setUsuarioEditandoLogin(event.target.value)} style={compactInputStyle} />
                      <input aria-label="Email" type="email" value={usuarioEditandoEmail} onChange={(event) => setUsuarioEditandoEmail(event.target.value)} style={compactInputStyle} />
                      <select aria-label="Tipo de usuário" value={usuarioEditandoTipo} onChange={(event) => setUsuarioEditandoTipo(event.target.value as TipoUsuario)} style={compactInputStyle}>
                        {TIPOS_USUARIO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div style={itemContentStyle}>
                      <span style={itemNameStyle}>{usuario.login}</span>
                      {usuario.email && <span style={itemSecondaryStyle}>{usuario.email}</span>}
                    </div>
                  )}
                  <div style={itemActionsStyle}>
                    {usuarioEditandoId === usuario.id ? (
                      <>
                        <IconButton label="Salvar usuário" onClick={() => void salvarUsuario(usuario.id)} disabled={acaoEmAndamento === usuario.id}><Save size={16} /></IconButton>
                        <IconButton label="Cancelar edição" onClick={() => setUsuarioEditandoId(null)}><X size={16} /></IconButton>
                      </>
                    ) : (
                      <>
                        <span style={userTypeStyle}>{usuario.tipo}</span>
                        {adminAutorizado && <IconButton label={`Editar ${usuario.login}`} onClick={() => iniciarEdicaoUsuario(usuario)}><Pencil size={16} /></IconButton>}
                        {adminAutorizado && <IconButton label={`Excluir ${usuario.login}`} danger onClick={() => void removerUsuario(usuario)} disabled={String(usuario.id) === usuarioAtualId || acaoEmAndamento === usuario.id}><Trash2 size={16} /></IconButton>}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {erroUsuario && <p role="alert" style={formErrorStyle}>{erroUsuario}</p>}
              {sucessoUsuario && <p role="status" style={formSuccessStyle}>{sucessoUsuario}</p>}
            </CadastroLista>
          </section>
        ) : (
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
            >
              {clientes.map((cliente) => (
                <div key={cliente.id} style={listItemStyle}>
                  {clienteEditandoId === cliente.id ? (
                    <div style={editGridStyle}>
                      <input aria-label="Nome do cliente" value={clienteEditandoNome} onChange={(event) => setClienteEditandoNome(event.target.value)} style={compactInputStyle} />
                      <input aria-label="Tenant do cliente" value={clienteEditandoTenant} onChange={(event) => setClienteEditandoTenant(event.target.value)} style={compactInputStyle} />
                    </div>
                  ) : (
                    <div style={itemContentStyle}>
                      <span style={itemNameStyle}>{cliente.nome}</span>
                      <span style={tenantStyle}>{cliente.tenant}</span>
                    </div>
                  )}
                  {adminAutorizado && (
                    <div style={itemActionsStyle}>
                      {clienteEditandoId === cliente.id ? (
                        <>
                          <IconButton label="Salvar cliente" onClick={() => salvarCliente(cliente.id)}><Save size={16} /></IconButton>
                          <IconButton label="Cancelar edição" onClick={() => setClienteEditandoId(null)}><X size={16} /></IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton label={`Editar ${cliente.nome}`} onClick={() => iniciarEdicaoCliente(cliente)}><Pencil size={16} /></IconButton>
                          <IconButton label={`Excluir ${cliente.nome}`} danger onClick={() => removerCliente(cliente)}><Trash2 size={16} /></IconButton>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {erroCliente && <p role="alert" style={formErrorStyle}>{erroCliente}</p>}
            </CadastroLista>
          </section>
        )}
      </div>
    </AppShell>
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

function CadastroLista({
  titulo,
  vazio,
  quantidade,
  children,
}: {
  titulo: string;
  vazio: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  return (
    <div style={listSectionStyle}>
      <div style={listHeaderStyle}>
        <h3 style={listTitleStyle}>{titulo}</h3>
        <span style={countStyle}>{quantidade}</span>
      </div>
      {quantidade === 0 ? <p style={emptyStyle}>{vazio}</p> : <div style={listStyle}>{children}</div>}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
  width: "100%",
  maxWidth: 1120,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#F8FAFC",
  fontSize: 30,
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#94A3B8",
  fontSize: 14,
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  alignSelf: "flex-start",
  gap: 4,
  padding: 4,
  border: "1px solid #273449",
  borderRadius: 12,
  background: "#111827",
};

const tabStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 38,
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "0 14px",
  background: "transparent",
  color: "#94A3B8",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const activeTabStyle: React.CSSProperties = {
  border: "1px solid rgba(124, 58, 237, 0.55)",
  background: "rgba(124, 58, 237, 0.16)",
  color: "#E9D5FF",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #273449",
  borderRadius: 14,
  background: "#111827",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.2)",
};

const sectionHeadingStyle: React.CSSProperties = {
  padding: "20px 22px",
  borderBottom: "1px solid #273449",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#F8FAFC",
  fontSize: 18,
  fontWeight: 700,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#94A3B8",
  fontSize: 13,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  alignItems: "end",
  padding: 22,
  borderBottom: "1px solid #273449",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  color: "#CBD5E1",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "0 12px",
  background: "#162130",
  color: "#FFF",
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
  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
  color: "#FFF",
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
  color: "#F8FAFC",
  fontSize: 15,
  fontWeight: 700,
};

const countStyle: React.CSSProperties = {
  display: "inline-flex",
  minWidth: 24,
  height: 24,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  background: "#223149",
  color: "#BFDBFE",
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
  border: "1px solid #273449",
  borderRadius: 8,
  padding: "0 14px",
  background: "#182233",
};

const itemNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "#F8FAFC",
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
  color: "#94A3B8",
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
  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
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
  border: "1px solid #334155",
  borderRadius: 7,
  background: "#162130",
  color: "#CBD5E1",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  borderColor: "rgba(239, 68, 68, 0.45)",
  background: "rgba(127, 29, 29, 0.24)",
  color: "#FCA5A5",
};

const disabledButtonStyle: React.CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.45,
};

const userTypeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  borderRadius: 999,
  padding: "4px 9px",
  background: "rgba(124, 58, 237, 0.18)",
  color: "#DDD6FE",
  fontSize: 12,
  fontWeight: 700,
};

const tenantStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "#94A3B8",
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  margin: "16px 0 0",
  color: "#64748B",
  fontSize: 13,
};

const formErrorStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  margin: 0,
  color: "#FCA5A5",
  fontSize: 12,
};

const formSuccessStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  margin: 0,
  color: "#86EFAC",
  fontSize: 12,
};

const accessNoticeStyle: React.CSSProperties = {
  margin: 0,
  padding: 22,
  borderBottom: "1px solid #273449",
  color: "#94A3B8",
  fontSize: 13,
};
