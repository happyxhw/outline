import type MarkdownIt from "markdown-it";

/**
 * Converts fenced `excalidraw` blocks into dedicated parser tokens.
 *
 * @param md - the Markdown parser instance.
 */
export default function excalidrawRule(md: MarkdownIt) {
  md.core.ruler.after("block", "excalidraw", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "fence") {
        continue;
      }

      if (token.info.trim() !== "excalidraw") {
        continue;
      }

      token.type = "excalidraw";
      token.tag = "div";
      token.attrSet("data-excalidraw", token.content.trim());
    }
  });
}
