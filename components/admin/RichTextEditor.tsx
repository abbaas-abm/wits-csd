"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Write the event details...",
  className,
}: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused && el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value, focused]);

  const refreshActive = React.useCallback(() => {
    if (typeof document === "undefined") return;
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState(
          "insertUnorderedList",
        ),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        justifyFull: document.queryCommandState("justifyFull"),
      });
    } catch {
      setActive({});
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () =>
      document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  function emit() {
    onChange(ref.current?.innerHTML ?? "");
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
    refreshActive();
  }

  function formatBlock(tag: string) {
    ref.current?.focus();
    document.execCommand("formatBlock", false, tag);
    emit();
    refreshActive();
  }

  function addLink() {
    const url = window.prompt("Enter the link URL", "https://");
    if (!url) return;
    exec("createLink", url);
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-input bg-white", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-slate-50 p-1.5">
        <ToolButton
          label="Bold"
          active={active.bold}
          onClick={() => exec("bold")}
        >
          <Bold className="size-4" />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={active.italic}
          onClick={() => exec("italic")}
        >
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton
          label="Underline"
          active={active.underline}
          onClick={() => exec("underline")}
        >
          <Underline className="size-4" />
        </ToolButton>
        <ToolButton
          label="Strikethrough"
          active={active.strikeThrough}
          onClick={() => exec("strikeThrough")}
        >
          <Strikethrough className="size-4" />
        </ToolButton>

        <Divider />

        <ToolButton label="Heading" onClick={() => formatBlock("H2")}>
          <Heading2 className="size-4" />
        </ToolButton>
        <ToolButton label="Subheading" onClick={() => formatBlock("H3")}>
          <Heading3 className="size-4" />
        </ToolButton>
        <ToolButton label="Paragraph" onClick={() => formatBlock("P")}>
          <Pilcrow className="size-4" />
        </ToolButton>

        <Divider />

        <ToolButton
          label="Bullet list"
          active={active.insertUnorderedList}
          onClick={() => exec("insertUnorderedList")}
        >
          <List className="size-4" />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={active.insertOrderedList}
          onClick={() => exec("insertOrderedList")}
        >
          <ListOrdered className="size-4" />
        </ToolButton>
        <ToolButton label="Quote" onClick={() => formatBlock("BLOCKQUOTE")}>
          <Quote className="size-4" />
        </ToolButton>
        <ToolButton label="Code" onClick={() => formatBlock("PRE")}>
          <Code2 className="size-4" />
        </ToolButton>

        <Divider />

        <ToolButton
          label="Align left"
          active={active.justifyLeft}
          onClick={() => exec("justifyLeft")}
        >
          <AlignLeft className="size-4" />
        </ToolButton>
        <ToolButton
          label="Align centre"
          active={active.justifyCenter}
          onClick={() => exec("justifyCenter")}
        >
          <AlignCenter className="size-4" />
        </ToolButton>
        <ToolButton
          label="Align right"
          active={active.justifyRight}
          onClick={() => exec("justifyRight")}
        >
          <AlignRight className="size-4" />
        </ToolButton>
        <ToolButton
          label="Justify"
          active={active.justifyFull}
          onClick={() => exec("justifyFull")}
        >
          <AlignJustify className="size-4" />
        </ToolButton>

        <Divider />

        <ToolButton label="Link" onClick={addLink}>
          <Link2 className="size-4" />
        </ToolButton>
        <ToolButton label="Clear formatting" onClick={() => exec("removeFormat")}>
          <Eraser className="size-4" />
        </ToolButton>

        <Divider />

        <ToolButton label="Undo" onClick={() => exec("undo")}>
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton label="Redo" onClick={() => exec("redo")}>
          <Redo2 className="size-4" />
        </ToolButton>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onFocus={() => {
          setFocused(true);
          refreshActive();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        className="prose prose-slate min-h-64 max-w-none px-4 py-3 text-sm focus:outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-white hover:text-gray-900",
        active && "bg-white text-primary shadow-sm",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />;
}
