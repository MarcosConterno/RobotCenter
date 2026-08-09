const JSZip = require("jszip");
const crypto = require("node:crypto");
const { applyDocumentLayoutEngine } = require("../../../tools/lib/document-layout-engine.cjs");

function decode(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function encode(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function paragraphText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decode(match[1])).join("");
}
function replaceParagraphText(paragraph, text) {
  let first = true;
  const updated = paragraph.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (node) => {
    if (!first) return node.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/, "$1$2");
    first = false;
    return node.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/, `$1${encode(text)}$2`);
  });
  if (!first) return updated;
  return updated.replace(/<\/w:p>$/, `<w:r><w:t xml:space="preserve">${encode(text)}</w:t></w:r></w:p>`);
}
function freshParagraphIds(paragraph) {
  const id = crypto.randomBytes(4).toString("hex").toUpperCase();
  const textId = crypto.randomBytes(4).toString("hex").toUpperCase();
  return paragraph.replace(/w14:paraId="[^"]+"/, `w14:paraId="${id}"`).replace(/w14:textId="[^"]+"/, `w14:textId="${textId}"`);
}
function paragraphAlignment(paragraph, alignment) {
  const value = alignment === "right" ? "right" : alignment === "left" ? "left" : "center";
  if (/<w:jc\b[^>]*\/>/.test(paragraph)) return paragraph.replace(/<w:jc\b[^>]*\/>/, `<w:jc w:val="${value}"/>`);
  if (/<w:pPr(?:\s[^>]*)?>/.test(paragraph)) return paragraph.replace(/<w:pPr(?:\s[^>]*)?>/, (tag) => `${tag}<w:jc w:val="${value}"/>`);
  return paragraph.replace(/^<w:p(?:\s[^>]*)?>/, (tag) => `${tag}<w:pPr><w:jc w:val="${value}"/></w:pPr>`);
}
function relationshipTarget(rels, relationshipId) {
  const entry = [...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find((match) => match[0].includes(`Id="${relationshipId}"`));
  return entry?.[0].match(/Target="([^"]+)"/)?.[1];
}
function versionLabel(number) { return `v1.${Math.max(0, Number(number) - 1)}`; }

const COVER_WIDTH_EMU = Math.round(15.93 * 360000);
const COVER_HEIGHT_EMU = Math.round(19.66 * 360000);

function resizeCoverArt(paragraph) {
  return paragraphAlignment(paragraph, "center")
    .replace(/<wp14:sizeRelH(?:\s[^>]*)?>[\s\S]*?<\/wp14:sizeRelH>/g, "")
    .replace(/<wp14:sizeRelV(?:\s[^>]*)?>[\s\S]*?<\/wp14:sizeRelV>/g, "")
    .replace(/<wp:extent\b[^>]*(?:\/>|>[\s\S]*?<\/wp:extent>)/, `<wp:extent cx="${COVER_WIDTH_EMU}" cy="${COVER_HEIGHT_EMU}"/>`)
    .replace(/<a:ext\b[^>]*(?:\/>|>[\s\S]*?<\/a:ext>)/g, `<a:ext cx="${COVER_WIDTH_EMU}" cy="${COVER_HEIGHT_EMU}"/>`);
}

