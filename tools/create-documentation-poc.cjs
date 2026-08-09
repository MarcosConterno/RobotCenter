const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const JSZip = require("jszip");
const { applyDocumentLayoutEngine } = require("./lib/document-layout-engine.cjs");

const input = "C:/Users/Marcos Trabalho/Downloads/Costa, Vieira - Cadastro de Andamentos Allianz.docx";
const suppliedImage = "C:/Users/Marcos Trabalho/Downloads/teste-rf-imagem.png";
const outputDir = path.resolve("output/documents");
const output = path.join(outputDir, "teste-documentacao-v2.docx");

const newRf002 = '[RF002] O robô Loy deverá preencher os campos "Usuário" e "Senha" utilizando as credenciais configuradas para o acesso à AllianzNet. Após o preenchimento, deverá concluir o processo de autenticação clicando no botão “Iniciar Sessão”.';
const newRf003 = "[RF003] Após realizar o login com sucesso, o robô deverá validar se a página inicial da AllianzNet foi carregada corretamente antes de prosseguir para o próximo passo. Caso a página não seja carregada, o processamento deverá retornar erro e não continuar o fluxo.";

function decode(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function encode(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decode(match[1])).join("");
}

function replaceParagraphText(paragraph, text) {
  let first = true;
  return paragraph.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (node) => {
    if (!first) return node.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/, "$1$2");
    first = false;
    return node.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/, `$1${encode(text)}$2`);
  });
}

function replaceVisibleText(paragraph, search, replacement) {
  const current = paragraphText(paragraph);
  if (!current.includes(search)) return paragraph;
  return replaceParagraphText(paragraph, current.replace(search, replacement));
}

function freshParagraphIds(paragraph) {
  const id = crypto.randomBytes(4).toString("hex").toUpperCase();
  const textId = crypto.randomBytes(4).toString("hex").toUpperCase();
  return paragraph
    .replace(/w14:paraId="[^"]+"/, `w14:paraId="${id}"`)
    .replace(/w14:textId="[^"]+"/, `w14:textId="${textId}"`);
}

(async () => {
  const originalBuffer = fs.readFileSync(input);
  const zip = await JSZip.loadAsync(originalBuffer);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) throw new Error("word/document.xml não encontrado.");
  let xml = await documentEntry.async("string");
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);

  const coverTitle = paragraphs.find((p) => paragraphText(p) === "Cadastro de Andamentos");
  const coverSystem = paragraphs.find((p) => paragraphText(p) === "Allianz");
  const rf002 = paragraphs.find((p) => paragraphText(p).startsWith("[RF002]"));
  const currentRf003 = paragraphs.find((p) => paragraphText(p).startsWith("[RF003]"));
  const rf002Index = paragraphs.indexOf(rf002);
  const currentRf003Index = paragraphs.indexOf(currentRf003);
  const imageAfterRf002 = paragraphs.slice(rf002Index + 1, currentRf003Index).find((p) => /r:embed="rId8"/.test(p));
  if (!coverTitle || !coverSystem || !rf002 || !currentRf003 || !imageAfterRf002) {
    throw new Error("A estrutura esperada da capa/RF002/RF003/imagem rId8 não foi localizada.");
  }

  const embeddedImage = await zip.file("word/media/image12.png").async("nodebuffer");
  const suppliedImageBuffer = fs.readFileSync(suppliedImage);
  if (!embeddedImage.equals(suppliedImageBuffer)) {
    throw new Error("A imagem fornecida não é idêntica à image12.png do DOCX original.");
  }

  xml = xml.replace(coverTitle, replaceParagraphText(coverTitle, "ROBÔ TESTE DE DOCUMENTAÇÃO"));
  xml = xml.replace(coverSystem, replaceParagraphText(coverSystem, "SISTEMA TESTE"));
  xml = xml.replace(rf002, replaceParagraphText(rf002, newRf002));

  let newRfParagraph = freshParagraphIds(replaceParagraphText(currentRf003, newRf003));
  let newImageParagraph = freshParagraphIds(imageAfterRf002);
  const maxDocPr = Math.max(0, ...[...xml.matchAll(/<wp:docPr[^>]*\bid="(\d+)"/g)].map((match) => Number(match[1])));
  newImageParagraph = newImageParagraph.replace(/(<wp:docPr[^>]*\bid=")\d+("?)/, `$1${maxDocPr + 1}$2`);
  xml = xml.replace(currentRf003, `${newRfParagraph}${newImageParagraph}${currentRf003}`);

  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphText(paragraph);
    if (text === newRf003) return paragraph;
    const normalized = text.replace(/^\[RFO0?4(?=\.|\])/, "[RF004");
    if (!/^\[RF\d{3}(?:\.\d{3})?\]/.test(normalized)) return paragraph;
    const renumbered = normalized.replace(/^\[RF(\d{3})(\.\d{3})?\]/, (token, number, suffix = "") => {
      const value = Number(number);
      return value >= 3 ? `[RF${String(value + 1).padStart(3, "0")}${suffix}]` : token;
    });
    return renumbered !== text ? replaceParagraphText(paragraph, renumbered) : paragraph;
  });

  const relationshipsXml = await zip.file("word/_rels/document.xml.rels").async("string");
  xml = await applyDocumentLayoutEngine({ zip, documentXml: xml, relationshipsXml });
  zip.file("word/document.xml", xml);
  fs.mkdirSync(outputDir, { recursive: true });
  const result = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  const verificationZip = await JSZip.loadAsync(result);
  const verificationXml = await verificationZip.file("word/document.xml").async("string");
  const verificationText = [...verificationXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decode(match[1])).join("\n");
  for (const expected of ["ROBÔ TESTE DE DOCUMENTAÇÃO", "SISTEMA TESTE", newRf002, newRf003, "[RF004]", "[RF005.001]", "[RF005.018]"]) {
    if (!verificationText.includes(expected)) throw new Error(`Validação falhou: ${expected}`);
  }
  if (/\[(?:RF004|RFO0?4)\./.test(verificationText)) throw new Error("Validação falhou: existem sub-RFs RF004.xxx não renumeradas.");
  fs.writeFileSync(output, result);
  console.log(`DOCX criado: ${output}`);
  console.log("Imagem original validada por comparação binária e reutilizada via rId8.");
  console.log("RFs validadas: RF003 nova, RF003 anterior → RF004 e RF004.* → RF005.*.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
