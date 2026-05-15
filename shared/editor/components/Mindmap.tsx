import type { Markmap as MarkmapInstance } from "markmap-view";
import { CloseIcon, DoneIcon, ShapesIcon } from "outline-icons";
import * as React from "react";
import styled from "styled-components";
import type { ComponentProps } from "../types";

type Props = ComponentProps & {
  onChangeData: (data: string) => void;
  onChangeHeight: (height: number) => void;
};

const DEFAULT_MINDMAP_DATA = "# Mindmap\n\n- Topic\n  - Idea";
const DEFAULT_MINDMAP_HEIGHT = 240;
const MINDMAP_VERTICAL_PADDING = 80;
const MAX_EXPAND_LEVEL = Number.MAX_SAFE_INTEGER;
const MIN_MANUAL_HEIGHT = 160;
const MAX_MANUAL_HEIGHT = 1600;

/**
 * Renders an editable Markmap mindmap block.
 *
 * @param props - the ProseMirror component props.
 * @returns the Markmap mindmap block.
 */
export default function Mindmap(props: Props) {
  const { isEditable, isSelected, node, onChangeData, onChangeHeight } = props;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const markmapRef = React.useRef<MarkmapInstance | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const storedHeight =
    typeof node.attrs.height === "number" ? node.attrs.height : null;
  const [height, setHeight] = React.useState(
    storedHeight ?? DEFAULT_MINDMAP_HEIGHT
  );
  const data = typeof node.attrs.data === "string" ? node.attrs.data : "";
  const content = data || DEFAULT_MINDMAP_DATA;
  const [draft, setDraft] = React.useState(content);

  React.useEffect(() => {
    if (storedHeight !== null) {
      setHeight(storedHeight);
    }
  }, [storedHeight]);

  React.useEffect(() => {
    setDraft(content);
  }, [content]);

  React.useEffect(() => {
    let canceled = false;
    let frameId: number | undefined;

    function updateHeight() {
      if (storedHeight !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        const contentElement = svgRef.current?.querySelector("g");
        if (!contentElement) {
          return;
        }

        try {
          const box = contentElement.getBBox();
          setHeight(
            Math.max(
              DEFAULT_MINDMAP_HEIGHT,
              Math.ceil(box.height + MINDMAP_VERTICAL_PADDING)
            )
          );
        } catch {
          setHeight(DEFAULT_MINDMAP_HEIGHT);
        }
      });
    }

    async function renderMindmap() {
      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      markmapRef.current?.destroy();
      markmapRef.current = null;
      svg.replaceChildren();

      const [{ Transformer }, { Markmap, deriveOptions }] = await Promise.all([
        import("markmap-lib"),
        import("markmap-view"),
      ]);

      if (canceled || !svgRef.current) {
        return;
      }

      const transformer = new Transformer();
      const { frontmatter, root } = transformer.transform(content);
      markmapRef.current = Markmap.create(
        svgRef.current,
        {
          autoFit: true,
          embedGlobalCSS: true,
          initialExpandLevel: MAX_EXPAND_LEVEL,
          paddingX: 10,
          pan: false,
          zoom: false,
          ...deriveOptions(frontmatter?.markmap),
        },
        root
      );
      updateHeight();
    }

    void renderMindmap();

    return () => {
      canceled = true;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      markmapRef.current?.destroy();
      markmapRef.current = null;
    };
  }, [content, storedHeight]);

  const handleOpen = React.useCallback(() => {
    if (isEditable) {
      setIsOpen(true);
    }
  }, [isEditable]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      handleOpen();
    },
    [handleOpen]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleOpen();
    },
    [handleOpen]
  );

  const handleResizePointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isEditable) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startY = event.clientY;
      const startHeight = height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextHeight = Math.min(
          MAX_MANUAL_HEIGHT,
          Math.max(MIN_MANUAL_HEIGHT, startHeight + moveEvent.clientY - startY)
        );
        setHeight(nextHeight);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);

        const nextHeight = Math.min(
          MAX_MANUAL_HEIGHT,
          Math.max(MIN_MANUAL_HEIGHT, startHeight + upEvent.clientY - startY)
        );
        setHeight(nextHeight);
        onChangeHeight(nextHeight);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [height, isEditable, onChangeHeight]
  );

  const handleClose = React.useCallback(() => {
    setDraft(content);
    setIsOpen(false);
  }, [content]);

  const handleSave = React.useCallback(() => {
    onChangeData(draft.trim() || DEFAULT_MINDMAP_DATA);
    setIsOpen(false);
  }, [draft, onChangeData]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(event.target.value);
    },
    []
  );

  const handleEditorKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Tab") {
        return;
      }

      event.preventDefault();

      const editor = event.currentTarget;
      const { selectionStart, selectionEnd, value } = editor;
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const lineEndIndex = value.indexOf("\n", selectionEnd);
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
      const selectedLines = value.slice(lineStart, lineEnd);

      if (event.shiftKey) {
        const updatedLines = selectedLines.replace(/^ {2}/gm, "");
        setDraft(
          `${value.slice(0, lineStart)}${updatedLines}${value.slice(lineEnd)}`
        );
        window.requestAnimationFrame(() => {
          editor.setSelectionRange(
            Math.max(lineStart, selectionStart - 2),
            Math.max(
              lineStart,
              selectionEnd - (selectedLines.length - updatedLines.length)
            )
          );
        });
        return;
      }

      const updatedLines = selectedLines.replace(/^/gm, "  ");
      setDraft(
        `${value.slice(0, lineStart)}${updatedLines}${value.slice(lineEnd)}`
      );
      window.requestAnimationFrame(() => {
        editor.setSelectionRange(selectionStart + 2, selectionEnd + 2);
      });
    },
    []
  );

  const insertMarkdown = React.useCallback((template: string) => {
    const editor = editorRef.current;
    if (!editor) {
      setDraft((currentDraft) => `${currentDraft}\n${template}`);
      return;
    }

    const { selectionStart, selectionEnd, value } = editor;
    const prefix = value.slice(0, selectionStart);
    const suffix = value.slice(selectionEnd);
    const needsLeadingNewLine = prefix.length > 0 && !prefix.endsWith("\n");
    const inserted = `${needsLeadingNewLine ? "\n" : ""}${template}`;

    setDraft(`${prefix}${inserted}${suffix}`);

    window.requestAnimationFrame(() => {
      const cursor = selectionStart + inserted.length;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
    });
  }, []);

  const handleInsertRoot = React.useCallback(() => {
    insertMarkdown("# New mindmap");
  }, [insertMarkdown]);

  const handleInsertTopic = React.useCallback(() => {
    insertMarkdown("- Topic");
  }, [insertMarkdown]);

  const handleInsertChild = React.useCallback(() => {
    insertMarkdown("  - Child topic");
  }, [insertMarkdown]);

  const lineNumbers = React.useMemo(
    () =>
      Array.from({ length: draft.split("\n").length }, (_, index) => index + 1),
    [draft]
  );

  return (
    <>
      <Wrapper
        $selected={isSelected}
        $editable={isEditable}
        $height={height}
        contentEditable={false}
        onDoubleClickCapture={handleDoubleClick}
        onKeyDown={handleKeyDown}
        role={isEditable ? "button" : undefined}
        tabIndex={isEditable ? 0 : undefined}
      >
        <svg ref={svgRef} />
        {isEditable && (
          <ResizeHandle
            aria-label="Resize mindmap preview"
            onPointerDown={handleResizePointerDown}
            role="separator"
          />
        )}
      </Wrapper>
      {isOpen && (
        <Overlay role="presentation">
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-label="Mindmap"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Toolbar>
              <Title>
                <ShapesIcon />
                Mindmap
              </Title>
              <Actions>
                <IconButton type="button" onClick={handleClose}>
                  <CloseIcon />
                </IconButton>
                <PrimaryButton type="button" onClick={handleSave}>
                  <DoneIcon />
                  Save
                </PrimaryButton>
              </Actions>
            </Toolbar>
            <MarkdownEditor>
              <EditorTools>
                <ToolButton type="button" onClick={handleInsertRoot}>
                  Heading
                </ToolButton>
                <ToolButton type="button" onClick={handleInsertTopic}>
                  Topic
                </ToolButton>
                <ToolButton type="button" onClick={handleInsertChild}>
                  Child
                </ToolButton>
                <EditorHint>
                  Use Markdown lists. Press Tab / Shift+Tab to indent.
                </EditorHint>
              </EditorTools>
              <EditorFrame>
                <LineNumbers aria-hidden="true">
                  {lineNumbers.map((lineNumber) => (
                    <span key={lineNumber}>{lineNumber}</span>
                  ))}
                </LineNumbers>
                <Editor
                  ref={editorRef}
                  autoFocus
                  value={draft}
                  onChange={handleChange}
                  onKeyDown={handleEditorKeyDown}
                  spellCheck={false}
                  placeholder={"# Mindmap\n\n- Topic\n  - Child topic"}
                />
              </EditorFrame>
            </MarkdownEditor>
          </Dialog>
        </Overlay>
      )}
    </>
  );
}

