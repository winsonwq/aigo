import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import type { Range } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

/** 从编辑器获取纯文本（含 @label、/label 等嵌入） */
export function getPlainText(editor: Editor | null): string {
  if (!editor) return "";
  const parts: string[] = [];
  editor.state.doc.descendants((node: { type: { name: string }; attrs: Record<string, unknown>; text?: string }) => {
    if (node.type.name === "text") {
      parts.push(node.text ?? "");
      return;
    }
    if (node.type.name === "mention") {
      const char = (node.attrs as { suggestion_char?: string }).suggestion_char ?? "@";
      const label =
        (node.attrs as { label?: string }).label ?? (node.attrs as { id?: string }).id ?? "";
      parts.push(`${char}${label}`);
      return;
    }
    if (node.type.name === "hardBreak") {
      parts.push("\n");
      return;
    }
  });
  return parts.join("");
}

/** 是否为空内容（无文本且无 mention） */
export function isEmpty(editor: Editor | null): boolean {
  if (!editor) return true;
  return getPlainText(editor).trim().length === 0;
}

/** @ 提及项（可后续改为从 props 或 API 注入） */
const MENTION_ITEMS = [
  { id: "user-1", label: "用户1" },
  { id: "user-2", label: "用户2" },
  { id: "agent", label: "Agent" },
];

/** / 命令项 */
const SLASH_ITEMS = [
  { id: "send", label: "发送" },
  { id: "newline", label: "换行" },
  { id: "code", label: "插入代码块" },
];

export type MessageInputProps = {
  placeholder?: string;
  disabled?: boolean;
  onSubmit: (plainText: string) => void | Promise<void>;
  /** 用于外部判断能否发送（如 canSend） */
  onContentChange?: (plainText: string, empty: boolean) => void;
};

export type MessageInputRef = {
  getPlainText: () => string;
  clearContent: () => void;
  isEmpty: () => boolean;
};

