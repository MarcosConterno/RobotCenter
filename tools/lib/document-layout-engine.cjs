const PNG_SIGNATURE = "89504e470d0a1a0a";
const EMU_PER_PIXEL_96_DPI = 9525;
const EMU_PER_TWIP = 635;

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function paragraphText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("");
}

function paragraphStyle(xml) {
  return xml.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] ?? "";
}

function editParagraphProperties(paragraph, editor) {
  const opening = paragraph.match(/^<w:p(?:\s[^>]*)?>/)?.[0];
  if (!opening) return paragraph;
  const existing = paragraph.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0];
  const body = existing ? existing.replace(/^<w:pPr(?:\s[^>]*)?>|<\/w:pPr>$/g, "") : "";
  const updated = `<w:pPr>${editor(body)}</w:pPr>`;
  return existing ? paragraph.replace(existing, updated) : paragraph.replace(opening, `${opening}${updated}`);
}

function removeProperty(body, name) {
  return body
    .replace(new RegExp(`<w:${name}(?:\\s[^>]*)?\\/>`, "g"), "")
    .replace(new RegExp(`<w:${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:${name}>`, "g"), "");
}

function flowingProperties(paragraph, { before, after, alignment = "left", widow = true, keepNext = false }) {
  return editParagraphProperties(paragraph, (initial) => {
    let body = initial;
    for (const property of ["pageBreakBefore", "keepNext", "keepLines", "spacing", "jc", "widowControl"]) body = removeProperty(body, property);
    body += `<w:spacing w:before="${before}" w:after="${after}"/>`;
    body += `<w:jc w:val="${alignment}"/>`;
    if (alignment === "left") {
      if (/<w:ind\b[^>]*\/>/.test(body)) {
        body = body.replace(/<w:ind\b[^>]*\/>/, (tag) => /w:right="\d+"/.test(tag)
          ? tag.replace(/w:right="\d+"/, 'w:right="720"')
          : tag.replace(/\/>$/, ' w:right="720"/>'));
      } else {
        body += '<w:ind w:right="720"/>';
      }
    }
    if (widow) body += "<w:widowControl/>";
    if (keepNext) body += "<w:keepNext/>";
    return body;
  }).replace(/<w:br(?:\s[^>]*)?w:type="page"(?:\s[^>]*)?\/>/g, "");
}

function headingProperties(paragraph) {
  return editParagraphProperties(paragraph, (initial) => {
    let body = removeProperty(removeProperty(initial, "keepNext"), "widowControl");
    body += "<w:keepNext/><w:widowControl/>";
    return body;
  });
}

function setSectionProperties(paragraph, sectionProperties) {
  return editParagraphProperties(paragraph, (initial) => {
    const withoutSection = initial.replace(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g, "");
    return `${withoutSection}${sectionProperties}`;
  });
}

function sectionVariant(sectionProperties, { type, top, bottom, titlePage }) {
  let updated = sectionProperties
    .replace(/<w:type(?:\s[^>]*)?\/>/g, "")
    .replace(/<w:pgNumType(?:\s[^>]*)?\/>/g, "")
    .replace(/<w:titlePg(?:\s[^>]*)?\/>/g, "");
  if (top != null || bottom != null) {
    updated = updated.replace(/<w:pgMar\b[^>]*\/>/, (tag) => {
      let margins = tag;
      if (top != null) margins = margins.replace(/w:top="\d+"/, `w:top="${top}"`);
      if (bottom != null) margins = margins.replace(/w:bottom="\d+"/, `w:bottom="${bottom}"`);
      return margins;
    });
  }
  updated = updated.replace(/<w:sectPr([^>]*)>/, `<w:sectPr$1><w:type w:val="${type}"/>`);
  if (titlePage) updated = updated.replace(/<\/w:sectPr>/, "<w:titlePg/></w:sectPr>");
  return updated;
}

