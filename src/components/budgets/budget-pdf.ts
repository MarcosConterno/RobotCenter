import type { BudgetItemDraft } from "@/domain/budgets";
import type { jsPDF as JsPDF } from "jspdf";

async function loadLogo() {
  const response = await fetch("/images/robot-center-system-logo-transparent.png");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function addContainedImage(doc: JsPDF, data: string, x: number, y: number, maxWidth: number, maxHeight: number) {
  const properties = doc.getImageProperties(data);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * scale;
  const height = properties.height * scale;
  doc.addImage(data, "PNG", x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
}

export async function generateBudgetPdf(input: {
  projectName: string;
  items: BudgetItemDraft[];
  hourlyRate: number;
  commissionPercent: number;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - margin * 2;
  const descriptionWidth = usableWidth - 34;
  const totalHours = input.items.reduce((sum, item) => sum + item.hours, 0);

  async function drawHeader() {
    try { addContainedImage(doc, await loadLogo(), margin, 5, 37, 19); } catch { /* PDF continua utilizável sem imagem. */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(29, 29, 31);
    const title = doc.splitTextToSize(input.projectName.trim() || "Orçamento de Projeto", usableWidth - 48);
    doc.text(title, pageWidth / 2 + 11, 14, { align: "center" });
    return Math.max(29, 14 + title.length * 7);
  }

  function drawTableHeader(y: number) {
    doc.setFillColor(10, 132, 255);
    doc.roundedRect(margin, y, usableWidth, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("Descrição", margin + 4, y + 6.7);
    doc.text("Horas técnicas", pageWidth - margin - 4, y + 6.7, { align: "right" });
    return y + 12;
  }

  let y = drawTableHeader(await drawHeader());
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const lines = doc.splitTextToSize(item.description, descriptionWidth);
    const height = Math.max(9, lines.length * 5 + 4);
    if (y + height > 272) {
      doc.addPage();
      y = drawTableHeader(await drawHeader());
    }
    doc.setFillColor(index % 2 === 0 ? 232 : 242, index % 2 === 0 ? 241 : 246, 255);
    doc.roundedRect(margin, y, usableWidth, height, 1.5, 1.5, "F");
    doc.setTextColor(33, 37, 41);
    doc.text(lines, margin + 4, y + 6);
    doc.text(`${item.hours.toFixed(2)}h`, pageWidth - margin - 4, y + 6, { align: "right" });
    y += height + 1;
  }

  if (y > 242) { doc.addPage(); y = 24; }
  y += 5;
  doc.setFillColor(10, 132, 255);
  doc.roundedRect(margin, y, usableWidth, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Total de horas técnicas", margin + 4, y + 7.2);
  doc.text(`${totalHours.toFixed(2)}h`, pageWidth - margin - 4, y + 7.2, { align: "right" });

  const safeName = (input.projectName || "orcamento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`${safeName || "orcamento"}.pdf`);
}

export async function generateRobotCenterBudgetPdf(input: {
  projectName: string;
  items: BudgetItemDraft[];
  hourlyRate: number;
  commissionPercent: number;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const totalHours = input.items.reduce((sum, item) => sum + item.hours, 0);
  let logo: string | null = null;
  try { logo = await loadLogo(); } catch { logo = null; }

  function header(pageNumber: number) {
    if (logo) addContainedImage(doc, logo, margin, 12, 24, 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(10, 132, 255);
    doc.text("ORÇAMENTO", margin + 31, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 115);
    doc.text(`Página ${pageNumber}`, pageWidth - margin, 21, { align: "right" });
    doc.setDrawColor(220, 223, 228);
    doc.setLineWidth(.35);
    doc.line(margin + 31, 27, pageWidth - margin, 27);
    return 44;
  }

  let pageNumber = 1;
  let y = header(pageNumber);
  doc.setTextColor(29, 29, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const title = doc.splitTextToSize(input.projectName.trim() || "Orçamento de Projeto", usableWidth);
  doc.text(title, margin, y);
  y += title.length * 8 + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 115);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}  •  ${input.items.length} itens`, margin, y);
  y += 10;

  doc.setFillColor(10, 132, 255);
  doc.roundedRect(margin, y, usableWidth, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ESCOPO E ESTIMATIVA", margin + 4, y + 6);
  y += 12;

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const lines = doc.splitTextToSize(item.description, usableWidth - 40);
    const rowHeight = Math.max(14, lines.length * 4.8 + 6);
    if (y + rowHeight > pageHeight - 24) {
      doc.addPage(); pageNumber += 1; y = header(pageNumber);
    }
    doc.setFillColor(index % 2 === 0 ? 247 : 241, index % 2 === 0 ? 248 : 246, index % 2 === 0 ? 250 : 252);
    doc.roundedRect(margin, y, usableWidth, rowHeight, 2, 2, "F");
    doc.setFillColor(10, 132, 255);
    doc.roundedRect(margin + 3, y + 3, 7, 7, 2, 2, "F");
    doc.setTextColor(29, 29, 31);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.text(lines, margin + 14, y + 7);
    doc.setTextColor(81, 81, 84);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(10, 132, 255);
    doc.text(`${item.hours.toFixed(2)}h`, pageWidth - margin - 5, y + 7, { align: "right" });
    y += rowHeight + 2;
  }

  if (y > pageHeight - 66) { doc.addPage(); pageNumber += 1; y = header(pageNumber); }
  y += 6;
  doc.setFillColor(236, 244, 255);
  doc.roundedRect(margin, y, usableWidth, 25, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 115);
  doc.text("TOTAL DE HORAS TÉCNICAS", margin + 8, y + 10);
  doc.setFontSize(15);
  doc.setTextColor(10, 132, 255);
  doc.text(`${totalHours.toFixed(2)}h`, pageWidth - margin - 8, y + 16, { align: "right" });

  const safeName = (input.projectName || "orcamento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`${safeName || "orcamento"}-robot-center.pdf`);
}
