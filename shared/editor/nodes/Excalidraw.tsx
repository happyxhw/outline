import type { PluginSimple } from "markdown-it";
import type { Token } from "markdown-it";
import type {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import type { Primitive } from "utility-types";
import ExcalidrawComponent from "../components/Excalidraw";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import excalidrawRule from "../rules/excalidraw";
import type { ComponentProps } from "../types";
import Node from "./Node";

const EMPTY_EXCALIDRAW_DATA = "{}";

/**
 * ProseMirror node for storing and editing Excalidraw scenes.
 */
export default class Excalidraw extends Node {
  get name() {
    return "excalidraw";
  }

  get schema(): NodeSpec {
    return {
      group: "block",
      atom: true,
      attrs: {
        data: {
          default: EMPTY_EXCALIDRAW_DATA,
          validate: "string",
        },
        height: {
          default: null,
        },
      },
      parseDOM: [
        {
          tag: "div[data-excalidraw]",
          getAttrs: (dom: HTMLElement) => ({
            data: dom.getAttribute("data-excalidraw") ?? EMPTY_EXCALIDRAW_DATA,
            height: Number(dom.getAttribute("data-excalidraw-height")) || null,
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          "data-excalidraw": node.attrs.data,
          "data-excalidraw-height": node.attrs.height,
        },
        "Excalidraw",
      ],
      leafText: () => "Excalidraw",
    };
  }

  get rulePlugins(): PluginSimple[] {
    return [excalidrawRule];
  }

  component = (props: ComponentProps) => (
    <ExcalidrawComponent
      {...props}
      onChangeData={(data) => this.handleChangeData(props, data)}
      onChangeHeight={(height) => this.handleChangeHeight(props, height)}
    />
  );

  commands({ type }: { type: NodeType }) {
    return {
      excalidraw:
        (attrs?: Record<string, Primitive>): Command =>
        (state, dispatch) => {
          dispatch?.(
            state.tr
              .replaceSelectionWith(
                type.create({
                  data: attrs?.data ?? EMPTY_EXCALIDRAW_DATA,
                  height: attrs?.height ?? null,
                })
              )
              .scrollIntoView()
          );
          return true;
        },
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.ensureNewLine();
    state.write("```excalidraw\n");
    state.write(node.attrs.data || EMPTY_EXCALIDRAW_DATA);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "excalidraw",
      getAttrs: (token: Token) => ({
        data: token.attrGet("data-excalidraw") ?? EMPTY_EXCALIDRAW_DATA,
      }),
    };
  }

  private handleChangeData(props: ComponentProps, data: string) {
    const { view, node, getPos } = props;
    const pos = getPos();

    view.dispatch(
      view.state.tr
        .setNodeMarkup(pos, undefined, {
          ...node.attrs,
          data,
        })
        .scrollIntoView()
    );
  }

  private handleChangeHeight(props: ComponentProps, height: number) {
    const { view, node, getPos } = props;
    const pos = getPos();

    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        height,
      })
    );
  }
}
