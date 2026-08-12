"use client";

import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AMBIENTES_ROBO,
  TIPOS_DISPARO_ROBO,
  type TipoProdutoRobo,
  type Cliente,
  type CamposImportacaoRobo,
  type DadosImportacaoRobo,
  type Robo,
} from "@/domain/entities";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";

const HEADERS = [
  "Operação", "ID do Robô", "Cliente", "Sistema", "Robô", "CourtName", "Fila", "Stack",
  "Ideal", "Max", "Pacote", "Versão", "Descrição", "Ambiente", "Status", "Responsável",
  "Disparo", "Gatilho De (ID)", "Gatilho Para (ID)", "Alterações realizadas", "Regras",
  "Regras fora da documentação",
  "Command", "Tribunal", "Sistema Tribunal", "Produto",
] as const;

interface RobotImportDialogProps {
  open: boolean;
  robos: Robo[];
  clientes: Cliente[];
  defaultProductType: TipoProdutoRobo;
  onClose: () => void;
  onImport: (robots: DadosImportacaoRobo[]) => void | Promise<void>;
}

function chave(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function valorTexto(value: unknown) {
  return String(value ?? "").trim();
}

function lista(value: unknown) {
  return valorTexto(value).split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean).map((descricao) => ({ descricao }));
}

