"use client";

import { ArrowLeft, ArrowRight, Bot, CheckCircle2, FileText, GripVertical, Layers3, Paperclip, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { formatarData } from "@/domain/formatters";
import { AMBIENTES_ROBO, TIPOS_DISPARO_ROBO, type AlteracaoRobo, type Cliente, type DadosFormularioRobo, type Robo, type TipoProdutoRobo } from "@/domain/entities";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";
import { dadosFormularioRoboSchema, primeiraMensagemErro } from "@/domain/validation";
import { PALETAS_BADGE_ROBO } from "@/domain/badge-colors";
import { CORES_BADGE_ROBO, type CorBadgeRobo } from "@/domain/entities";
import { createClient } from "@/lib/supabase/client";
import type { RobotCatalogItem } from "@/domain/robot-catalog";

interface RobotFormProps {
  clientes: Cliente[];
  robos: Robo[];
  currentRobotId?: string;
  alteracoesExistentes?: AlteracaoRobo[];
  initialValues?: DadosFormularioRobo;
  defaultProductType?: TipoProdutoRobo;
  mode: "create" | "edit";
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (data: DadosFormularioRobo, publish: boolean) => void | Promise<void>;
}

export default function RobotForm({
  clientes,
  robos,
  currentRobotId,
  alteracoesExistentes = [],
  initialValues,
  defaultProductType = "INTEGRADOR",
  mode,
  onCancel,
  onDelete,
  onSubmit,
}: RobotFormProps) {
  const [form, setForm] = useState<DadosFormularioRobo>(() => initialValues ?? { ...FORMULARIO_ROBO_INICIAL, productType: defaultProductType });
  const [formError, setFormError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rulesTab, setRulesTab] = useState<"documentacao" | "fora-documentacao">("documentacao");
  const [draggedRuleIndex, setDraggedRuleIndex] = useState<number | null>(null);
  const [catalogs, setCatalogs] = useState<{ packages: RobotCatalogItem[]; stacks: RobotCatalogItem[]; queues: RobotCatalogItem[]; commands: RobotCatalogItem[] }>({ packages: [], stacks: [], queues: [], commands: [] });
  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("robot_packages").select("id,name,color,active").eq("active", true).order("name"),
      supabase.from("robot_stacks").select("id,name,active").eq("active", true).order("name"),
      supabase.from("robot_queues").select("id,name,active").eq("active", true).order("name"),
      supabase.from("robot_commands").select("id,name,command,active").eq("active", true).order("name"),
    ]).then(([packages, stacks, queues, commands]) => setCatalogs({
      packages: (packages.data ?? []) as RobotCatalogItem[], stacks: (stacks.data ?? []) as RobotCatalogItem[],
      queues: (queues.data ?? []) as RobotCatalogItem[], commands: (commands.data ?? []) as RobotCatalogItem[],
    }));
  }, []);
  const robosDoCliente = robos
    .filter((robo) => robo.clienteId === form.clienteId && robo.id !== currentRobotId && robo.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function update<K extends keyof DadosFormularioRobo>(field: K, value: DadosFormularioRobo[K]) {
    setForm((old) => ({ ...old, [field]: value }));
    setFormError("");
  }

  function reorderRules(targetIndex: number) {
    if (draggedRuleIndex === null || draggedRuleIndex === targetIndex) return;
    const reordered = [...form.regras];
    const [draggedRule] = reordered.splice(draggedRuleIndex, 1);
    reordered.splice(targetIndex, 0, draggedRule);
    update("regras", reordered);
    setDraggedRuleIndex(null);
  }

  function nextStep() {
    if (step === 1 && (!form.nome.trim() || !form.responsavel.trim() || !form.descricao.trim())) {
      setFormError("Preencha Nome do robô, Responsável e Descrição para continuar.");
      return;
    }
    if (step === 2) {
      const result = dadosFormularioRoboSchema.safeParse(form);
      if (!result.success) { setFormError(primeiraMensagemErro(result.error)); return; }
    }
    setFormError("");
    setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  }

  async function saveAndPublish() {
    if (step !== 3) return;

    const normalizedForm = {
      ...form,
      regras: form.regras
        .map((regra) => ({ descricao: regra.descricao.trim() }))
        .filter((regra) => regra.descricao.length > 0),
      regrasForaDocumentacao: form.regrasForaDocumentacao
        .map((regra) => ({ descricao: regra.descricao.trim() }))
        .filter((regra) => regra.descricao.length > 0),
      alteracoesRealizadas: form.alteracoesRealizadas
        .map((alteracao) => ({ descricao: alteracao.descricao.trim() }))
        .filter((alteracao) => alteracao.descricao.length > 0),
    };
    const result = dadosFormularioRoboSchema.safeParse(normalizedForm);

    if (!result.success) {
      setFormError(primeiraMensagemErro(result.error));
      return;
    }

    await onSubmit(result.data as DadosFormularioRobo, true);
  }

  return (
    <form
      className="robot-form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
      style={formStyle}
    >
      <nav className="robot-form-steps" aria-label="Etapas do cadastro">
        {([1, 2, 3] as const).map((value) => <button key={value} type="button" className={step === value ? "is-active" : step > value ? "is-complete" : ""} onClick={() => value < step && setStep(value)}><strong>{step > value ? <CheckCircle2 size={13} /> : value}</strong><span>{value === 1 ? "Identificação" : value === 2 ? "Configuração" : "Revisar e salvar"}</span></button>)}
      </nav>

      {step === 1 && <FormSection icon={<Bot size={17} />} title="Identificação e status" description="Dados principais, responsável e disponibilidade do robô.">
        <div style={fieldsGridStyle}>
          <Field label="Robô" placeholder="Nome do robô" value={form.nome} onChange={(v) => update("nome", v)} required />
          <div>
            <label style={labelStyle}>Produto</label>
            <select value={form.productType} onChange={(event) => {
              const productType = event.target.value as TipoProdutoRobo;
              setForm((current) => ({ ...current, productType, clienteId: productType === "INTEGRADOR" ? current.clienteId : null, tribunal: productType === "INTEGRADOR" ? null : current.tribunal, tribunalSystem: productType === "INTEGRADOR" ? null : current.tribunalSystem }));
              setFormError("");
            }} style={inputStyle}>
              {ROBOT_PRODUCTS.map((product) => <option key={product.productType} value={product.productType}>{product.label}</option>)}
            </select>
          </div>
          <Field label="Responsável" placeholder="Nome da pessoa ou equipe responsável" value={form.responsavel} onChange={(v) => update("responsavel", v)} required />
          <div>
            <label style={labelStyle}>Ambiente</label>
            <select value={form.ambiente} onChange={(event) => update("ambiente", event.target.value as DadosFormularioRobo["ambiente"])} style={inputStyle}>
              {AMBIENTES_ROBO.map((ambiente) => <option key={ambiente}>{ambiente}</option>)}
            </select>
          </div>
          <div style={fullWidthStyle}>
            <label style={labelStyle}>Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(event) => update("descricao", event.target.value)}
              rows={3}
              placeholder="Descreva a função e o objetivo deste robô"
              required
              style={textareaStyle}
            />
          </div>
          <div style={fullWidthStyle}>
            <label style={statusControlStyle}>
              <span>
                <span style={statusTitleStyle}>Status do robô</span>
                <span style={statusDescriptionStyle}>{form.ativo ? "Disponível para execução" : "Execução desabilitada"}</span>
              </span>
              <span style={{ ...switchStyle, background: form.ativo ? "var(--accent)" : "var(--track)" }}>
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
          <div style={fullWidthStyle}>
            <span style={labelStyle}>Documentação Upada</span>
            <label style={manualUploadStyle}>
              <span style={manualUploadIconStyle}><Upload size={17} /></span>
              <span style={{ minWidth: 0 }}>
                <strong style={manualUploadTitleStyle}>{form.uploadedDocumentationFile?.name ?? form.uploadedDocumentationName ?? "Selecionar documentação em PDF"}</strong>
                <small style={manualUploadHintStyle}>Arquivo externo em PDF de até 20 MB. Um novo envio substitui somente a Documentação Upada atual.</small>
              </span>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => {
                const arquivo = event.target.files?.[0] ?? null;
                if (arquivo && arquivo.type !== "application/pdf") {
                  setFormError("A Documentação Upada deve ser um arquivo PDF.");
                  event.target.value = "";
                  return;
                }
                update("uploadedDocumentationFile", arquivo);
              }} style={hiddenFileInputStyle} />
            </label>
            {(form.uploadedDocumentationFile || form.uploadedDocumentationName) && <span style={manualSelectedStyle}><Paperclip size={12} /> {form.uploadedDocumentationFile?.name ?? form.uploadedDocumentationName}</span>}
          </div>
        </div>
      </FormSection>}

      {step === 2 && <FormSection icon={<Layers3 size={17} />} title="Configuração e execução" description="Produto, tecnologia, capacidade e forma de disparo.">
        <div style={technicalFieldsGridStyle}>
          {form.productType === "INTEGRADOR" && <div>
            <label style={labelStyle}>Cliente</label>
            <select value={form.clienteId || ""} onChange={(event) => {
              const clienteId = event.target.value;
              setForm((old) => ({ ...old, clienteId: clienteId || null, gatilhoDeRoboId: null, gatilhoParaRoboId: null }));
              setFormError("");
            }} required style={inputStyle}>
              <option value="" disabled>Selecione um cliente</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
            </select>
            {clientes.length === 0 && <span style={fieldHintStyle}>Cadastre um cliente antes de cadastrar o robô.</span>}
          </div>}
          <Field label="Sistema" placeholder="Ex.: Legal One" value={form.sistema} onChange={(v) => update("sistema", v)} required />
          <Field label="CourtName" placeholder="Ex.: TJSP" value={form.courtName} onChange={(v) => update("courtName", v)} required />
          <CatalogSelect label="Fila" value={form.fila} items={catalogs.queues} onChange={(v) => update("fila", v)} />
          <CatalogSelect label="Stack (opcional)" value={form.stack} items={catalogs.stacks} onChange={(v) => update("stack", v)} />
          <NumberField label="Ideal" value={form.ideal} onChange={(value) => update("ideal", value)} />
          <NumberField label="Max" value={form.max} onChange={(value) => update("max", value)} />
          <div>
            <CatalogSelect label="Pacote" value={form.pacote} items={catalogs.packages} onChange={(v) => {
              update("pacote", v);
              const packageItem = catalogs.packages.find((item) => item.name === v);
              if (packageItem?.color) update("pacoteCor", packageItem.color);
            }} />
            <ColorPicker label="Cor do pacote" value={form.pacoteCor} onChange={(value) => update("pacoteCor", value)} />
          </div>
          <Field label="Versão" placeholder="Ex.: 1.0.0" value={form.versao} onChange={(v) => update("versao", v)} required />
          <div style={fullWidthStyle}><CatalogSelect label="Command" value={form.command} items={catalogs.commands} optional commandValues onChange={(value) => update("command", value)} /></div>
          {form.productType !== "INTEGRADOR" && <>
            <Field label="Tribunal" placeholder="Ex.: TJSP" value={form.tribunal ?? ""} onChange={(value) => update("tribunal", value || null)} />
            <Field label="Sistema Tribunal" placeholder="Ex.: e-SAJ" value={form.tribunalSystem ?? ""} onChange={(value) => update("tribunalSystem", value || null)} />
          </>}
          <div>
            <label style={labelStyle}>Disparo</label>
            <select value={form.disparo} onChange={(event) => update("disparo", event.target.value as DadosFormularioRobo["disparo"])} style={inputStyle}>
              {TIPOS_DISPARO_ROBO.map((tipo) => <option key={tipo} value={tipo}>{tipo === "Gatilho" ? "Por Gatilho" : tipo}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Gatilho De</label>
            <select value={form.gatilhoDeRoboId ?? ""} onChange={(event) => update("gatilhoDeRoboId", event.target.value || null)} style={inputStyle}>
              <option value="">Nenhum</option>
              {robosDoCliente.map((robo) => <option key={robo.id} value={robo.id}>{robo.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Gatilho Para</label>
            <select value={form.gatilhoParaRoboId ?? ""} onChange={(event) => update("gatilhoParaRoboId", event.target.value || null)} style={inputStyle}>
              <option value="">Nenhum</option>
              {robosDoCliente.map((robo) => <option key={robo.id} value={robo.id}>{robo.nome}</option>)}
            </select>
          </div>
        </div>
      </FormSection>}

      {step === 3 && <FormSection icon={<CheckCircle2 size={17} />} title="Revisar e salvar" description="Confira os dados antes de publicar o robô.">
        <div className="robot-form-review">
          <ReviewGroup title="Identificação" items={[["Robô", form.nome], ["Responsável", form.responsavel], ["Ambiente", form.ambiente], ["Status", form.ativo ? "Ativo" : "Inativo"], ["Descrição", form.descricao]]} />
          <ReviewGroup title="Configuração" items={[["Produto", ROBOT_PRODUCTS.find((item) => item.productType === form.productType)?.label ?? form.productType], ["Cliente", clientes.find((item) => item.id === form.clienteId)?.nome ?? "Não se aplica"], ["Sistema", form.sistema], ["Pacote", form.pacote], ["Stack", form.stack || "Não informada"], ["Fila", form.fila], ["Command", form.command || "Não informado"], ["Versão", form.versao], ["Capacidade", `Ideal ${form.ideal} · Máx. ${form.max}`]]} />
        </div>
      </FormSection>}

      {false && <FormSection icon={<FileText size={17} />} title="Documentação da alteração" description="Registre a atualização e as regras funcionais do robô.">
        <div style={stackedFieldsStyle}>
          <div>
            {alteracoesExistentes.length > 0 && (
              <div style={existingChangesStyle}>
                <span style={labelStyle}>Histórico existente</span>
                {alteracoesExistentes.map((alteracao) => (
                  <div key={alteracao.id} style={existingChangeItemStyle}>
                    <span style={existingChangeDateStyle}>{formatarData(alteracao.realizadaEm)}</span>
                    <span>{alteracao.descricao}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={rulesHeaderStyle}>
              <div>
                <span style={labelStyle}>Alterações realizadas</span>
                <span style={rulesHintStyle}>Cada item será acrescentado ao histórico do robô.</span>
              </div>
              <button type="button" onClick={() => update("alteracoesRealizadas", [...form.alteracoesRealizadas, { descricao: "" }])} style={addRuleButtonStyle}>
                <Plus size={14} /> Adicionar alteração
              </button>
            </div>
            <div style={rulesListStyle}>
              {form.alteracoesRealizadas.length === 0 && <div style={emptyRulesStyle}>Nenhuma nova alteração informada.</div>}
              {form.alteracoesRealizadas.map((alteracao, index) => (
                <div key={index} style={outsideRuleRowStyle}>
                  <span style={ruleCodeStyle}>{`ALT${String(index + 1).padStart(3, "0")}`}</span>
                  <input
                    value={alteracao.descricao}
                    onChange={(event) => update("alteracoesRealizadas", form.alteracoesRealizadas.map((item, itemIndex) => itemIndex === index ? { descricao: event.target.value } : item))}
                    placeholder="Descreva a alteração realizada"
                    style={ruleInputStyle}
                  />
                  <button type="button" aria-label={`Remover alteração ${index + 1}`} onClick={() => update("alteracoesRealizadas", form.alteracoesRealizadas.filter((_, itemIndex) => itemIndex !== index))} style={removeRuleButtonStyle}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div role="tablist" aria-label="Tipos de regras" style={rulesTabsStyle}>
              <button
                type="button"
                role="tab"
                aria-selected={rulesTab === "documentacao"}
                onClick={() => setRulesTab("documentacao")}
                style={{ ...rulesTabStyle, ...(rulesTab === "documentacao" ? activeRulesTabStyle : {}) }}
              >
                RF do documento técnico
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rulesTab === "fora-documentacao"}
                onClick={() => setRulesTab("fora-documentacao")}
                style={{ ...rulesTabStyle, ...(rulesTab === "fora-documentacao" ? activeRulesTabStyle : {}) }}
              >
                Regras fora da documentação
              </button>
            </div>

            <div style={rulesHeaderStyle}>
              <div>
                <span style={labelStyle}>{rulesTab === "documentacao" ? "Regras funcionais" : "Regras fora da documentação"}</span>
                <span style={rulesHintStyle}>
                  {rulesTab === "documentacao" ? "Arraste para reordenar. A numeração é atualizada automaticamente." : "Itens que não fazem parte do documento técnico."}
                </span>
              </div>
              <button
                type="button"
                onClick={() => rulesTab === "documentacao"
                  ? update("regras", [...form.regras, { descricao: "" }])
                  : update("regrasForaDocumentacao", [...form.regrasForaDocumentacao, { descricao: "" }])}
                style={addRuleButtonStyle}
              >
                <Plus size={14} /> Adicionar regra
              </button>
            </div>

            <div style={rulesListStyle}>
              {rulesTab === "documentacao" && form.regras.length === 0 && <div style={emptyRulesStyle}>Nenhuma RF cadastrada.</div>}
              {rulesTab === "documentacao" && form.regras.map((regra, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => setDraggedRuleIndex(index)}
                  onDragEnd={() => setDraggedRuleIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderRules(index)}
                  style={{ ...ruleRowStyle, opacity: draggedRuleIndex === index ? 0.55 : 1 }}
                >
                  <span title="Arraste para reordenar" aria-label={`Reordenar RF${String(index + 1).padStart(3, "0")}`} style={dragHandleStyle}>
                    <GripVertical size={16} />
                  </span>
                  <span style={ruleCodeStyle}>{`RF${String(index + 1).padStart(3, "0")}`}</span>
                  <input
                    value={regra.descricao}
                    onChange={(event) => update("regras", form.regras.map((item, itemIndex) => itemIndex === index ? { descricao: event.target.value } : item))}
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
              {rulesTab === "fora-documentacao" && form.regrasForaDocumentacao.length === 0 && <div style={emptyRulesStyle}>Nenhuma regra fora da documentação.</div>}
              {rulesTab === "fora-documentacao" && form.regrasForaDocumentacao.map((regra, index) => (
                <div key={index} style={outsideRuleRowStyle}>
                  <span style={outsideRuleCodeStyle}>{`RFD${String(index + 1).padStart(3, "0")}`}</span>
                  <input
                    value={regra.descricao}
                    onChange={(event) => update("regrasForaDocumentacao", form.regrasForaDocumentacao.map((item, itemIndex) => itemIndex === index ? { descricao: event.target.value } : item))}
                    placeholder="Escreva a regra fora da documentação"
                    style={ruleInputStyle}
                  />
                  <button
                    type="button"
                    aria-label={`Remover RFD${String(index + 1).padStart(3, "0")}`}
                    onClick={() => update("regrasForaDocumentacao", form.regrasForaDocumentacao.filter((_, itemIndex) => itemIndex !== index))}
                    style={removeRuleButtonStyle}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FormSection>}

      {formError && <p role="alert" style={errorStyle}>{formError}</p>}

      <footer style={actionsStyle}>
        <div>
          {mode === "edit" && onDelete && (
            <button type="button" onClick={onDelete} style={deleteButtonStyle}>
              <Trash2 size={15} />
              Excluir robô
            </button>
          )}
        </div>
        <div style={rightActionsStyle}>
          <button type="button" onClick={onCancel} style={cancelButtonStyle}>Cancelar</button>
          {step > 1 && <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3)} style={cancelButtonStyle}><ArrowLeft size={15} /> Voltar</button>}
          {step < 3 ? <button type="button" onClick={nextStep} style={submitButtonStyle}>Continuar <ArrowRight size={15} /></button> : <button type="button" onClick={saveAndPublish} style={submitButtonStyle}>
            <Save size={15} />
            {mode === "create" ? "Salvar e publicar" : "Salvar e publicar"}
          </button>}
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

function Field({ label, value, placeholder, required = false, onChange }: { label: string; value: string; placeholder: string; required?: boolean; onChange: (value: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} style={inputStyle} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" min={0} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} required style={inputStyle} />
    </div>
  );
}

function ReviewGroup({ title, items }: { title: string; items: [string, string][] }) {
  return <section><h3>{title}</h3><dl>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

function CatalogSelect({ label, value, items, onChange, optional = false, commandValues = false }: { label: string; value: string; items: RobotCatalogItem[]; onChange: (value: string) => void; optional?: boolean; commandValues?: boolean }) {
  const values = new Set(items.map((item) => commandValues ? item.command ?? "" : item.name));
  return <div>
    <label style={labelStyle}>{label}</label>
    <select value={value} onChange={(event) => onChange(event.target.value)} required={!optional} style={inputStyle}>
      <option value="">{optional ? "Nenhum" : `Selecione ${label.toLocaleLowerCase("pt-BR")}`}</option>
      {value && !values.has(value) && <option value={value}>{value} (inativo)</option>}
      {items.map((item) => <option key={item.id} value={commandValues ? item.command : item.name}>{commandValues ? `${item.name} — ${item.command}` : item.name}</option>)}
    </select>
    {items.length === 0 && <span style={fieldHintStyle}>Nenhum cadastro disponível. Solicite a criação ao administrador.</span>}
  </div>;
}

const formStyle = { display: "flex", flexDirection: "column", gap: 16 } as const;
const manualUploadStyle = { minHeight: 58, display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", border: "1px dashed var(--border-strong)", borderRadius: 9, background: "var(--surface)", cursor: "pointer" } as const;
const manualUploadIconStyle = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8, color: "var(--accent)", background: "var(--accent-soft)" } as const;
const manualUploadTitleStyle = { display: "block", overflow: "hidden", color: "var(--text)", fontSize: 12, textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const manualUploadHintStyle = { display: "block", marginTop: 3, color: "var(--muted)", fontSize: 10.5 } as const;
const hiddenFileInputStyle = { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" } as const;
const manualSelectedStyle = { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, color: "var(--accent)", fontSize: 10.5 } as const;
const sectionsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 } as const;
const fieldsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 } as const;
const technicalFieldsGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 } as const;
const stackedFieldsStyle = { display: "flex", flexDirection: "column", gap: 16 } as const;
const fullWidthStyle = { gridColumn: "1 / -1" } as const;
const sectionStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" } as const;
const sectionHeaderStyle = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--separator)" } as const;
const sectionIconStyle = { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8, color: "var(--accent)", background: "var(--accent-soft)" } as const;
const sectionTitleStyle = { display: "block", color: "var(--text-strong)", fontSize: 13, fontWeight: 700 } as const;
const sectionDescriptionStyle = { display: "block", color: "var(--muted)", fontSize: 11, marginTop: 2 } as const;
const sectionContentStyle = { padding: 14 } as const;
const labelStyle = { display: "block", color: "var(--text-2)", marginBottom: 6, fontWeight: 600, fontSize: 12 } as const;
const fieldHintStyle = { display: "block", color: "var(--warning)", marginTop: 5, fontSize: 10.5 } as const;
const existingChangesStyle = { display: "grid", gap: 6, marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)" } as const;
const existingChangeItemStyle = { display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: 10, color: "var(--text)", fontSize: 11.5, lineHeight: 1.4 } as const;
const existingChangeDateStyle = { color: "var(--muted)", fontSize: 10.5 } as const;
const inputStyle = { width: "100%", height: 40, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", padding: "0 11px", outline: "none", boxSizing: "border-box" } as const;
const textareaStyle = { ...inputStyle, height: "auto", minHeight: 82, padding: 11, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 } as const;
const statusControlStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 11px", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", background: "var(--surface)" } as const;
const statusTitleStyle = { display: "block", color: "var(--text)", fontSize: 12, fontWeight: 600 } as const;
const statusDescriptionStyle = { display: "block", color: "var(--muted)", fontSize: 10.5, marginTop: 2 } as const;
const switchStyle = { position: "relative", width: 38, height: 20, padding: 2, borderRadius: 999, flexShrink: 0, transition: "background .2s" } as const;
const hiddenCheckboxStyle = { position: "absolute", opacity: 0, pointerEvents: "none" } as const;
const switchKnobStyle = { display: "block", width: 16, height: 16, borderRadius: "50%", background: "#FFF", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "transform .2s" } as const;
const actionsStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 4 } as const;
const rightActionsStyle = { display: "flex", gap: 10 } as const;
const baseButtonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700 } as const;
const cancelButtonStyle = { ...baseButtonStyle, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text)" } as const;
const submitButtonStyle = { ...baseButtonStyle, border: "none", background: "var(--accent)", color: "var(--on-accent)", boxShadow: "0 8px 22px rgba(10,132,255,.2)" } as const;
const publishButtonStyle = { ...baseButtonStyle, border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" } as const;
const deleteButtonStyle = { ...baseButtonStyle, border: "1px solid var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" } as const;
const rulesHeaderStyle = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 9 } as const;
const rulesHintStyle = { display: "block", color: "var(--muted)", fontSize: 10.5, marginTop: -2 } as const;
const rulesListStyle = { display: "grid", gap: 8 } as const;
const emptyRulesStyle = { padding: 14, border: "1px dashed var(--border-strong)", borderRadius: 8, color: "var(--muted)", fontSize: 12, textAlign: "center" } as const;
const ruleRowStyle = { display: "grid", gridTemplateColumns: "24px 54px minmax(0, 1fr) 30px", alignItems: "center", gap: 8, transition: "opacity .15s" } as const;
const outsideRuleRowStyle = { display: "grid", gridTemplateColumns: "54px minmax(0, 1fr) 30px", alignItems: "center", gap: 8 } as const;
const dragHandleStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2)", cursor: "grab" } as const;
const ruleCodeStyle = { color: "#A78BFA", fontSize: 11, fontWeight: 800, fontFamily: "monospace" } as const;
const outsideRuleCodeStyle = { ...ruleCodeStyle, color: "#67E8F9" } as const;
const ruleInputStyle = { ...inputStyle, height: 38 } as const;
const addRuleButtonStyle = { ...baseButtonStyle, padding: "7px 10px", border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" } as const;
const removeRuleButtonStyle = { width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 7, background: "transparent", color: "var(--muted)", cursor: "pointer" } as const;
const rulesTabsStyle = { display: "flex", gap: 4, marginBottom: 16, padding: 4, borderRadius: 9, background: "var(--surface)" } as const;
const rulesTabStyle = { flex: 1, padding: "8px 10px", border: "none", borderRadius: 7, background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 12, fontWeight: 700 } as const;
const activeRulesTabStyle = { background: "var(--card)", color: "var(--accent)", boxShadow: "var(--shadow)" } as const;
const errorStyle = { margin: 0, padding: "10px 12px", border: "1px solid rgba(239,68,68,.35)", borderRadius: 8, color: "#FCA5A5", background: "rgba(127,29,29,.18)", fontSize: 12 } as const;

function ColorPicker({ label, value, onChange }: { label: string; value: CorBadgeRobo; onChange: (value: CorBadgeRobo) => void }) {
  return (
    <fieldset style={colorFieldsetStyle}>
      <legend style={colorLegendStyle}>{label}</legend>
      <div style={colorOptionsStyle}>
        {CORES_BADGE_ROBO.map((cor) => {
          const paleta = PALETAS_BADGE_ROBO[cor];
          const selected = cor === value;
          return (
            <button
              key={cor}
              type="button"
              aria-label={`${label}: ${paleta.nome}`}
              aria-pressed={selected}
              title={paleta.nome}
              onClick={() => onChange(cor)}
              style={{
                ...colorOptionStyle,
                color: paleta.texto,
                background: paleta.fundo,
                borderColor: selected ? paleta.texto : paleta.borda,
                boxShadow: selected ? `0 0 0 2px var(--card), 0 0 0 4px ${paleta.borda}` : "none",
              }}
            >
              Aa
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const FORMULARIO_ROBO_INICIAL: DadosFormularioRobo = {
  clienteId: null,
  nome: "",
  sistema: "",
  courtName: "",
  ideal: 0,
  max: 0,
  pacote: "",
  pacoteCor: "violeta",
  descricao: "",
  ambiente: "Produção",
  ativo: true,
  stack: "",
  fila: "",
  versao: "",
  command: "",
  productType: "INTEGRADOR",
  tribunal: null,
  tribunalSystem: null,
  responsavel: "",
  disparo: "Manual",
  gatilhoDeRoboId: null,
  gatilhoParaRoboId: null,
  uploadedDocumentationPath: null,
  uploadedDocumentationName: null,
  uploadedDocumentationFile: null,
  alteracoesRealizadas: [],
  regras: [],
  regrasForaDocumentacao: [],
};

const colorFieldsetStyle: React.CSSProperties = { margin: "10px 0 0", border: 0, padding: 0 };
const colorLegendStyle: React.CSSProperties = { marginBottom: 7, padding: 0, color: "var(--muted)", fontSize: 10.5, fontWeight: 650 };
const colorOptionsStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const colorOptionStyle: React.CSSProperties = { width: 31, height: 27, border: "1px solid", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer" };
