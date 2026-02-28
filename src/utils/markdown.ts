import MarkdownIt from "markdown-it";

// Lark document block type constants
const BLOCK_TYPE = {
  TEXT: 2,
  HEADING1: 3,
  HEADING2: 4,
  HEADING3: 5,
  HEADING4: 6,
  HEADING5: 7,
  HEADING6: 8,
  BULLET: 12,
  ORDERED: 13,
  CODE: 14,
  QUOTE: 15,
  TODO: 17,
  DIVIDER: 18,
} as const;

const HEADING_TAG_MAP: Record<string, number> = {
  h1: BLOCK_TYPE.HEADING1,
  h2: BLOCK_TYPE.HEADING2,
  h3: BLOCK_TYPE.HEADING3,
  h4: BLOCK_TYPE.HEADING4,
  h5: BLOCK_TYPE.HEADING5,
  h6: BLOCK_TYPE.HEADING6,
};

const BLOCK_FIELD_MAP: Record<number, string> = {
  [BLOCK_TYPE.TEXT]: "text",
  [BLOCK_TYPE.HEADING1]: "heading1",
  [BLOCK_TYPE.HEADING2]: "heading2",
  [BLOCK_TYPE.HEADING3]: "heading3",
  [BLOCK_TYPE.HEADING4]: "heading4",
  [BLOCK_TYPE.HEADING5]: "heading5",
  [BLOCK_TYPE.HEADING6]: "heading6",
  [BLOCK_TYPE.BULLET]: "bullet",
  [BLOCK_TYPE.ORDERED]: "ordered",
  [BLOCK_TYPE.CODE]: "code",
  [BLOCK_TYPE.QUOTE]: "quote",
  [BLOCK_TYPE.TODO]: "todo",
};

/** Markdown language identifier to Lark numeric code. */
const LANGUAGE_MAP: Record<string, number> = {
  "": 1,
  plaintext: 1,
  text: 1,
  bash: 7,
  sh: 7,
  shell: 60,
  c: 10,
  "c++": 9,
  cpp: 9,
  csharp: 8,
  cs: 8,
  css: 12,
  dart: 15,
  dockerfile: 18,
  go: 22,
  golang: 22,
  html: 24,
  java: 29,
  javascript: 30,
  js: 30,
  json: 28,
  kotlin: 32,
  kt: 32,
  lua: 36,
  makefile: 38,
  markdown: 39,
  md: 39,
  "objective-c": 41,
  objc: 41,
  php: 43,
  python: 49,
  py: 49,
  r: 50,
  ruby: 52,
  rb: 52,
  rust: 53,
  rs: 53,
  scala: 57,
  sql: 56,
  swift: 61,
  typescript: 63,
  ts: 63,
  xml: 66,
  yaml: 67,
  yml: 67,
  toml: 75,
  graphql: 71,
  protobuf: 48,
  proto: 48,
  diff: 69,
};

interface TextElementStyle {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  inline_code?: boolean;
  link?: { url: string };
}

interface TextElement {
  text_run?: {
    content: string;
    text_element_style?: TextElementStyle;
  };
}

interface LarkBlock {
  block_type: number;
  [key: string]: unknown;
}

/**
 * Build a text_run element with optional styling.
 *
 * @param content - Plain text content.
 * @param style - Inline style flags.
 * @param linkUrl - Optional link URL.
 * @returns A Lark text element.
 */
function makeTextRun(content: string, style: TextElementStyle, linkUrl: string | null): TextElement {
  const s: TextElementStyle = {};
  let hasStyle = false;

  if (style.bold) {
    s.bold = true;
    hasStyle = true;
  }
  if (style.italic) {
    s.italic = true;
    hasStyle = true;
  }
  if (style.strikethrough) {
    s.strikethrough = true;
    hasStyle = true;
  }
  if (style.inline_code) {
    s.inline_code = true;
    hasStyle = true;
  }
  if (linkUrl) {
    s.link = { url: linkUrl };
    hasStyle = true;
  }

  return {
    text_run: {
      content,
      ...(hasStyle ? { text_element_style: s } : {}),
    },
  };
}

/**
 * Parse markdown-it inline token children into Lark text elements.
 *
 * @param children - Array of inline tokens from markdown-it.
 * @returns Array of Lark text elements with formatting applied.
 */
function parseInlineTokens(children: any[] | null): TextElement[] {
  if (!children || children.length === 0) {
    return [{ text_run: { content: "" } }];
  }

  const elements: TextElement[] = [];
  const styleStack: TextElementStyle = {};
  let linkUrl: string | null = null;

  for (const child of children) {
    switch (child.type) {
      case "text":
        elements.push(makeTextRun(child.content, { ...styleStack }, linkUrl));
        break;
      case "code_inline":
        elements.push(makeTextRun(child.content, { ...styleStack, inline_code: true }, linkUrl));
        break;
      case "strong_open":
        styleStack.bold = true;
        break;
      case "strong_close":
        delete styleStack.bold;
        break;
      case "em_open":
        styleStack.italic = true;
        break;
      case "em_close":
        delete styleStack.italic;
        break;
      case "s_open":
        styleStack.strikethrough = true;
        break;
      case "s_close":
        delete styleStack.strikethrough;
        break;
      case "link_open": {
        const href = child.attrGet?.("href") ?? child.attrs?.find((a: string[]) => a[0] === "href")?.[1];
        if (href) linkUrl = href;
        break;
      }
      case "link_close":
        linkUrl = null;
        break;
      case "softbreak":
      case "hardbreak":
        elements.push({ text_run: { content: "\n" } });
        break;
      case "image": {
        // Images require upload; fall back to text link
        const src = child.attrGet?.("src") ?? child.attrs?.find((a: string[]) => a[0] === "src")?.[1];
        const alt = child.content || "image";
        if (src) {
          elements.push(makeTextRun(alt, { ...styleStack }, src));
        }
        break;
      }
    }
  }

  return elements.length > 0 ? elements : [{ text_run: { content: "" } }];
}

