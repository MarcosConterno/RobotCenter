"use client";

import { Building2, Plus, Users } from "lucide-react";
import { useState } from "react";

import AppShell from "@/components/layout/AppShell";
import { useAppData } from "@/data/AppDataProvider";
import { TIPOS_USUARIO, type TipoUsuario } from "@/domain/entities";
import { dadosCadastroClienteSchema, dadosCadastroUsuarioSchema, primeiraMensagemErro } from "@/domain/validation";

type CadastroAtivo = "usuarios" | "clientes";

export default function ConfiguracoesPage() {
  const {
    usuarios,
    clientes,
    cadastrarCliente: adicionarCliente,
  } = useAppData();
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
    } catch {
      setErroUsuario("Não foi possível comunicar com o servidor.");
    } finally {
      setSalvandoUsuario(false);
    }
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

            <form onSubmit={cadastrarUsuario} style={formStyle}>
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
            </form>

            <CadastroLista
              titulo="Usuários cadastrados"
              vazio="Nenhum usuário cadastrado."
              quantidade={usuarios.length}
            >
              {usuarios.map((usuario) => (
                <div key={usuario.id} style={listItemStyle}>
                  <span style={itemNameStyle}>{usuario.login}</span>
                  <span style={userTypeStyle}>{usuario.tipo}</span>
                </div>
              ))}
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

            <form onSubmit={cadastrarCliente} style={formStyle}>
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
            </form>

            <CadastroLista
              titulo="Clientes cadastrados"
              vazio="Nenhum cliente cadastrado."
              quantidade={clientes.length}
            >
              {clientes.map((cliente) => (
                <div key={cliente.id} style={listItemStyle}>
                  <span style={itemNameStyle}>{cliente.nome}</span>
                  <span style={tenantStyle}>{cliente.tenant}</span>
                </div>
              ))}
            </CadastroLista>
          </section>
        )}
      </div>
    </AppShell>
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
  maxWidth: 1000,
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto",
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
