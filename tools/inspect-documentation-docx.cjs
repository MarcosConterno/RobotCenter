const fs = require("fs");
const JSZip = require("jszip");

const input = "C:/Users/Marcos Trabalho/Downloads/Costa, Vieira - Cadastro de Andamentos Allianz.docx";

function decode(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function paragraphs(xml) {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match, index) => {
    const text = [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((item) => decode(item[1]))
      .join("");
    const drawings = [...match[0].matchAll(/r:embed="([^"]+)"/g)].map((item) => item[1]);
    return { index, text, drawings };
  }).filter((item) => item.text || item.drawings.length);
}

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(input));
  for (const part of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
    const entry = zip.file(part);
    if (!entry) continue;
    const xml = await entry.async("string");
    console.log(`\n=== ${part} ===`);
    for (const item of paragraphs(xml)) {
      if (/Cadastro de Andamentos|Allianz|\[?RF\d+/i.test(item.text) || item.drawings.length) {
        console.log(JSON.stringify(item));
      }
    }
  }
  console.log("\n=== media ===");
  for (const name of Object.keys(zip.files).filter((name) => name.startsWith("word/media/"))) {
    const data = await zip.file(name).async("nodebuffer");
    console.log(`${name}\t${data.length}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
