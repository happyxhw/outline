import type MarkdownIt from "markdown-it";

/**
 * Converts fenced `mindmap` blocks into dedicated parser tokens.
 *
 * @param md - the Markdown parser instance.
 */
export default function mindmapRule(md: MarkdownIt) {
  md.core.ruler.after("block", "mindmap", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "fence") {
        continue;
      }

      if (token.info.trim() !== "mindmap") {
        continue;
      }

      token.type = "mindmap";
      token.tag = "div";
      token.attrSet("data-mindmap", token.content.trim());
    }
  });
}