async function generateOfficialDocx({ template, snapshot, images }) {
  const zip = await JSZip.loadAsync(template);
  const documentEntry = zip.file("word/document.xml");
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (!documentEntry || !relsEntry) throw new Error("Template DOCX inválido: partes principais não encontradas.");
  let xml = await documentEntry.async("string");
  let rels = await relsEntry.async("string");
  let contentTypes = await zip.file("[Content_Types].xml").async("string");
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);

  const coverTitle = paragraphs.find((p) => paragraphText(p).trim() === "Cadastro de Andamentos");
  const coverSystem = paragraphs.find((p) => paragraphText(p).trim() === "Allianz");
  if (!coverTitle || !coverSystem) throw new Error("O template ativo não corresponde ao template oficial validado.");
  xml = xml.replace(coverTitle, replaceParagraphText(coverTitle, snapshot.robot.name));
  xml = xml.replace(coverSystem, replaceParagraphText(coverSystem, snapshot.robot.system));

  // A arte principal da capa é o último drawing antes do título. Alguns
  // conversores respeitam o extent gravado no template literalmente; por
  // isso normalizamos apenas esta arte com as dimensões aprovadas da capa.
  const coverTitleIndex = paragraphs.indexOf(coverTitle);
  const coverArtParagraph = [...paragraphs.slice(0, coverTitleIndex)].reverse().find((p) => /<w:drawing\b/.test(p));
  const coverArtDocPrId = coverArtParagraph?.match(/<wp:docPr\b[^>]*\bid="(\d+)"/)?.[1];
  if (coverArtParagraph) {
    // Medidas aprovadas no Word: largura 15,93 cm e altura 19,66 cm.
    // A arte original é quadrada, portanto os eixos devem ser definidos
    // separadamente; não recalcular a altura pela proporção da mídia.
    // OOXML usa EMU; 1 cm = 360.000 EMU.
    xml = xml.replace(coverArtParagraph, resizeCoverArt(coverArtParagraph));
  }

  const sectionPatterns = {
    objective: /Objetivo/i,
    reference_materials: /Materiais de Refer[eê]ncia/i,
    overview: /Vis[aã]o Geral/i,
    limitations: /Limita[cç][oõ]es e Restri[cç][oõ]es/i,
    scope: /Escopo do Sistema/i,
  };
  for (const [key, pattern] of Object.entries(sectionPatterns)) {
    const content = snapshot.sections.find((section) => section.key === key)?.content?.trim();
    if (!content) continue;
    const current = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
    const headingIndex = current.findIndex((p) => pattern.test(paragraphText(p)));
    const body = current.slice(headingIndex + 1).find((p) => {
      const value = paragraphText(p).trim();
      return value && !/^\d+(?:\.\d+)*\s/.test(value) && !/^\[(?:RF|RNF)\d{3}/.test(value);
    });
    if (headingIndex >= 0 && body) xml = xml.replace(body, replaceParagraphText(body, content));
  }

  const currentParagraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  const firstRf = currentParagraphs.findIndex((p) => /^\[RF\d{3}/.test(paragraphText(p).trim()));
  let lastRnf = -1;
  currentParagraphs.forEach((p, index) => { if (/^\[RNF\d{3}/.test(paragraphText(p).trim())) lastRnf = index; });
  if (firstRf < 0 || lastRnf < firstRf) throw new Error("A faixa de RFs/RNFs do template não foi localizada.");

  const rootTemplate = currentParagraphs[firstRf];
  const subTemplate = currentParagraphs.find((p) => /^\[RF\d{3}\.\d{3}/.test(paragraphText(p).trim())) ?? rootTemplate;
  const imageTemplate = currentParagraphs.slice(firstRf, lastRnf + 1).find((p) => /<w:drawing\b/.test(p));
  const bodyTemplate = currentParagraphs.slice(firstRf, lastRnf + 1).find((p) => {
    const value = paragraphText(p).trim();
    return value && !/^\[(?:RF|RNF)\d{3}/.test(value) && !/<w:drawing\b/.test(p) && !/Poss[ií]veis Erros|Requisitos N[aã]o Funcionais/i.test(value);
  }) ?? rootTemplate;
  const errorsHeading = currentParagraphs.slice(firstRf, lastRnf + 1).find((p) => /Poss[ií]veis Erros/i.test(paragraphText(p)));
  const rnfHeading = currentParagraphs.slice(firstRf, lastRnf + 1).find((p) => /Requisitos N[aã]o Funcionais/i.test(paragraphText(p)));
  if (!imageTemplate || !errorsHeading || !rnfHeading) throw new Error("O template não contém os elementos dinâmicos esperados.");

  const sourceRid = imageTemplate.match(/r:embed="([^"]+)"/)?.[1];
  const sourceTarget = sourceRid ? relationshipTarget(rels, sourceRid) : null;
  if (!sourceRid || !sourceTarget) throw new Error("Relacionamento de imagem do template não localizado.");
  let nextRid = Math.max(0, ...[...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  let nextDocPr = Math.max(0, ...[...xml.matchAll(/<wp:docPr[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  const sizeFactors = { small: 0.3, medium: 0.5, large: 0.72, full: 0.9 };
  const maxWidth = 6.3 * 914400;
  const desiredExtents = new Map();
  const dynamic = [];

  const allRequirements = [...snapshot.requirements, ...snapshot.nonFunctionalRequirements];
  const appendRequirement = async (requirement) => {
    dynamic.push(freshParagraphIds(replaceParagraphText(requirement.parentId ? subTemplate : rootTemplate, `[${requirement.generatedCode}] ${requirement.text}`)));
    const ownedBlocks = snapshot.blocks.filter((block) => block.requirementId === requirement.requirementId).sort((a, b) => a.order - b.order);
    for (const block of ownedBlocks) {
      if (block.type === "image") {
        const image = images.get(block.id);
        if (!image) throw new Error(`Imagem ${block.id} não foi carregada para a geração.`);
        const extension = block.image.mimeType === "image/png" ? "png" : block.image.mimeType === "image/webp" ? "webp" : "jpg";
        const mediaName = `robot-center-${block.id}.${extension}`;
        const rid = `rId${nextRid++}`;
        const marker = `RobotCenterImage-${block.id}`;
        zip.file(`word/media/${mediaName}`, image);
        rels = rels.replace(/<\/Relationships>$/, `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`);
        if (!new RegExp(`Extension="${extension}"`, "i").test(contentTypes)) {
          const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
          contentTypes = contentTypes.replace(/<\/Types>$/, `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`);
        }
        const factor = sizeFactors[block.image.sizePreset] ?? sizeFactors.large;
        const cx = Math.round(maxWidth * factor);
        const cy = Math.round(cx * block.image.height / block.image.width);
        desiredExtents.set(marker, { cx, cy, alignment: block.image.alignment });
        let paragraph = freshParagraphIds(imageTemplate)
          .replace(new RegExp(`r:embed="${sourceRid}"`, "g"), `r:embed="${rid}"`)
          .replace(/(<wp:docPr[^>]*\bid=")\d+("[^>]*)(?:name="[^"]*")?/, `$1${nextDocPr++}$2`)
          .replace(/<wp:docPr([^>]*)\bname="[^"]*"([^>]*)\/>/, `<wp:docPr$1name="${marker}"$2/>`)
          .replace(/<wp:extent[^>]*\/>/, `<wp:extent cx="${cx}" cy="${cy}"/>`)
          .replace(/<a:ext cx="\d+" cy="\d+"\/>/g, `<a:ext cx="${cx}" cy="${cy}"/>`);
        paragraph = paragraphAlignment(paragraph, block.image.alignment);
        dynamic.push(paragraph);
      } else if (block.type === "page_break") {
        dynamic.push(freshParagraphIds(bodyTemplate).replace(/<\/w:p>$/, '<w:r><w:br w:type="page"/></w:r></w:p>'));
      } else if (block.content?.trim()) {
        const prefix = block.type === "note" ? "Nota: " : "";
        dynamic.push(freshParagraphIds(replaceParagraphText(bodyTemplate, `${prefix}${block.content.trim()}`)));
      }
    }
  };

  for (const requirement of snapshot.requirements) await appendRequirement(requirement);
  dynamic.push(freshParagraphIds(errorsHeading));
  const errors = snapshot.sections.find((section) => section.key === "execution_errors")?.content?.trim();
  if (errors) dynamic.push(freshParagraphIds(replaceParagraphText(bodyTemplate, errors)));
  dynamic.push(freshParagraphIds(rnfHeading));
  for (const requirement of snapshot.nonFunctionalRequirements) await appendRequirement(requirement);

  const dynamicStart = xml.indexOf(currentParagraphs[firstRf]);
  const dynamicEnd = xml.indexOf(currentParagraphs[lastRnf], dynamicStart) + currentParagraphs[lastRnf].length;
  if (dynamicStart < 0 || dynamicEnd <= dynamicStart) throw new Error("Não foi possível substituir a faixa dinâmica do template.");
  xml = `${xml.slice(0, dynamicStart)}${dynamic.join("")}${xml.slice(dynamicEnd)}`;
  zip.file("word/_rels/document.xml.rels", rels);
  zip.file("[Content_Types].xml", contentTypes);
  xml = await applyDocumentLayoutEngine({ zip, documentXml: xml, relationshipsXml: rels });
  if (!coverArtDocPrId) throw new Error("Identificador da arte principal da capa não localizado.");
  const finalCoverPattern = new RegExp(`<w:p(?:\\s[^>]*)?>[\\s\\S]*?<wp:docPr\\b(?=[^>]*\\bid="${coverArtDocPrId}")[^>]*\\/>[\\s\\S]*?<\\/w:p>`);
  const finalCoverParagraph = xml.match(finalCoverPattern)?.[0];
  if (!finalCoverParagraph) throw new Error("Arte principal da capa não localizada após a paginação.");
  const finalCover = resizeCoverArt(finalCoverParagraph);
  const expectedExtent = `<wp:extent cx="${COVER_WIDTH_EMU}" cy="${COVER_HEIGHT_EMU}"/>`;
  if (!finalCover.includes(expectedExtent)) throw new Error("Não foi possível aplicar o tamanho aprovado à arte da capa.");
  xml = xml.replace(finalCoverParagraph, finalCover);
  for (const [marker, extent] of desiredExtents) {
    const paragraphPattern = new RegExp(`<w:p(?:\\s[^>]*)?>[\\s\\S]*?<wp:docPr[^>]*name="${marker}"[^>]*\\/>[\\s\\S]*?<\\/w:p>`);
    const match = xml.match(paragraphPattern)?.[0];
    if (!match) continue;
    const corrected = paragraphAlignment(match, extent.alignment)
      .replace(/<wp:extent[^>]*\/>/, `<wp:extent cx="${extent.cx}" cy="${extent.cy}"/>`)
      .replace(/<a:ext cx="\d+" cy="\d+"\/>/g, `<a:ext cx="${extent.cx}" cy="${extent.cy}"/>`);
    xml = xml.replace(match, corrected);
  }
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

module.exports = { generateOfficialDocx, versionLabel };