/** 富文本消息输入：自动高度、最大高度限制，支持 @ 与 / 的轻量嵌入，外观与原有 textarea 一致 */
export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  function MessageInput(
    {
      placeholder = "输入消息…",
      disabled = false,
      onSubmit,
      onContentChange,
    },
    ref
  ) {
    const [suggestionState, setSuggestionState] = useState<{
      active: boolean;
      range: Range | null;
      query: string;
      items: { id: string; label: string }[];
      command: ((p: {
        editor: Editor;
        range: Range;
        props: { id: string; label: string };
      }) => void) | null;
      char: "@" | "/";
      selectedIndex: number;
    }>({
      active: false,
      range: null,
      query: "",
      items: [],
      command: null,
      char: "@",
      selectedIndex: 0,
    });
    const suggestionRef = useRef({
      setState: setSuggestionState,
      items: [] as { id: string; label: string }[],
      selectedIndex: 0,
      command: null as typeof suggestionState.command,
      range: null as Range | null,
      editor: null as Editor | null,
    });
    suggestionRef.current.setState = setSuggestionState;
    suggestionRef.current.items = suggestionState.items;
    suggestionRef.current.selectedIndex = suggestionState.selectedIndex;
    suggestionRef.current.command = suggestionState.command;
    suggestionRef.current.range = suggestionState.range;

    const createSuggestionConfig = useCallback((char: "@" | "/") => {
      const items = char === "@" ? MENTION_ITEMS : SLASH_ITEMS;
      return {
        char,
        allowSpaces: false,
        startOfLine: char === "/",
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          if (!q) return items;
          return items.filter(
            (i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
          );
        },
        command: ({
          editor: ed,
          range,
          props: p,
        }: {
          editor: Editor;
          range: Range;
          props: { id: string; label: string };
        }) => {
          const node = ed.schema.nodes.mention.create({
            id: p.id,
            label: p.label,
            suggestion_char: char,
          });
          ed.chain().focus().insertContentAt(range, node).insertContent(" ").run();
        },
        render: () => {
          return {
            onStart: (props: SuggestionProps) => {
              suggestionRef.current.editor = props.editor;
              suggestionRef.current.items = (props.items || []) as { id: string; label: string }[];
              suggestionRef.current.selectedIndex = 0;
              suggestionRef.current.command = props.command as typeof suggestionState.command;
              suggestionRef.current.range = props.range;
              suggestionRef.current.setState({
                active: true,
                range: props.range,
                query: props.query,
                items: (props.items || []) as { id: string; label: string }[],
                command: props.command as typeof suggestionState.command,
                char,
                selectedIndex: 0,
              });
            },
            onUpdate: (props: SuggestionProps) => {
              suggestionRef.current.items = (props.items || []) as { id: string; label: string }[];
              suggestionRef.current.selectedIndex = 0;
              suggestionRef.current.command = props.command as typeof suggestionState.command;
              suggestionRef.current.range = props.range;
              suggestionRef.current.setState((prev) => ({
                ...prev,
                query: props.query,
                items: (props.items || []) as { id: string; label: string }[],
                command: props.command as typeof suggestionState.command,
                selectedIndex: 0,
              }));
            },
            onExit: () => {
              suggestionRef.current.setState((prev) => ({ ...prev, active: false }));
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              const r = suggestionRef.current;
              if (props.event.key === "ArrowDown") {
                props.event.preventDefault();
                const next = Math.min(r.selectedIndex + 1, Math.max(0, r.items.length - 1));
                r.selectedIndex = next;
                r.setState((prev) => ({ ...prev, selectedIndex: next }));
                return true;
              }
              if (props.event.key === "ArrowUp") {
                props.event.preventDefault();
                const next = Math.max(r.selectedIndex - 1, 0);
                r.selectedIndex = next;
                r.setState((prev) => ({ ...prev, selectedIndex: next }));
                return true;
              }
              if (props.event.key === "Enter" || props.event.key === "Tab") {
                props.event.preventDefault();
                const item = r.items[r.selectedIndex];
                const editorInstance = r.editor;
                if (r.command && item && editorInstance) {
                  r.command({
                    editor: editorInstance,
                    range: props.range,
                    props: item,
                  });
                }
                r.setState((prev) => ({ ...prev, active: false }));
                return true;
              }
              return false;
            },
          };
        },
      };
    }, []);

    const extensions = useMemo(
      () => [
        Document,
        Paragraph,
        Text,
        HardBreak,
        History,
        Placeholder.configure({
          placeholder,
          emptyNodeClass: "is-editor-empty",
          emptyEditorClass: "is-editor-empty",
        }),
        Mention.configure({
          HTMLAttributes: {
            class:
              "rounded bg-zinc-200/80 px-1 py-0.5 text-zinc-800 dark:bg-zinc-600/80 dark:text-zinc-200",
          },
          renderText({ node }: { node: { attrs: Record<string, unknown> } }) {
            const char =
              (node.attrs.suggestion_char as string | undefined) ?? "@";
            const label =
              (node.attrs.label as string | undefined) ??
              (node.attrs.id as string | undefined) ??
              "";
            return `${char}${label}`;
          },
          suggestions: [createSuggestionConfig("@") as never, createSuggestionConfig("/") as never],
        }),
      ],
      [placeholder, createSuggestionConfig]
    );

    const editor = useEditor({
      extensions,
      content: "",
      editable: !disabled,
      editorProps: {
        attributes: {
          class:
            "message-input-editor min-h-[80px] max-h-[200px] w-full overflow-y-auto bg-transparent px-4 py-3 text-base text-zinc-900 outline-none dark:text-zinc-100 " +
            "[&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:text-zinc-400 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] dark:[&_p.is-editor-empty:first-child::before]:text-zinc-500",
          "data-placeholder": placeholder,
        },
        handleKeyDown: (_view, event: KeyboardEvent) => {
          if (event.key === "Enter" && !event.shiftKey) {
            if (event.isComposing) return false;
            event.preventDefault();
            const text = getPlainText(editor);
            if (text.trim()) {
              void onSubmit(text);
              editor?.commands.clearContent();
            }
            return true;
          }
          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            editor?.commands.setHardBreak();
            return true;
          }
          return false;
        },
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        getPlainText: () => getPlainText(editor),
        clearContent: () => editor?.commands.clearContent(),
        isEmpty: () => isEmpty(editor),
      }),
      [editor]
    );

    useEffect(() => {
      if (!editor || !onContentChange) return;
      const sync = () => {
        onContentChange(getPlainText(editor), isEmpty(editor));
      };
      sync();
      editor.on("update", sync);
      return () => {
        editor.off("update", sync);
      };
    }, [editor, onContentChange]);

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    const selectSuggestion = useCallback(
      (item: { id: string; label: string }) => {
        if (suggestionState.command && suggestionState.range && editor) {
          suggestionState.command({
            editor,
            range: suggestionState.range,
            props: item,
          });
        }
        setSuggestionState((prev) => ({ ...prev, active: false }));
      },
      [editor, suggestionState.command, suggestionState.range]
    );

    return (
      <div className="relative w-full">
        <EditorContent editor={editor} />
        {suggestionState.active && suggestionState.items.length > 0 && (
          <div
            className="absolute z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            role="listbox"
          >
            {suggestionState.items.map((item, i) => (
              <div
                key={item.id}
                role="option"
                aria-selected={i === suggestionState.selectedIndex}
                className={`block w-full cursor-pointer px-3 py-1.5 text-left text-sm ${
                  i === suggestionState.selectedIndex
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(item);
                }}
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {suggestionState.char}
                </span>
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