const Wrapper = styled.div<{
  $selected: boolean;
  $editable: boolean;
  $height: number;
}>`
  border: 1px solid
    ${(props) => (props.$selected ? props.theme.accent : props.theme.divider)};
  border-radius: 8px;
  cursor: ${(props) => (props.$editable ? "pointer" : "default")};
  overflow: hidden;
  position: relative;
  background: ${(props) => props.theme.background};
  height: ${(props) => props.$height}px;
  max-width: 100%;

  svg {
    width: 100%;
    height: 100%;
  }

  svg.markmap.markmap {
    --markmap-text-color: ${(props) => props.theme.text};
    --markmap-code-bg: ${(props) => props.theme.codeBackground};
    --markmap-code-color: ${(props) => props.theme.text};
    --markmap-circle-open-bg: ${(props) => props.theme.background};
    --markmap-highlight-bg: ${(props) => props.theme.textHighlight};
    color: ${(props) => props.theme.text};
  }

  svg.markmap .markmap-foreign,
  svg.markmap .markmap-foreign * {
    color: ${(props) => props.theme.text};
  }

  svg.markmap .markmap-foreign a {
    color: ${(props) => props.theme.link};
  }

  svg.markmap .markmap-foreign code {
    color: ${(props) => props.theme.text};
    background: ${(props) => props.theme.codeBackground};
  }
`;

