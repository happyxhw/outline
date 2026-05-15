import type * as ExcalidrawModule from "@excalidraw/excalidraw";
import { CloseIcon, DoneIcon, ShapesIcon } from "outline-icons";
import * as React from "react";
import styled, { useTheme } from "styled-components";
import type { ComponentProps } from "../types";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
    __OUTLINE_EXCALIDRAW_FONT_FACE_PATCHED?: boolean;
  }
}

type SerializeArgs = Parameters<typeof ExcalidrawModule.serializeAsJSON>;
type ExcalidrawProps = React.ComponentProps<typeof ExcalidrawModule.Excalidraw>;
type ExcalidrawAPI = Parameters<
  NonNullable<ExcalidrawProps["excalidrawAPI"]>
>[0];
type ExcalidrawOnChange = NonNullable<ExcalidrawProps["onChange"]>;
type ExcalidrawTheme = NonNullable<ExcalidrawProps["theme"]>;

interface ExcalidrawData {
  elements?: SerializeArgs[0] | null;
  appState?: SerializeArgs[1] | null;
  files?: SerializeArgs[2];
  scrollToContent?: boolean;
}

type Props = ComponentProps & {
  onChangeData: (data: string) => void;
  onChangeHeight: (height: number) => void;
};

const EXCALIDRAW_ASSET_PATH = "/fonts/excalidraw/";
const EXCALIDRAW_CDN_ASSET_PATH =
  /https:\/\/esm\.sh\/@excalidraw\/excalidraw(?:@[^/]+)?\/dist\/prod\//g;
const EXCALIDRAW_LIGHT_STROKE = "#1e1e1e";
const EXCALIDRAW_DARK_STROKE = "#ffffff";
const EXCALIDRAW_DARK_MODE_SOURCE_BACKGROUND = "#ffffff";
const DEFAULT_EXCALIDRAW_HEIGHT = 420;
const MIN_EXCALIDRAW_HEIGHT = 220;
const MAX_EXCALIDRAW_HEIGHT = 1600;

const ExcalidrawEditor = React.lazy(async () => {
  ensureExcalidrawAssetPath();
  await import("@excalidraw/excalidraw/index.css");
  const module = await import("@excalidraw/excalidraw");

  return {
    default: module.Excalidraw,
  };
});

function ensureExcalidrawAssetPath() {
  if (typeof window === "undefined") {
    return;
  }

  window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;

  if (window.__OUTLINE_EXCALIDRAW_FONT_FACE_PATCHED || !window.FontFace) {
    return;
  }

  const NativeFontFace = window.FontFace;
  const PatchedFontFace: typeof FontFace = class extends NativeFontFace {
    constructor(
      family: string,
      source: string | BufferSource,
      descriptors?: FontFaceDescriptors
    ) {
      super(
        family,
        typeof source === "string"
          ? source.replace(EXCALIDRAW_CDN_ASSET_PATH, EXCALIDRAW_ASSET_PATH)
          : source,
        descriptors
      );
    }
  };

  window.FontFace = PatchedFontFace;
  window.__OUTLINE_EXCALIDRAW_FONT_FACE_PATCHED = true;
}

/**
 * Parses serialized Excalidraw scene data from a ProseMirror node attribute.
 *
 * @param data - the serialized Excalidraw scene data.
 * @returns the parsed scene data.
 */
