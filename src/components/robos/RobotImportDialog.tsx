"use client";

import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AMBIENTES_ROBO, type DadosImportacaoRobo } from "@/domain/entities";

const HEADERS = [
  "Cliente",
  "Sistema",
  "Robô",
  "CourtName",
  "Fila",
  "Stack",
  "Ideal",
  "Max",
  "Pacote",
  "Versão",
  "Descrição",
  "Ambiente",
  "Status",
  "Responsável",
  "Alterações realizadas",
  "Regras",
  "Regras fora da documentação",
] as const;

interface RobotImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (robots: DadosImportacaoRobo[]) => void | Promise<void>;
}

function normalizarChave(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function texto(value: unknown, fallback = "Não informado") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function numero(value: unknown) {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function lista(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((descricao) => ({ descricao }));
}

function ambiente(value: unknown): DadosImportacaoRobo["ambiente"] {
  const candidate = String(value ?? "").trim();
  return AMBIENTES_ROBO.find((item) => normalizarChave(item) === normalizarChave(candidate)) ?? "Desenvolvimento";
}

function statusAtivo(value: unknown) {
  return ["ativo", "sim", "true", "1"].includes(normalizarChave(value));
}

export default function RobotImportDialog({ open, onClose, onImport }: RobotImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, processing]);

  if (!open) return null;

  async function baixarModelo() {
    setProcessing(true);
    setError("");
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Robot Center";
      const sheet = workbook.addWorksheet("Robôs", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRow([...HEADERS]);
      sheet.addRow([]);
      sheet.autoFilter = { from: "A1", to: "Q2" };
      sheet.getRow(1).height = 28;
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
      sheet.getRow(1).eachCell((cell) => {
        cell.border = { bottom: { style: "medium", color: { argb: "FF4C1D95" } } };
      });
      sheet.columns = HEADERS.map((header) => ({
        header,
        key: normalizarChave(header),
        width: ["Descrição", "Alterações realizadas", "Regras", "Regras fora da documentação"].includes(header) ? 34 : 18,
      }));
      sheet.getColumn("G").numFmt = "0";
      sheet.getColumn("H").numFmt = "0";
      for (let rowNumber = 2; rowNumber <= 501; rowNumber += 1) {
        sheet.getCell(`L${rowNumber}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Produção,Teste,Desenvolvimento"'] };
        sheet.getCell(`M${rowNumber}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Ativo,Inativo"'] };
      }
      sheet.getRow(2).alignment = { vertical: "top", wrapText: true };

      const instructions = workbook.addWorksheet("Instruções");
      instructions.getCell("A1").value = "Modelo de importação de robôs";
      instructions.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF4C1D95" } };
      instructions.getCell("A3").value = "Nenhuma coluna é obrigatória. Células vazias recebem valores padrão durante a importação.";
      instructions.getCell("A4").value = "O cliente é vinculado pelo nome. Nomes ainda não cadastrados serão criados automaticamente e reutilizados nas demais linhas.";
      instructions.getCell("A5").value = "Alterações e regras múltiplas podem ser separadas por ponto e vírgula ou por quebra de linha.";
      instructions.getColumn("A").width = 110;
      for (let rowNumber = 3; rowNumber <= 5; rowNumber += 1) {
        instructions.getCell(`A${rowNumber}`).alignment = { wrapText: true, vertical: "top" };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "modelo-importacao-robos.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o modelo.");
    } finally {
      setProcessing(false);
    }
  }

  async function importarArquivo(file: File) {
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) throw new Error("Selecione um arquivo no formato .xlsx.");
      if (file.size > 5 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 5 MB.");

      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Robôs") ?? workbook.worksheets[0];
      if (!sheet) throw new Error("A planilha não contém uma aba para importação.");

      const headerByColumn = new Map<number, string>();
      sheet.getRow(1).eachCell((cell, column) => headerByColumn.set(column, normalizarChave(cell.text)));
      const requiredHeader = normalizarChave("Robô");
      if (![...headerByColumn.values()].includes(requiredHeader)) throw new Error("Use o modelo fornecido: a coluna Robô não foi encontrada.");

      const imported: DadosImportacaoRobo[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = new Map<string, unknown>();
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          const header = headerByColumn.get(column);
          if (header) record.set(header, cell.value);
        });
        if (![...record.values()].some((value) => String(value ?? "").trim())) return;

        const ideal = numero(record.get(normalizarChave("Ideal")));
        const max = Math.max(numero(record.get(normalizarChave("Max"))), ideal);
        imported.push({
          clienteNome: texto(record.get(normalizarChave("Cliente")), "Cliente não informado"),
          sistema: texto(record.get(normalizarChave("Sistema"))),
          nome: texto(record.get(requiredHeader), `Robô importado ${rowNumber - 1}`),
          courtName: texto(record.get(normalizarChave("CourtName"))),
          fila: texto(record.get(normalizarChave("Fila"))),
          stack: texto(record.get(normalizarChave("Stack"))),
          ideal,
          max,
          pacote: texto(record.get(normalizarChave("Pacote"))),
          pacoteCor: "violeta",
          versao: texto(record.get(normalizarChave("Versão"))),
          descricao: texto(record.get(normalizarChave("Descrição"))),
          ambiente: ambiente(record.get(normalizarChave("Ambiente"))),
          ativo: statusAtivo(record.get(normalizarChave("Status"))),
          responsavel: texto(record.get(normalizarChave("Responsável"))),
          alteracoesRealizadas: lista(record.get(normalizarChave("Alterações realizadas"))),
          regras: lista(record.get(normalizarChave("Regras"))),
          regrasForaDocumentacao: lista(record.get(normalizarChave("Regras fora da documentação"))),
        });
      });

      if (!imported.length) throw new Error("Nenhuma linha preenchida foi encontrada.");
      if (imported.length > 500) throw new Error("Importe no máximo 500 robôs por arquivo.");
      await onImport(imported);
      setSuccess(`${imported.length} ${imported.length === 1 ? "robô importado" : "robôs importados"} com sucesso.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar a planilha.");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="import-title" style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <header style={headerStyle}>
          <div>
            <h2 id="import-title" style={titleStyle}>Importar robôs</h2>
            <p style={subtitleStyle}>Baixe o modelo ou selecione uma planilha preenchida.</p>
          </div>
          <button type="button" aria-label="Fechar importação" onClick={onClose} style={closeStyle}><X size={18} /></button>
        </header>
        <div style={contentStyle}>
          <button type="button" disabled={processing} onClick={() => fileInputRef.current?.click()} style={optionStyle}>
            <span style={iconStyle}><Upload size={22} /></span>
            <span><strong style={optionTitleStyle}>Importar dados</strong><small style={optionDescriptionStyle}>Selecione o arquivo .xlsx preenchido.</small></span>
          </button>
          <button type="button" disabled={processing} onClick={() => void baixarModelo()} style={optionStyle}>
            <span style={iconStyle}><Download size={22} /></span>
            <span><strong style={optionTitleStyle}>Baixar modelo</strong><small style={optionDescriptionStyle}>Gere a planilha com todos os campos do cadastro.</small></span>
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importarArquivo(file); }} />
          {processing && <p role="status" style={statusStyle}><FileSpreadsheet size={16} /> Processando planilha...</p>}
          {error && <p role="alert" style={errorStyle}>{error}</p>}
          {success && <p role="status" style={successStyle}>{success}</p>}
        </div>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(2,6,23,.76)" };
const dialogStyle: React.CSSProperties = { width: "min(620px, 100%)", border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", boxShadow: "var(--shadow)" };
const headerStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 22, borderBottom: "1px solid var(--separator)" };
const titleStyle: React.CSSProperties = { margin: 0, color: "var(--text-strong)", fontSize: 20 };
const subtitleStyle: React.CSSProperties = { margin: "6px 0 0", color: "var(--muted)", fontSize: 13 };
const closeStyle: React.CSSProperties = { display: "inline-flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", color: "var(--text)", cursor: "pointer" };
const contentStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, padding: 22 };
const optionStyle: React.CSSProperties = { display: "flex", minHeight: 112, alignItems: "center", gap: 14, border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)", color: "var(--text-strong)", textAlign: "left", cursor: "pointer" };
const iconStyle: React.CSSProperties = { display: "inline-flex", flex: "0 0 auto", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(124,58,237,.2)", color: "#C4B5FD" };
const optionTitleStyle: React.CSSProperties = { display: "block", fontSize: 14 };
const optionDescriptionStyle: React.CSSProperties = { display: "block", marginTop: 5, color: "var(--muted)", fontSize: 12, lineHeight: 1.4 };
const statusStyle: React.CSSProperties = { gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, margin: 0, color: "#C4B5FD", fontSize: 13 };
const errorStyle: React.CSSProperties = { gridColumn: "1 / -1", margin: 0, color: "#FCA5A5", fontSize: 13 };
const successStyle: React.CSSProperties = { gridColumn: "1 / -1", margin: 0, color: "#86EFAC", fontSize: 13 };