const ResizeHandle = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 12px;
  cursor: ns-resize;
  background: transparent;

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 36px;
    height: 4px;
    border-radius: 999px;
    transform: translateX(-50%);
    background: ${(props) => props.theme.divider};
  }

  &:hover::after {
    background: ${(props) => props.theme.textTertiary};
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  height: min(720px, 100%);
  border-radius: 12px;
  overflow: hidden;
  background: ${(props) => props.theme.background};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid ${(props) => props.theme.divider};
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  color: ${(props) => props.theme.text};
  background: transparent;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.theme.backgroundSecondary};
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: ${(props) => props.theme.buttonNeutralText};
  background: ${(props) => props.theme.accent};
  cursor: pointer;
  font-weight: 600;
`;

const MarkdownEditor = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: ${(props) => props.theme.background};
`;

const EditorTools = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid ${(props) => props.theme.divider};
  background: ${(props) => props.theme.backgroundSecondary};
`;

const ToolButton = styled.button`
  border: 1px solid ${(props) => props.theme.divider};
  border-radius: 6px;
  padding: 4px 10px;
  color: ${(props) => props.theme.text};
  background: ${(props) => props.theme.background};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;

  &:hover {
    background: ${(props) => props.theme.backgroundTertiary};
  }
`;

const EditorHint = styled.span`
  margin-left: auto;
  color: ${(props) => props.theme.textSecondary};
  font-size: 12px;
`;

const EditorFrame = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const LineNumbers = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 48px;
  padding: 16px 10px;
  color: ${(props) => props.theme.textTertiary};
  background: ${(props) => props.theme.backgroundSecondary};
  border-right: 1px solid ${(props) => props.theme.divider};
  font-family: ${(props) => props.theme.fontFamilyMono};
  font-size: 14px;
  line-height: 1.6;
  text-align: right;
  user-select: none;
`;

const Editor = styled.textarea`
  flex: 1;
  width: 100%;
  resize: none;
  border: 0;
  outline: 0;
  padding: 16px;
  tab-size: 2;
  color: ${(props) => props.theme.text};
  background: ${(props) => props.theme.background};
  font-family: ${(props) => props.theme.fontFamilyMono};
  font-size: 14px;
  line-height: 1.6;
`;
