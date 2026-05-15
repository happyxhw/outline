import type { PluginSimple } from "markdown-it";
import type { Token } from "markdown-it";
import type {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import type { Primitive } from "utility-types";
import MindmapComponent from "../components/Mindmap";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import mindmapRule from "../rules/mindmap";
import type { ComponentProps } from "../types";
import Node from "./Node";

const EMPTY_MINDMAP_DATA = "# Mindmap\n\n- Topic\n  - Idea";

/**
 * ProseMirror node for storing and editing Markmap mindmaps.
 */
export default class Mindmap extends Node {
  get name() {
    return "mindmap";
  }

  get schema(): NodeSpec {
    return {
      group: "block",
      atom: true,
      attrs: {
        data: {
          default: EMPTY_MINDMAP_DATA,
          validate: "string",
        },
        height: {
          default: null,
        },
      },
      parseDOM: [
        {
          tag: "div[data-mindmap]",
          getAttrs: (dom: HTMLElement) => ({
            data: dom.getAttribute("data-mindmap") ?? EMPTY_MINDMAP_DATA,
            height: Number(dom.getAttribute("data-mindmap-height")) || null,
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          "data-mindmap": node.attrs.data,
          "data-mindmap-height": node.attrs.height,
        },
        "Mindmap",
      ],
      leafText: () => "Mindmap",
    };
  }

  get rulePlugins(): PluginSimple[] {
    return [mindmapRule];
  }

  component = (props: ComponentProps) => (
    <MindmapComponent
      {...props}
      onChangeData={(data) => this.handleChangeData(props, data)}
      onChangeHeight={(height) => this.handleChangeHeight(props, height)}
    />
  );

  commands({ type }: { type: NodeType }) {
    return {
      mindmap:
        (attrs?: Record<string, Primitive>): Command =>
        (state, dispatch) => {
          dispatch?.(
            state.tr
              .replaceSelectionWith(
                type.create({
                  data: attrs?.data ?? EMPTY_MINDMAP_DATA,
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
    state.write("```mindmap\n");
    state.write(node.attrs.data || EMPTY_MINDMAP_DATA);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "mindmap",
      getAttrs: (token: Token) => ({
        data: token.attrGet("data-mindmap") ?? EMPTY_MINDMAP_DATA,
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