/**
 * Build a Lark block with the appropriate typed field.
 *
 * @param blockType - Numeric Lark block type.
 * @param elements - Text elements for the block.
 * @param style - Optional block-level style (e.g. language for code, done for todo).
 * @returns A Lark block object.
 */
function makeTextBlock(blockType: number, elements: TextElement[], style?: Record<string, unknown>): LarkBlock {
  const fieldName = BLOCK_FIELD_MAP[blockType];
  if (!fieldName) throw new Error(`Unknown block type: ${blockType}`);

  return {
    block_type: blockType,
    [fieldName]: {
      elements,
      ...(style ? { style } : {}),
    },
  };
}

/**
 * Convert a markdown string to an array of Lark document blocks.
 *
 * Parses markdown with markdown-it and maps tokens to Lark block structures
 * suitable for the docx.documentBlockChildren.create() API.
 *
 * @param markdown - Raw markdown string.
 * @returns Array of Lark block objects.
 */
export function markdownToLarkBlocks(markdown: string): LarkBlock[] {
  const md = new MarkdownIt();
  const tokens = md.parse(markdown, {});
  const blocks: LarkBlock[] = [];

  let i = 0;
  let listType: "bullet" | "ordered" | null = null;
  let inBlockquote = false;

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token.type) {
      case "heading_open": {
        const blockType = HEADING_TAG_MAP[token.tag] ?? BLOCK_TYPE.HEADING1;
        const inlineToken = tokens[i + 1];
        const elements = parseInlineTokens(inlineToken?.children ?? null);
        blocks.push(makeTextBlock(blockType, elements));
        i += 3; // heading_open, inline, heading_close
        break;
      }

      case "paragraph_open": {
        const inlineToken = tokens[i + 1];
        const elements = parseInlineTokens(inlineToken?.children ?? null);

        if (listType) {
          // Detect todo checkbox pattern: [ ] or [x]
          const firstContent = elements[0]?.text_run?.content ?? "";
          const todoMatch = firstContent.match(/^\[([ xX])\]\s*/);

          if (todoMatch) {
            const done = todoMatch[1].toLowerCase() === "x";
            elements[0] = {
              text_run: {
                ...elements[0].text_run!,
                content: firstContent.slice(todoMatch[0].length),
              },
            };
            blocks.push(makeTextBlock(BLOCK_TYPE.TODO, elements, { done }));
          } else {
            const blockType = listType === "bullet" ? BLOCK_TYPE.BULLET : BLOCK_TYPE.ORDERED;
            blocks.push(makeTextBlock(blockType, elements));
          }
        } else if (inBlockquote) {
          blocks.push(makeTextBlock(BLOCK_TYPE.QUOTE, elements));
        } else {
          blocks.push(makeTextBlock(BLOCK_TYPE.TEXT, elements));
        }

        i += 3; // paragraph_open, inline, paragraph_close
        break;
      }

      case "bullet_list_open":
        listType = "bullet";
        i++;
        break;
      case "bullet_list_close":
        listType = null;
        i++;
        break;
      case "ordered_list_open":
        listType = "ordered";
        i++;
        break;
      case "ordered_list_close":
        listType = null;
        i++;
        break;

      case "list_item_open":
      case "list_item_close":
        i++;
        break;

      case "fence": {
        const lang = token.info.trim().toLowerCase();
        const langCode = LANGUAGE_MAP[lang] ?? 1;
        const content = token.content.replace(/\n$/, "");
        const elements: TextElement[] = [{ text_run: { content } }];
        blocks.push(makeTextBlock(BLOCK_TYPE.CODE, elements, { language: langCode, wrap: false }));
        i++;
        break;
      }

      case "code_block": {
        const content = token.content.replace(/\n$/, "");
        const elements: TextElement[] = [{ text_run: { content } }];
        blocks.push(makeTextBlock(BLOCK_TYPE.CODE, elements, { language: 1, wrap: false }));
        i++;
        break;
      }

      case "hr":
        blocks.push({ block_type: BLOCK_TYPE.DIVIDER, divider: {} });
        i++;
        break;

      case "blockquote_open":
        inBlockquote = true;
        i++;
        break;
      case "blockquote_close":
        inBlockquote = false;
        i++;
        break;

      default:
        i++;
        break;
    }
  }

  return blocks;
}