export function parseExcalidrawData(data: string): ExcalidrawData {
  if (!data) {
    return {};
  }

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Renders an editable Excalidraw document block.
 *
 * @param props - the ProseMirror component props.
 * @returns the Excalidraw document block.
 */
export default function Excalidraw(props: Props) {
  const { isEditable, isSelected, node, onChangeData, onChangeHeight } = props;
  const theme = useTheme();
  const previewRef = React.useRef<HTMLDivElement>(null);
  const isDirtyRef = React.useRef(false);
  const isInitialLoadRef = React.useRef(true);
  const lastFingerprintRef = React.useRef("");
  const [excalidrawAPI, setExcalidrawAPI] =
    React.useState<ExcalidrawAPI | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isEmpty, setIsEmpty] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const storedHeight =
    typeof node.attrs.height === "number" ? node.attrs.height : null;
  const [height, setHeight] = React.useState(
    storedHeight ?? DEFAULT_EXCALIDRAW_HEIGHT
  );
  const data = typeof node.attrs.data === "string" ? node.attrs.data : "";
  const scene = React.useMemo(() => parseExcalidrawData(data), [data]);
  const excalidrawTheme: ExcalidrawTheme = theme.isDark ? "dark" : "light";
  const canvasBackground = theme.background;
  const excalidrawViewBackgroundColor = theme.isDark
    ? EXCALIDRAW_DARK_MODE_SOURCE_BACKGROUND
    : theme.background;
  const defaultStrokeColor = theme.isDark
    ? EXCALIDRAW_DARK_STROKE
    : EXCALIDRAW_LIGHT_STROKE;

  React.useEffect(() => {
    if (storedHeight !== null) {
      setHeight(storedHeight);
    }
  }, [storedHeight]);

  React.useEffect(() => {
    let canceled = false;

    async function renderPreview() {
      ensureExcalidrawAssetPath();

      const excalidraw = await import("@excalidraw/excalidraw");
      const elements = excalidraw.getNonDeletedElements(scene.elements ?? []);
      setIsEmpty(elements.length === 0);

      if (!previewRef.current) {
        return;
      }

      previewRef.current.replaceChildren();

      if (elements.length === 0) {
        return;
      }

      const svg = await excalidraw.exportToSvg({
        elements,
        appState: {
          ...scene.appState,
          exportBackground: true,
          exportEmbedScene: true,
          exportWithDarkMode: theme.isDark,
          theme: excalidrawTheme,
          viewBackgroundColor: excalidrawViewBackgroundColor,
        },
        files: scene.files ?? null,
        exportPadding: 24,
      });

      if (canceled || !previewRef.current) {
        return;
      }

      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      previewRef.current.replaceChildren(svg);
    }

    void renderPreview();

    return () => {
      canceled = true;
    };
  }, [excalidrawTheme, excalidrawViewBackgroundColor, scene, theme.isDark]);

  const initialData = React.useMemo(
    () => ({
      ...scene,
      appState: {
        ...scene.appState,
        currentItemStrokeColor: defaultStrokeColor,
        exportWithDarkMode: theme.isDark,
        theme: excalidrawTheme,
        viewBackgroundColor: excalidrawViewBackgroundColor,
      },
      files: scene.files,
      scrollToContent: true,
    }),
    [
      defaultStrokeColor,
      excalidrawTheme,
      excalidrawViewBackgroundColor,
      scene,
      theme.isDark,
    ]
  );

  React.useEffect(() => {
    if (!excalidrawAPI || !isOpen) {
      return;
    }

    excalidrawAPI.updateScene({
      appState: {
        currentItemStrokeColor: defaultStrokeColor,
        exportWithDarkMode: theme.isDark,
        theme: excalidrawTheme,
        viewBackgroundColor: excalidrawViewBackgroundColor,
      },
      captureUpdate: "NEVER",
    });
  }, [
    defaultStrokeColor,
    excalidrawAPI,
    excalidrawTheme,
    excalidrawViewBackgroundColor,
    isOpen,
    theme.isDark,
  ]);

  const handleOpen = React.useCallback(() => {
    if (!isEditable) {
      return;
    }

    isDirtyRef.current = false;
    isInitialLoadRef.current = true;
    setIsOpen(true);
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
          MAX_EXCALIDRAW_HEIGHT,
          Math.max(
            MIN_EXCALIDRAW_HEIGHT,
            startHeight + moveEvent.clientY - startY
          )
        );
        setHeight(nextHeight);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);

        const nextHeight = Math.min(
          MAX_EXCALIDRAW_HEIGHT,
          Math.max(
            MIN_EXCALIDRAW_HEIGHT,
            startHeight + upEvent.clientY - startY
          )
        );
        setHeight(nextHeight);
        onChangeHeight(nextHeight);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [height, isEditable, onChangeHeight]
  );

  const handleChange = React.useCallback(
    (
      elements: Parameters<ExcalidrawOnChange>[0],
      _appState: Parameters<ExcalidrawOnChange>[1],
      files: Parameters<ExcalidrawOnChange>[2]
    ) => {
      const version = elements.reduce(
        (sum, element) => sum + (element.version || 0),
        0
      );
      const fingerprint = `${elements.length}:${version}:${
        Object.keys(files).length
      }`;

      if (isInitialLoadRef.current) {
        lastFingerprintRef.current = fingerprint;
        isInitialLoadRef.current = false;
        return;
      }

      if (fingerprint !== lastFingerprintRef.current) {
        lastFingerprintRef.current = fingerprint;
        isDirtyRef.current = true;
      }
    },
    []
  );

  const saveData = React.useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    setIsSaving(true);

    try {
      const excalidraw = await import("@excalidraw/excalidraw");
      const appState = excalidrawAPI.getAppState();
      const serialized = excalidraw.serializeAsJSON(
        excalidrawAPI.getSceneElementsIncludingDeleted(),
        {
          ...appState,
          currentItemStrokeColor: defaultStrokeColor,
          exportWithDarkMode: theme.isDark,
          theme: excalidrawTheme,
          viewBackgroundColor: excalidrawViewBackgroundColor,
        },
        excalidrawAPI.getFiles(),
        "local"
      );

      isDirtyRef.current = false;
      return serialized;
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultStrokeColor,
    excalidrawAPI,
    excalidrawTheme,
    excalidrawViewBackgroundColor,
    theme.isDark,
  ]);

  const handleSaveAndExit = React.useCallback(async () => {
    const serialized = await saveData();
    setIsOpen(false);

    if (!serialized) {
      return;
    }

    window.requestAnimationFrame(() => onChangeData(serialized));
  }, [onChangeData, saveData]);

  const handleClose = React.useCallback(() => {
    if (!isDirtyRef.current) {
      setIsOpen(false);
      return;
    }

    const discard = window.confirm(
      "You have unsaved changes that will be lost."
    );

    if (discard) {
      isDirtyRef.current = false;
      setIsOpen(false);
    }
  }, []);

  return (
    <>
      <Wrapper
        $selected={isSelected}
        $editable={isEditable}
        $height={height}
        contentEditable={false}
        onDoubleClick={handleOpen}
        onKeyDown={handleKeyDown}
        role={isEditable ? "button" : undefined}
        tabIndex={isEditable ? 0 : undefined}
      >
        <Preview $empty={isEmpty}>
          <PreviewContent ref={previewRef} />
          {isEmpty && (
            <EmptyState>
              <ShapesIcon />
              <span>Double-click to edit Excalidraw diagram</span>
            </EmptyState>
          )}
        </Preview>
        {isEditable && (
          <ResizeHandle
            aria-label="Resize Excalidraw preview"
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
            aria-label="Excalidraw"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Toolbar>
              <Title>
                <ShapesIcon />
                Excalidraw
              </Title>
              <Actions>
                <IconButton type="button" onClick={handleClose}>
                  <CloseIcon />
                </IconButton>
                <PrimaryButton
                  type="button"
                  onClick={handleSaveAndExit}
                  disabled={isSaving}
                >
                  <DoneIcon />
                  {isSaving ? "Saving…" : "Save & Exit"}
                </PrimaryButton>
              </Actions>
            </Toolbar>
            <Canvas $canvasBackground={canvasBackground}>
              <React.Suspense fallback={null}>
                <ExcalidrawEditor
                  excalidrawAPI={setExcalidrawAPI}
                  initialData={initialData}
                  onChange={handleChange}
                  theme={excalidrawTheme}
                />
              </React.Suspense>
            </Canvas>
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
`;

const Preview = styled.div<{ $empty: boolean }>`
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: ${(props) =>
    props.$empty ? props.theme.backgroundSecondary : props.theme.background};

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

const PreviewContent = styled.div`
  position: absolute;
  inset: 0;
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

const EmptyState = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${(props) => props.theme.textSecondary};
  font-weight: 500;

  svg {
    width: 24px;
    height: 24px;
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
`;

const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: ${(props) => props.theme.background};
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
  border-radius: 4px;
  color: ${(props) => props.theme.textSecondary};
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
  border-radius: 4px;
  color: ${(props) => props.theme.buttonNeutralText};
  background: ${(props) => props.theme.accent};
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.7;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const Canvas = styled.div<{ $canvasBackground: string }>`
  flex: 1;
  min-height: 0;
  background: ${(props) => props.$canvasBackground};

  .excalidraw {
    --color-primary: ${(props) => props.theme.accent};
    --color-primary-darker: ${(props) => props.theme.selected};
    --color-primary-darkest: ${(props) => props.theme.selected};
    --color-primary-light: ${(props) => props.theme.link};
    --default-bg-color: ${(props) => props.$canvasBackground};
    --color-surface-lowest: ${(props) => props.$canvasBackground};
    background: ${(props) => props.$canvasBackground};
  }

  .excalidraw.theme--dark {
    --default-bg-color: ${(props) => props.$canvasBackground};
    --color-surface-lowest: ${(props) => props.$canvasBackground};
    --color-surface-low: #111111;
    --color-surface-mid: #171717;
    --color-surface-high: #222222;
    --island-bg-color: #1f1f1f;
    --popup-bg-color: #1f1f1f;
    background: ${(props) => props.$canvasBackground};
  }

  .excalidraw .App {
    background: var(--default-bg-color);
  }

  .excalidraw .excalidraw__canvas-wrapper {
    background: var(--default-bg-color);
  }
`;
