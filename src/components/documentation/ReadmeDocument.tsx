"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import styles from "./ReadmeDocument.module.css";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "code"; language: string; value: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "rule" };

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function cleanSource(source: string) {
  return source
    .replace(/<div align="center">/g, "")
    .replace(/<\/div>/g, "")
    .replace(/<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+width="([^"]+)"\s*\/>/g, "![$2]($1)")
    .replace(/\]\(public\/images\//g, "](/images/")
    .trim();
}

function parseMarkdown(source: string): Block[] {
  const lines = cleanSource(source).split(/\r?\n/);
  const blocks: Block[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? "";
    if (!line.trim()) { index += 1; continue; }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ type: "code", language, value: code.join("\n") });
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]?.length ?? 2, text: heading[2] ?? "" });
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index]?.trimStart().startsWith(">")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const unordered = /^\s*-\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      const expression = isOrdered ? /^\s*\d+\.\s+(.+)$/ : /^\s*-\s+(.+)$/;
      while (index < lines.length) {
        const match = expression.exec(lines[index] ?? "");
        if (!match) break;
        items.push(match[1] ?? "");
        index += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? "";
      if (!next.trim() || next.startsWith("#") || next.startsWith("```") || next.trimStart().startsWith(">") || /^\s*(-|\d+\.)\s+/.test(next) || /^---+$/.test(next.trim())) break;
      if (next.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1] ?? "")) break;
      paragraph.push(next.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function Inline({ text, onOpenDocument }: { text: string; onOpenDocument?: (target: string) => boolean }) {
  const pattern = /(!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const pieces = text.split(pattern).filter(Boolean);

  return <>{pieces.map((piece, index) => {
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(piece);
    if (image) return <img key={`${piece}-${index}`} className={styles.inlineImage} src={image[2] ?? ""} alt={image[1] ?? ""} />;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(piece);
    if (link) {
      const target = link[2] ?? "#";
      const external = /^https?:\/\//.test(target);
      const internalDocument = !external && target.endsWith(".md");
      if (internalDocument && onOpenDocument) return <button key={`${piece}-${index}`} type="button" className={styles.inlineLink} onClick={() => onOpenDocument(target)}>{link[1]}</button>;
      return <a key={`${piece}-${index}`} href={target} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{link[1]}{external ? <ExternalLink size={11} aria-hidden="true" /> : null}</a>;
    }
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={`${piece}-${index}`}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith("`") && piece.endsWith("`")) return <code key={`${piece}-${index}`}>{piece.slice(1, -1)}</code>;
    return <Fragment key={`${piece}-${index}`}>{piece}</Fragment>;
  })}</>;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}><span>{language || "texto"}</span><button type="button" onClick={copy} aria-label="Copiar conteúdo do bloco de código">{copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? "Copiado" : "Copiar"}</button></div>
    <pre><code>{value}</code></pre>
  </div>;
}

function anchorFor(text: string) {
  return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function ReadmeDocument({ source, onOpenDocument }: { source: string; onOpenDocument?: (target: string) => boolean }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  const navigation = useMemo(
    () => blocks.filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading" && block.level === 2),
    [blocks],
  );

  return <div className={styles.readmeLayout}>
    <aside className={styles.toc}>
      <span>Neste documento</span>
      <nav>{navigation.map((item) => <button key={item.text} type="button" onClick={() => document.getElementById(anchorFor(item.text))?.scrollIntoView({ behavior: "smooth", block: "start" })}>{item.text}</button>)}</nav>
    </aside>
    <div className={styles.markdown}>
      {blocks.map((block, index): ReactNode => {
        if (block.type === "heading") {
          const id = anchorFor(block.text);
          if (block.level === 1) return <h1 key={index} id={id}><Inline text={block.text} onOpenDocument={onOpenDocument} /></h1>;
          if (block.level === 2) return <h2 key={index} id={id}><Inline text={block.text} onOpenDocument={onOpenDocument} /></h2>;
          if (block.level === 3) return <h3 key={index} id={id}><Inline text={block.text} onOpenDocument={onOpenDocument} /></h3>;
          return <h4 key={index} id={id}><Inline text={block.text} onOpenDocument={onOpenDocument} /></h4>;
        }
        if (block.type === "paragraph") return <p key={index}><Inline text={block.text} onOpenDocument={onOpenDocument} /></p>;
        if (block.type === "rule") return <hr key={index} />;
        if (block.type === "quote") return <blockquote key={index}>{block.lines.map((line) => <p key={line}><Inline text={line} onOpenDocument={onOpenDocument} /></p>)}</blockquote>;
        if (block.type === "code") return <CodeBlock key={index} language={block.language} value={block.value} />;
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return <Tag key={index}>{block.items.map((item) => <li key={item}><Inline text={item} onOpenDocument={onOpenDocument} /></li>)}</Tag>;
        }
        if (block.type === "table") return <div key={index} className={styles.tableScroll}><table><thead><tr>{block.headers.map((cell) => <th key={cell}><Inline text={cell} onOpenDocument={onOpenDocument} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}><Inline text={cell} onOpenDocument={onOpenDocument} /></td>)}</tr>)}</tbody></table></div>;
        return null;
      })}
    </div>
  </div>;
}