function splitTextAndDrawing(paragraph) {
  const runs = [...paragraph.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)].map((match) => match[0]);
  const drawingRuns = runs.filter((run) => /<w:drawing\b/.test(run));
  if (!drawingRuns.length) return null;
  let textParagraph = paragraph;
  for (const run of drawingRuns) textParagraph = textParagraph.replace(run, "");
  let imageParagraph = paragraph;
  for (const run of runs) if (!/<w:drawing\b/.test(run)) imageParagraph = imageParagraph.replace(run, "");
  imageParagraph = imageParagraph.replace(/<w:hyperlink(?:\s[^>]*)?>\s*<\/w:hyperlink>/g, "");
  return { textParagraph, imageParagraph };
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function availableWidthEmu(documentXml) {
  const sections = [...documentXml.matchAll(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)];
  const section = sections.at(-1)?.[0] ?? "";
  const pageWidth = Number(section.match(/<w:pgSz[^>]*w:w="(\d+)"/)?.[1] ?? 11906);
  const marginTag = section.match(/<w:pgMar[^>]*\/>/)?.[0] ?? "";
  const left = Number(marginTag.match(/w:left="(\d+)"/)?.[1] ?? 1440);
  const right = Number(marginTag.match(/w:right="(\d+)"/)?.[1] ?? 1440);
  const gutter = Number(marginTag.match(/w:gutter="(\d+)"/)?.[1] ?? 0);
  return Math.max(1, pageWidth - left - right - gutter) * EMU_PER_TWIP;
}

function relationshipsMap(relsXml) {
  const map = new Map();
  for (const relationship of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = relationship[0].match(/\bId="([^"]+)"/)?.[1];
    const target = relationship[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, target.replace(/^\.\.\//, ""));
  }
  return map;
}

async function inlineImages(paragraph, { zip, relationships, maxWidth }) {
  let updated = paragraph;
  const anchors = [...paragraph.matchAll(/<wp:anchor(?:\s[^>]*)?>[\s\S]*?<\/wp:anchor>/g)].map((match) => match[0]);
  for (const anchor of anchors) {
    const relationshipId = anchor.match(/r:embed="([^"]+)"/)?.[1];
    const target = relationships.get(relationshipId);
    const entryName = target ? `word/${target.replace(/^\//, "")}` : "";
    const entry = entryName ? zip.file(entryName) : null;
    let cx = Number(anchor.match(/<wp:extent[^>]*cx="(\d+)"/)?.[1] ?? 0);
    let cy = Number(anchor.match(/<wp:extent[^>]*cy="(\d+)"/)?.[1] ?? 0);
    if (entry) {
      const dimensions = pngDimensions(await entry.async("nodebuffer"));
      if (dimensions) {
        cx = Math.min(dimensions.width * EMU_PER_PIXEL_96_DPI, maxWidth);
        cy = Math.round(cx * dimensions.height / dimensions.width);
      }
    }
    const extent = `<wp:extent cx="${cx}" cy="${cy}"/>`;
    const effectExtent = anchor.match(/<wp:effectExtent[^>]*\/>/)?.[0] ?? "";
    const docPr = anchor.match(/<wp:docPr[^>]*\/>/)?.[0] ?? "";
    const frame = anchor.match(/<wp:cNvGraphicFramePr(?:\s[^>]*)?>[\s\S]*?<\/wp:cNvGraphicFramePr>/)?.[0] ?? "";
    let graphic = anchor.match(/<a:graphic(?:\s[^>]*)?>[\s\S]*?<\/a:graphic>/)?.[0] ?? "";
    graphic = graphic.replace(/<a:ext cx="\d+" cy="\d+"\/>/g, `<a:ext cx="${cx}" cy="${cy}"/>`);
    const inline = `<wp:inline distT="0" distB="0" distL="0" distR="0">${extent}${effectExtent}${docPr}${frame}${graphic}</wp:inline>`;
    updated = updated.replace(anchor, inline);
  }
  const inlines = [...updated.matchAll(/<wp:inline(?:\s[^>]*)?>[\s\S]*?<\/wp:inline>/g)].map((match) => match[0]);
  for (const inline of inlines) {
    const relationshipId = inline.match(/r:embed="([^"]+)"/)?.[1];
    const target = relationships.get(relationshipId);
    const entryName = target ? `word/${target.replace(/^\//, "")}` : "";
    const entry = entryName ? zip.file(entryName) : null;
    if (!entry) continue;
    const dimensions = pngDimensions(await entry.async("nodebuffer"));
    if (!dimensions) continue;
    const cx = Math.min(dimensions.width * EMU_PER_PIXEL_96_DPI, maxWidth);
    const cy = Math.round(cx * dimensions.height / dimensions.width);
    const resized = inline
      .replace(/<wp:extent[^>]*cx="\d+"[^>]*cy="\d+"[^>]*\/>/, `<wp:extent cx="${cx}" cy="${cy}"/>`)
      .replace(/<a:ext cx="\d+" cy="\d+"\/>/g, `<a:ext cx="${cx}" cy="${cy}"/>`);
    updated = updated.replace(inline, resized);
  }
  return updated;
}