function uuidValido(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function numeroOpcional(value: unknown, nome: string) {
  const raw = valorTexto(value);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${nome} deve ser um inteiro maior ou igual a zero.`);
  return parsed;
}

function statusOpcional(value: unknown) {
  const raw = chave(value);
  if (!raw) return undefined;
  if (["ativo", "sim", "true", "1"].includes(raw)) return true;
  if (["inativo", "nao", "false", "0"].includes(raw)) return false;
  throw new Error("Status deve ser Ativo ou Inativo.");
}

export default function RobotImportDialog({ open, robos, clientes, defaultProductType, onClose, onImport }: RobotImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendentes, setPendentes] = useState<DadosImportacaoRobo[]>([]);

  const resumo = useMemo(() => ({
    criar: pendentes.filter((item) => item.operacao === "Criar").length,
    atualizar: pendentes.filter((item) => item.operacao === "Atualizar").length,
  }), [pendentes]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, processing]);

  if (!open) return null;

  async function baixarPlanilha(includeData: boolean) {
    setProcessing(true);
    setError("");
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Robot Center";
      const sheet = workbook.addWorksheet("Robôs", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRow([...HEADERS]);
      if (includeData) robos.forEach((robo) => {
        const cliente = clientes.find((item) => item.id === robo.clienteId);
        sheet.addRow([
          "Atualizar", robo.id, cliente?.nome ?? "", robo.sistema, robo.nome, robo.courtName, robo.fila,
          robo.stack, robo.ideal, robo.max, robo.pacote, robo.versao, robo.descricao, robo.ambiente,
          robo.ativo ? "Ativo" : "Inativo", robo.responsavel, robo.disparo ?? "Manual",
          robo.gatilhoDeRoboId ?? "", robo.gatilhoParaRoboId ?? "", "", "", "",
          robo.command, robo.tribunal ?? "", robo.tribunalSystem ?? "",
          ROBOT_PRODUCTS.find((product) => product.productType === robo.productType)?.label ?? robo.productType,
        ]);
      });
      sheet.autoFilter = { from: "A1", to: `Z${Math.max(sheet.rowCount, 2)}` };
      sheet.getRow(1).height = 28;
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
      sheet.columns = HEADERS.map((header) => ({
        header, key: chave(header), width: ["Descrição", "Alterações realizadas", "Regras", "Regras fora da documentação"].includes(header) ? 34 : header === "ID do Robô" ? 38 : 18,
      }));
      for (let rowNumber = 2; rowNumber <= 501; rowNumber += 1) {
        sheet.getCell(`A${rowNumber}`).dataValidation = { type: "list", allowBlank: false, formulae: ['"Criar,Atualizar"'] };
        sheet.getCell(`N${rowNumber}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Produção,Teste,Desenvolvimento"'] };
        sheet.getCell(`O${rowNumber}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Ativo,Inativo"'] };
        sheet.getCell(`Q${rowNumber}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Agendado,Manual,Gatilho"'] };
        sheet.getCell(`Z${rowNumber}`).dataValidation = { type: "list", allowBlank: false, formulae: [`"${ROBOT_PRODUCTS.map((product) => product.label).join(",")}"`] };
        if (!includeData) {
          sheet.getCell(`Z${rowNumber}`).value = ROBOT_PRODUCTS.find((product) => product.productType === defaultProductType)?.label ?? "Robôs Integradores";
        }
      }

      const instructions = workbook.addWorksheet("Instruções");
      instructions.getCell("A1").value = "Importação segura de robôs";
      instructions.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF4C1D95" } };
      const textos = [
        "Atualizar: mantenha o ID do Robô. Somente células preenchidas serão alteradas; vazias preservam o banco.",
        "Criar: deixe o ID vazio. Campos vazios recebem os mesmos padrões do cadastro manual.",
        "Nunca troque IDs entre linhas. Um ID inexistente ou duplicado no arquivo bloqueia toda a importação.",
        "O cliente é identificado pelo nome. Em criação, um nome inexistente gera o cliente; em atualização isso só ocorre se a célula Cliente for preenchida.",
        "Alterações e regras são aceitas somente em linhas Criar. Separe vários itens por ponto e vírgula ou quebra de linha.",
        "Para remover Gatilho De/Para em uma atualização, escreva LIMPAR. IDs de gatilho devem ser de robôs ativos do mesmo cliente.",
        "Produto define em qual listagem o robô será exibido. Selecione Robôs Integradores, Consulta Processual, Peticionamento ou Movimento.",
        "O arquivo é validado por completo antes de qualquer gravação. Corrija todos os erros exibidos antes de aplicar.",
      ];
      textos.forEach((texto, index) => { instructions.getCell(`A${index + 3}`).value = texto; });
      instructions.getColumn("A").width = 120;
      for (let row = 3; row < textos.length + 3; row += 1) instructions.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top" };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = includeData ? "base-de-robos.xlsx" : "modelo-importacao-robos.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o modelo.");
    } finally {
      setProcessing(false);
    }
  }

  async function lerArquivo(file: File) {
    setProcessing(true);
    setError("");
    setSuccess("");
    setPendentes([]);
    try {
      if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) throw new Error("Selecione um arquivo .xlsx.");
      if (file.size > 5 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 5 MB.");
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Robôs") ?? workbook.worksheets[0];
      if (!sheet) throw new Error("A planilha não contém uma aba para importação.");

      const headers = new Map<number, string>();
      sheet.getRow(1).eachCell((cell, column) => headers.set(column, chave(cell.text)));
      for (const obrigatorio of ["Operação", "ID do Robô"]) {
        if (![...headers.values()].includes(chave(obrigatorio))) throw new Error(`Use o novo modelo: a coluna ${obrigatorio} não foi encontrada.`);
      }

      const itens: DadosImportacaoRobo[] = [];
      const erros: string[] = [];
      const idsNoArquivo = new Set<string>();
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = new Map<string, string>();
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          const header = headers.get(column);
          if (header) record.set(header, cell.text.trim());
        });
        if (![...record.values()].some(Boolean)) return;
        try {
          const operacaoRaw = chave(record.get(chave("Operação")));
          const operacao = operacaoRaw === "criar" ? "Criar" : operacaoRaw === "atualizar" ? "Atualizar" : null;
          if (!operacao) throw new Error("Operação deve ser Criar ou Atualizar.");
          const roboId = valorTexto(record.get(chave("ID do Robô")));
          const existente = roboId ? robos.find((robo) => robo.id === roboId) : undefined;
          if (operacao === "Atualizar") {
            if (!uuidValido(roboId)) throw new Error("Atualizar exige um ID do Robô válido.");
            if (!existente) throw new Error("ID do Robô não encontrado entre os robôs acessíveis.");
            if (idsNoArquivo.has(roboId)) throw new Error("O mesmo ID aparece mais de uma vez no arquivo.");
            idsNoArquivo.add(roboId);
          } else if (roboId) {
            throw new Error("Na operação Criar, o ID do Robô deve ficar vazio.");
          }

          const campos: CamposImportacaoRobo = {};
          const atribuirTexto = (header: string, campo: keyof CamposImportacaoRobo) => {
            const value = valorTexto(record.get(chave(header)));
            if (value) Object.assign(campos, { [campo]: value });
          };
          atribuirTexto("Cliente", "clienteNome"); atribuirTexto("Sistema", "sistema"); atribuirTexto("Robô", "nome");
          atribuirTexto("CourtName", "courtName"); atribuirTexto("Fila", "fila"); atribuirTexto("Stack", "stack");
          atribuirTexto("Pacote", "pacote"); atribuirTexto("Versão", "versao"); atribuirTexto("Descrição", "descricao");
          atribuirTexto("Responsável", "responsavel");
          atribuirTexto("Command", "command"); atribuirTexto("Tribunal", "tribunal"); atribuirTexto("Sistema Tribunal", "tribunalSystem");
          const productRaw = valorTexto(record.get(chave("Produto")));
          const selectedProduct = productRaw
            ? ROBOT_PRODUCTS.find((product) => chave(product.label) === chave(productRaw) || chave(product.productType) === chave(productRaw))
            : undefined;
          if (productRaw && !selectedProduct) throw new Error("Produto inválido. Selecione uma opção disponível no modelo.");
          campos.productType = selectedProduct?.productType ?? existente?.productType ?? defaultProductType;
          if (campos.productType === "INTEGRADOR" && (campos.tribunal || campos.tribunalSystem)) throw new Error("Robôs Integradores não utilizam Tribunal ou Sistema Tribunal.");
          const ideal = numeroOpcional(record.get(chave("Ideal")), "Ideal");
          const max = numeroOpcional(record.get(chave("Max")), "Max");
          if (ideal !== undefined) campos.ideal = ideal;
          if (max !== undefined) campos.max = max;
          const maxEfetivo = max ?? existente?.max;
          const idealEfetivo = ideal ?? existente?.ideal;
          if (maxEfetivo !== undefined && idealEfetivo !== undefined && maxEfetivo < idealEfetivo) throw new Error("Max deve ser maior ou igual a Ideal.");
          const ambienteRaw = valorTexto(record.get(chave("Ambiente")));
          if (ambienteRaw) {
            const encontrado = AMBIENTES_ROBO.find((item) => chave(item) === chave(ambienteRaw));
            if (!encontrado) throw new Error("Ambiente inválido.");
            campos.ambiente = encontrado;
          }
          const ativo = statusOpcional(record.get(chave("Status")));
          if (ativo !== undefined) campos.ativo = ativo;
          const disparoRaw = valorTexto(record.get(chave("Disparo")));
          if (disparoRaw) {
            const encontrado = TIPOS_DISPARO_ROBO.find((item) => chave(item) === chave(disparoRaw));
            if (!encontrado) throw new Error("Disparo inválido.");
            campos.disparo = encontrado;
          }
          const clienteNomeEfetivo = campos.clienteNome ?? clientes.find((cliente) => cliente.id === existente?.clienteId)?.nome;
          const clienteEfetivo = clientes.find((cliente) => chave(cliente.nome) === chave(clienteNomeEfetivo));
          for (const [header, campo] of [["Gatilho De (ID)", "gatilhoDeRoboId"], ["Gatilho Para (ID)", "gatilhoParaRoboId"]] as const) {
            const value = valorTexto(record.get(chave(header)));
            if (!value) continue;
            if (chave(value) === "limpar") { campos[campo] = null; continue; }
            const relacionado = robos.find((robo) => robo.id === value);
            if (!uuidValido(value) || !relacionado) throw new Error(`${header} não referencia um robô acessível.`);
            if (relacionado.clienteId !== (clienteEfetivo?.id ?? existente?.clienteId)) throw new Error(`${header} deve ser um robô do mesmo cliente.`);
            if (relacionado.id === existente?.id) throw new Error(`${header} não pode referenciar o próprio robô.`);
            campos[campo] = value;
          }
          const alteracoes = lista(record.get(chave("Alterações realizadas")));
          const regras = lista(record.get(chave("Regras")));
          const regrasFora = lista(record.get(chave("Regras fora da documentação")));
          if (operacao === "Atualizar" && (alteracoes.length || regras.length || regrasFora.length)) throw new Error("Alterações e regras não podem ser substituídas por atualização em planilha; use a edição do robô para preservar o histórico.");
          if (alteracoes.length) campos.alteracoesRealizadas = alteracoes;
          if (regras.length) campos.regras = regras;
          if (regrasFora.length) campos.regrasForaDocumentacao = regrasFora;
          if (operacao === "Atualizar" && Object.keys(campos).length === 0) throw new Error("Nenhum campo foi preenchido para atualizar.");
          itens.push({ operacao, roboId: roboId || undefined, linha: rowNumber, campos });
        } catch (cause) {
          erros.push(`Linha ${rowNumber}: ${cause instanceof Error ? cause.message : "dados inválidos."}`);
        }
      });
      if (erros.length) throw new Error(`Nenhum dado foi gravado. Corrija:\n${erros.slice(0, 8).join("\n")}${erros.length > 8 ? `\n... e mais ${erros.length - 8} erro(s).` : ""}`);
      if (!itens.length) throw new Error("Nenhuma linha válida foi encontrada.");
      if (itens.length > 500) throw new Error("Importe no máximo 500 robôs por arquivo.");
      setPendentes(itens);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível validar a planilha.");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function aplicarImportacao() {
    setProcessing(true); setError(""); setSuccess("");
    try {
      await onImport(pendentes);
      setSuccess(`${resumo.criar} criado(s) e ${resumo.atualizar} atualizado(s) com sucesso.`);
      setPendentes([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível aplicar a importação.");
    } finally { setProcessing(false); }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="import-title" style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <header style={headerStyle}>
          <div><h2 id="import-title" style={titleStyle}>Importar robôs com segurança</h2><p style={subtitleStyle}>Atualizações usam o UUID e nunca criam uma cópia.</p></div>
          <button type="button" aria-label="Fechar importação" onClick={onClose} style={closeStyle}><X size={18} /></button>
        </header>
        <div style={contentStyle}>
          <button type="button" disabled={processing} onClick={() => fileInputRef.current?.click()} style={optionStyle}><span style={iconStyle}><Upload size={22} /></span><span><strong>Validar planilha</strong><small style={optionDescriptionStyle}>Nenhum dado é gravado nesta etapa.</small></span></button>
          <button type="button" disabled={processing} onClick={() => void baixarPlanilha(true)} style={optionStyle}><span style={iconStyle}><Download size={22} /></span><span><strong>Baixar base de robôs</strong><small style={optionDescriptionStyle}>Inclui IDs, produtos e os dados existentes desta listagem.</small></span></button>
          <button type="button" disabled={processing} onClick={() => void baixarPlanilha(false)} style={optionStyle}><span style={iconStyle}><FileSpreadsheet size={18} /></span><span><strong>Baixar modelo</strong><small style={optionDescriptionStyle}>Cabeçalhos e Produto preenchido conforme esta listagem.</small></span></button>
          <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void lerArquivo(file); }} />
          {processing && <p role="status" style={statusStyle}><FileSpreadsheet size={16} /> Processando...</p>}
          {pendentes.length > 0 && <div style={previewStyle}><CheckCircle2 size={20} /><div><strong>Planilha validada</strong><span style={previewTextStyle}>{resumo.criar} criação(ões) · {resumo.atualizar} atualização(ões)</span></div><button type="button" disabled={processing} onClick={() => void aplicarImportacao()} style={applyStyle}>Aplicar alterações</button></div>}
          {error && <p role="alert" style={errorStyle}>{error}</p>}
          {success && <p role="status" style={successStyle}>{success}</p>}
        </div>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(2,6,23,.76)" };
