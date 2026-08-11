"use client";

import { List, ListChecks, ListOrdered, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import styles from "@/app/minha-pagina/MinhaPagina.module.css";

const RICH_TEXT_MARKER = "<!--robot-center-rich-text-->";

type EditorCommand = "bullets" | "checklist" | "ordered";

interface SlashCommand {
  id: EditorCommand;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: "bullets", label: "Tópicos", description: "Lista com bolinhas", Icon: List },
  { id: "checklist", label: "Checkbox", description: "Itens que podem ser marcados", Icon: ListChecks },
  { id: "ordered", label: "Lista", description: "Lista numerada", Icon: ListOrdered },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notesToHtml(value: string) {
  if (value.startsWith(RICH_TEXT_MARKER)) return value.slice(RICH_TEXT_MARKER.length);
  if (!value) return "";
  return value
    .split("\n")
    .map((line) => line ? `<div>${escapeHtml(line)}</div>` : "<div><br></div>")
    .join("");
}

export function richTextToPlainText(value: string) {
  if (!value.startsWith(RICH_TEXT_MARKER)) return value;
  return value
    .slice(RICH_TEXT_MARKER.length)
    .replace(/<input[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "☑ ")
    .replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, "☐ ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serializeEditor(editor: HTMLDivElement) {
  const clone = editor.cloneNode(true) as HTMLDivElement;
  const sourceCheckboxes = editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const clonedCheckboxes = clone.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  sourceCheckboxes.forEach((checkbox, index) => {
    if (checkbox.checked) clonedCheckboxes[index]?.setAttribute("checked", "");
    else clonedCheckboxes[index]?.removeAttribute("checked");
  });
  return `${RICH_TEXT_MARKER}${clone.innerHTML}`;
}

function currentSlashQuery() {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.anchorNode || selection.anchorNode.nodeType !== Node.TEXT_NODE) return null;
  const text = selection.anchorNode.textContent?.slice(0, selection.anchorOffset) ?? "";
  const match = text.match(/(?:^|\n)\/([^/\n]*)$/);
  if (!match) return null;
  return { node: selection.anchorNode, start: selection.anchorOffset - match[1].length - 1, query: match[1].trim().toLocaleLowerCase("pt-BR") };
}

export default function MeetingNotesEditor({
  value,
  onChange,
  ariaLabel = "Editor de texto",
  placeholder = "Escreva livremente ou digite / para inserir um bloco...",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!editorRef.current || value === lastEmittedValue.current) return;
    editorRef.current.innerHTML = notesToHtml(value);
  }, [value]);

  function emitChange() {
    if (!editorRef.current) return;
    const next = serializeEditor(editorRef.current);
    lastEmittedValue.current = next;
    onChange(next);
  }

  function runDocumentCommand(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emitChange();
  }

  function insertChecklist() {
    runDocumentCommand(
      "insertHTML",
      `<div class="${styles.meetingEditorChecklist}"><input type="checkbox" contenteditable="false" aria-label="Marcar item" /><span>&nbsp;</span></div>`,
    );
  }

  function runEditorCommand(command: EditorCommand) {
    if (command === "bullets") runDocumentCommand("insertUnorderedList");
    else if (command === "ordered") runDocumentCommand("insertOrderedList");
    else insertChecklist();
  }

  function selectSlashCommand(command: EditorCommand) {
    const slash = currentSlashQuery();
    if (slash) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(slash.node, slash.start);
      range.setEnd(slash.node, selection?.anchorOffset ?? slash.start);
      range.deleteContents();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setSlashQuery(null);
    runEditorCommand(command);
  }

  function handleInput() {
    setSlashQuery(currentSlashQuery()?.query ?? null);
    emitChange();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setSlashQuery(null);
      return;
    }
    if (event.key !== " ") return;

    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!selection?.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE) return;
    const beforeCaret = node.textContent?.slice(0, selection.anchorOffset) ?? "";
    if (beforeCaret.trim() !== "*") return;

    event.preventDefault();
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, selection.anchorOffset);
    range.deleteContents();
    runDocumentCommand("insertUnorderedList");
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    runDocumentCommand("insertText", event.clipboardData.getData("text/plain"));
  }

  const visibleCommands = slashQuery === null
    ? []
    : SLASH_COMMANDS.filter((command) => `${command.label} ${command.description}`.toLocaleLowerCase("pt-BR").includes(slashQuery));

  return (
    <div className={styles.meetingEditorShell}>
      <div
        className={styles.meetingEditorToolbar}
        role="toolbar"
        aria-label="Formatação das anotações"
        onMouseDown={(event) => {
          if ((event.target as Element).closest("button")) event.preventDefault();
        }}
      >
        <button type="button" onClick={() => runEditorCommand("bullets")} title="Tópicos" aria-label="Criar tópicos"><List size={15} /></button>
        <button type="button" onClick={() => runEditorCommand("checklist")} title="Checkbox" aria-label="Criar checkbox"><ListChecks size={15} /></button>
        <button type="button" onClick={() => runEditorCommand("ordered")} title="Lista numerada" aria-label="Criar lista numerada"><ListOrdered size={15} /></button>
      </div>
      <div className={styles.meetingEditorBody}>
        <div
          ref={editorRef}
          className={styles.meetingEditorContent}
          contentEditable
          role="textbox"
          aria-label={ariaLabel}
          aria-multiline="true"
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onChangeCapture={emitChange}
        />
        {slashQuery !== null && (
          <div className={styles.meetingEditorSlashMenu} role="menu" aria-label="Inserir bloco">
            <small>INSERIR BLOCO</small>
            {visibleCommands.length > 0 ? visibleCommands.map(({ id, label, description, Icon }) => (
              <button key={id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSlashCommand(id)}>
                <span><Icon size={15} /></span>
                <div><strong>{label}</strong><p>{description}</p></div>
              </button>
            )) : <p className={styles.meetingEditorNoCommand}>Nenhum comando encontrado.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