async function applyDocumentLayoutEngine({ zip, documentXml, relationshipsXml }) {
  const paragraphs = [...documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  const firstRequirement = paragraphs.findIndex((paragraph) => /^\[RF\d{3}/.test(paragraphText(paragraph)));
  let lastRequirement = -1;
  paragraphs.forEach((paragraph, index) => {
    if (/^\[(?:RF|RNF)\d{3}/.test(paragraphText(paragraph))) lastRequirement = index;
  });
  if (firstRequirement < 0 || lastRequirement < firstRequirement) throw new Error("Faixa dinâmica de requisitos não localizada.");

  let dynamicStart = firstRequirement;
  for (let index = firstRequirement - 1; index >= Math.max(0, firstRequirement - 8); index -= 1) {
    const text = paragraphText(paragraphs[index]).trim();
    const style = paragraphStyle(paragraphs[index]);
    if (/heading|t[ií]tulo/i.test(style) || /^\d+(?:\.\d+)+\s+\S/.test(text)) {
      dynamicStart = index;
      break;
    }
  }

  const finalSection = [...documentXml.matchAll(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)].at(-1)?.[0];
  if (!finalSection) throw new Error("Propriedades de seção do template não localizadas.");
  const preDynamicSection = sectionVariant(finalSection, { type: "continuous", titlePage: false });
  const dynamicSection = sectionVariant(finalSection, { type: "nextPage", top: 1440, bottom: 2160, titlePage: false });

  const relationships = relationshipsMap(relationshipsXml);
  const maxWidth = Math.round(availableWidthEmu(documentXml) * 0.9);
  const output = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const original = paragraphs[index];
    const text = paragraphText(original).trim();
    const style = paragraphStyle(original);
    const isHeading = /heading|t[ií]tulo/i.test(style) || /^\d+(?:\.\d+)+\s+\S/.test(text);
    const inDynamicRange = index >= dynamicStart && index <= lastRequirement;

    let updated = original;
    if (isHeading) updated = headingProperties(updated);
    if (text.startsWith("O Acesso deverá acontecer pelo Loy Trust")) {
      updated = flowingProperties(updated, { before: 60, after: 60 });
    }
    if (inDynamicRange) {
      const isRequirement = /^\[(?:RF|RNF)\d{3}\]/.test(text);
      const isSubRequirement = /^\[(?:RF|RNF)\d{3}\.\d{3}\]/.test(text);
      const hasImage = /<(?:wp:anchor|wp:inline)\b/.test(updated);
      const isSafeEmpty = !text && !hasImage && !/<w:(?:bookmark|sectPr|br)\b/.test(updated);
      if (isSafeEmpty) {
        output.push("");
        continue;
      }

      if (hasImage && text) {
        const split = splitTextAndDrawing(updated);
        if (!split) throw new Error(`Não foi possível separar texto e imagem no parágrafo ${index}.`);
        let textPart = split.textParagraph;
        if (isSubRequirement) textPart = flowingProperties(textPart, { before: 100, after: 60 });
        else if (isRequirement) textPart = flowingProperties(textPart, { before: 160, after: 60 });
        else textPart = flowingProperties(textPart, { before: 60, after: 60 });
        let imagePart = await inlineImages(split.imageParagraph, { zip, relationships, maxWidth });
        imagePart = flowingProperties(imagePart, { before: 60, after: 120, alignment: "center", widow: false });
        updated = `${textPart}${imagePart}`;
      } else if (hasImage) {
        updated = await inlineImages(updated, { zip, relationships, maxWidth });
        updated = flowingProperties(updated, { before: 60, after: 120, alignment: "center", widow: false });
      } else if (isSubRequirement) {
        updated = flowingProperties(updated, { before: 100, after: 60 });
      } else if (isRequirement) {
        updated = flowingProperties(updated, { before: 160, after: 60 });
      } else if (isHeading) {
        updated = headingProperties(updated);
      } else {
        updated = flowingProperties(updated, { before: 60, after: 60 });
      }
    }
    if (index === dynamicStart - 1) updated = setSectionProperties(updated, preDynamicSection);
    if (index === lastRequirement) updated = setSectionProperties(updated, dynamicSection);
    output.push(updated);
  }

  let cursor = 0;
  let result = documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, () => output[cursor++]);
  const finalSectionStart = result.lastIndexOf("<w:sectPr");
  if (finalSectionStart >= 0) {
    const before = result.slice(0, finalSectionStart);
    const final = result.slice(finalSectionStart).replace(/<w:pgNumType(?:\s[^>]*)?\/>/g, "");
    result = before + final;
  }
  return result;
}

module.exports = { applyDocumentLayoutEngine };