const dialogStyle: React.CSSProperties = { width: "min(760px, 100%)", border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", boxShadow: "var(--shadow)" };
const headerStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 22, borderBottom: "1px solid var(--separator)" };
const titleStyle: React.CSSProperties = { margin: 0, color: "var(--text-strong)", fontSize: 20 };
const subtitleStyle: React.CSSProperties = { margin: "6px 0 0", color: "var(--muted)", fontSize: 13 };
const closeStyle: React.CSSProperties = { display: "inline-flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const contentStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 16 };
const optionStyle: React.CSSProperties = { display: "flex", minHeight: 72, alignItems: "center", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: 11, background: "var(--surface)", color: "var(--text-strong)", textAlign: "left", cursor: "pointer" };
const iconStyle: React.CSSProperties = { display: "inline-flex", flex: "0 0 auto", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)" };
const optionDescriptionStyle: React.CSSProperties = { display: "block", marginTop: 3, color: "var(--muted)", fontSize: 10.5, lineHeight: 1.35 };
const statusStyle: React.CSSProperties = { gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, margin: 0, color: "var(--primary)", fontSize: 13 };
const previewStyle: React.CSSProperties = { gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, border: "1px solid color-mix(in srgb, #22C55E 45%, var(--border))", borderRadius: 12, padding: 14, background: "color-mix(in srgb, #22C55E 10%, var(--card))", color: "var(--text-strong)" };
const previewTextStyle: React.CSSProperties = { display: "block", marginTop: 3, color: "var(--muted)", fontSize: 12 };
const applyStyle: React.CSSProperties = { marginLeft: "auto", border: 0, borderRadius: 9, padding: "10px 14px", background: "var(--primary)", color: "white", fontWeight: 700, cursor: "pointer" };
const errorStyle: React.CSSProperties = { gridColumn: "1 / -1", margin: 0, whiteSpace: "pre-line", color: "var(--danger, #DC2626)", fontSize: 13, lineHeight: 1.5 };
const successStyle: React.CSSProperties = { gridColumn: "1 / -1", margin: 0, color: "var(--success, #16A34A)", fontSize: 13 };
