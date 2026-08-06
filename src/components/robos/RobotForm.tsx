"use client";

import { Bot, FileText, GitBranch, Layers3, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { RobotEnvironment, RobotFormData } from "@/types/robot";

interface RobotFormProps {
  nome?: string;
  sistema?: string;
  pacote?: string;
  ambiente?: RobotEnvironment;
  descricao?: string;
  stack?: string;
  fila?: string;
  versao?: string;
  responsavel?: string;
  ativo?: boolean;
  alteracaoRealizada?: string;
  regras?: string[];
  submitText?: string;
  isEdit?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  onSubmit?: (data: RobotFormData) => void;
}

export default function RobotForm({
  nome = "", sistema = "", pacote = "", ambiente = "Produção",
  descricao = "", stack = "", fila = "", versao = "",
  responsavel = "", ativo = true, alteracaoRealizada = "", regras = [], submitText = "Salvar",
  isEdit = false, onCancel, onDelete, onSubmit,
}: RobotFormProps) {
  const [form, setForm] = useState<RobotFormData>({
    nome, sistema, pacote, ambiente, descricao, stack, fila, versao, responsavel, ativo, alteracaoRealizada, regras,
  });

  useEffect(() => {
    setForm({ nome, sistema, pacote, ambiente, descricao, stack, fila, versao, responsavel, ativo, alteracaoRealizada, regras });
  }, [nome, sistema, pacote, ambiente, descricao, stack, fila, versao, responsavel, ativo, alteracaoRealizada, regras]);

  function update<K extends keyof RobotFormData>(field: K, value: RobotFormData[K]) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(form);
      }}
      style={formStyle}
    >
      <FormSection icon={<Bot size={17} />} title="Informações gerais" description="Identificação e finalidade do robô.">
        <div style={fieldsGridStyle}>
          <Field label="Nome" placeholder="Nome do robô" value={form.nome} onChange={(v) => update("nome", v)} />
          <Field label="Sistema" placeholder="Ex.: Allianz" value={form.sistema} onChange={(v) => update("sistema", v)} />
          <Field label="Pacote" placeholder="Ex.: Documentos" value={form.pacote} onChange={(v) => update("pacote", v)} />
          <Field label="Responsável" placeholder="Nome do responsável" value={form.responsavel} onChange={(v) => update("responsavel", v)} />
          <div style={fullWidthStyle}>
            <label style={labelStyle}>Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(event) => update("descricao", event.target.value)}
              rows={3}
              placeholder="Descreva a função e o objetivo deste robô"
              style={textareaStyle}
            />
          </div>
        </div>
      </FormSection>

      <div style={sectionsGridStyle}>
        <FormSection icon={<GitBranch size={17} />} title="Configuração" description="Ambiente e disponibilidade.">
          <div style={stackedFieldsStyle}>
            <div>
              <label style={labelStyle}>Ambiente</label>
              <select
                value={form.ambiente}
                onChange={(event) => update("ambiente", event.target.value as RobotEnvironment)}
                style={inputStyle}
              >
                <option>Produção</option>
                <option>Teste</option>
                <option>Desenvolvimento</option>
              </select>
            </div>

            <label style={statusControlStyle}>
              <span>
                <span style={statusTitleStyle}>Status do robô</span>
                <span style={statusDescriptionStyle}>{form.ativo ? "Disponível para execução" : "Execução desabilitada"}</span>
              </span>
              <span style={{ ...switchStyle, background: form.ativo ? "#7C3AED" : "#334155" }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => update("ativo", event.target.checked)}
                  style={hiddenCheckboxStyle}
                />
                <span style={{ ...switchKnobStyle, transform: form.ativo ? "translateX(18px)" : "translateX(0)" }} />
              </span>
            </label>
          </div>
        </FormSection>

        <FormSection icon={<Layers3 size={17} />} title="Informações técnicas" description="Tecnologia e integração.">
          <div style={fieldsGridStyle}>
            <Field label="Stack" placeholder="Ex.: .NET 8" value={form.stack} onChange={(v) => update("stack", v)} />
            <Field label="Versão" placeholder="Ex.: 1.0.0" value={form.versao} onChange={(v) => update("versao", v)} />
            <div style={fullWidthStyle}>
              <Field label="Fila" placeholder="Ex.: AWS SQS" value={form.fila} onChange={(v) => update("fila", v)} />
            </div>
          </div>
        </FormSection>
      </div>

      <FormSection icon={<FileText size={17} />} title="Documentação da alteração" description="Registre a atualização e as regras funcionais do robô.">
        <div style={stackedFieldsStyle}>
          <div>
            <label style={labelStyle}>Alteração realizada</label>
            <textarea
              value={form.alteracaoRealizada}
              onChange={(event) => update("alteracaoRealizada", event.target.value)}
              rows={3}
              placeholder="Descreva o que foi alterado nesta versão"
              style={textareaStyle}
            />
          </div>

          <div>
            <div style={rulesHeaderStyle}>
              <div>
                <span style={labelStyle}>Regras</span>
                <span style={rulesHintStyle}>A numeração é criada automaticamente.</span>
              </div>
              <button type="button" onClick={() => update("regras", [...form.regras, ""])} style={addRuleButtonStyle}>
                <Plus size={14} /> Adicionar regra
              </button>
            </div>

            <div style={rulesListStyle}>
              {form.regras.length === 0 && <div style={emptyRulesStyle}>Nenhuma regra cadastrada.</div>}
              {form.regras.map((regra, index) => (
                <div key={index} style={ruleRowStyle}>
                  <span style={ruleCodeStyle}>{`RF${String(index + 1).padStart(3, "0")}`}</span>
                  <input
                    value={regra}
                    onChange={(event) => update("regras", form.regras.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                    placeholder="Escreva a regra funcional"
                    style={ruleInputStyle}
                  />
                  <button
                    type="button"
                    aria-label={`Remover RF${String(index + 1).padStart(3, "0")}`}
                    onClick={() => update("regras", form.regras.filter((_, itemIndex) => itemIndex !== index))}
                    style={removeRuleButtonStyle}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <footer style={actionsStyle}>
        <div>
          {isEdit && (
            <button type="button" onClick={onDelete} style={deleteButtonStyle}>
              <Trash2 size={15} />
              Excluir robô
            </button>
          )}
        </div>
        <div style={rightActionsStyle}>
          <button type="button" onClick={onCancel} style={cancelButtonStyle}>Cancelar</button>
          <button type="submit" style={submitButtonStyle}>
            <Save size={15} />
            {submitText}
          </button>
        </div>
      </footer>
    </form>
  );
}

function FormSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <header style={sectionHeaderStyle}>
        <span style={sectionIconStyle}>{icon}</span>
        <span>
          <span style={sectionTitleStyle}>{title}</span>
          <span style={sectionDescriptionStyle}>{description}</span>
        </span>
      </header>
      <div style={sectionContentStyle}>{children}</div>
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const formStyle = { display: "flex", flexDirection: "column", gap: 16 } as const;
const sectionsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 } as const;
const fieldsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 } as const;
const stackedFieldsStyle = { display: "flex", flexDirection: "column", gap: 16 } as const;
const fullWidthStyle = { gridColumn: "1 / -1" } as const;
const sectionStyle = { background: "rgba(15,23,42,.55)", border: "1px solid #273449", borderRadius: 12, overflow: "hidden" } as const;
const sectionHeaderStyle = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #273449" } as const;
const sectionIconStyle = { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8, color: "#A78BFA", background: "rgba(124,58,237,.12)" } as const;
const sectionTitleStyle = { display: "block", color: "#F1F5F9", fontSize: 13, fontWeight: 700 } as const;
const sectionDescriptionStyle = { display: "block", color: "#7F91AA", fontSize: 11, marginTop: 2 } as const;
const sectionContentStyle = { padding: 14 } as const;
const labelStyle = { display: "block", color: "#A9B7CA", marginBottom: 6, fontWeight: 600, fontSize: 12 } as const;
const inputStyle = { width: "100%", height: 40, borderRadius: 8, border: "1px solid #334155", background: "#111B2B", color: "#F8FAFC", padding: "0 11px", outline: "none", boxSizing: "border-box" } as const;
const textareaStyle = { ...inputStyle, height: "auto", minHeight: 82, padding: 11, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 } as const;
const statusControlStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 11px", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", background: "#111B2B" } as const;
const statusTitleStyle = { display: "block", color: "#E2E8F0", fontSize: 12, fontWeight: 600 } as const;
const statusDescriptionStyle = { display: "block", color: "#7F91AA", fontSize: 10.5, marginTop: 2 } as const;
const switchStyle = { position: "relative", width: 38, height: 20, padding: 2, borderRadius: 999, flexShrink: 0, transition: "background .2s" } as const;
const hiddenCheckboxStyle = { position: "absolute", opacity: 0, pointerEvents: "none" } as const;
const switchKnobStyle = { display: "block", width: 16, height: 16, borderRadius: "50%", background: "#FFF", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "transform .2s" } as const;
const actionsStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 4 } as const;
const rightActionsStyle = { display: "flex", gap: 10 } as const;
const baseButtonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700 } as const;
const cancelButtonStyle = { ...baseButtonStyle, border: "1px solid #475569", background: "transparent", color: "#E2E8F0" } as const;
const submitButtonStyle = { ...baseButtonStyle, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", color: "#FFF", boxShadow: "0 8px 22px rgba(124,58,237,.24)" } as const;
const deleteButtonStyle = { ...baseButtonStyle, border: "1px solid rgba(239,68,68,.35)", background: "rgba(127,29,29,.2)", color: "#FCA5A5" } as const;
const rulesHeaderStyle = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 9 } as const;
const rulesHintStyle = { display: "block", color: "#718198", fontSize: 10.5, marginTop: -2 } as const;
const rulesListStyle = { display: "grid", gap: 8 } as const;
const emptyRulesStyle = { padding: 14, border: "1px dashed #334155", borderRadius: 8, color: "#718198", fontSize: 12, textAlign: "center" } as const;
const ruleRowStyle = { display: "grid", gridTemplateColumns: "54px minmax(0, 1fr) 30px", alignItems: "center", gap: 8 } as const;
const ruleCodeStyle = { color: "#A78BFA", fontSize: 11, fontWeight: 800, fontFamily: "monospace" } as const;
const ruleInputStyle = { ...inputStyle, height: 38 } as const;
const addRuleButtonStyle = { ...baseButtonStyle, padding: "7px 10px", border: "1px solid rgba(124,58,237,.4)", background: "rgba(124,58,237,.1)", color: "#C4B5FD" } as const;
const removeRuleButtonStyle = { width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 7, background: "transparent", color: "#94A3B8", cursor: "pointer" } as const;
