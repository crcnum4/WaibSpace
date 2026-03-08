/**
 * HTML extraction utilities for converting raw HTML into readable text content.
 * No external dependencies — uses regex-based parsing for lightweight extraction.
 */

const MAX_CONTENT_LENGTH = 10_000;

export interface ExtractedContent {
  title: string;
  content: string;
  links: string[];
}

/**
 * Extract readable content from raw HTML.
 *
 * 1. Extract <title> content
 * 2. Remove <script>, <style>, <nav>, <footer>, <header> tags and their content
 * 3. Strip remaining HTML tags
 * 4. Collapse whitespace
 * 5. Extract <a href="..."> links
 * 6. Truncate content to reasonable length (10 000 chars)
 */
export function extractReadableContent(html: string): ExtractedContent {
  // 1. Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // 5. Extract links (before we strip tags)
  const links: string[] = [];
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      links.push(href);
    }
  }

  // 2. Remove <script>, <style>, <nav>, <footer>, <header> and their content
  let cleaned = html;
  const removeTags = ["script", "style", "nav", "footer", "header", "noscript"];
  for (const tag of removeTags) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    cleaned = cleaned.replace(regex, " ");
  }

  // Also remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, " ");

  // 3. Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // 4. Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 6. Truncate to MAX_CONTENT_LENGTH
  const content =
    cleaned.length > MAX_CONTENT_LENGTH
      ? cleaned.slice(0, MAX_CONTENT_LENGTH) + "..."
      : cleaned;

  return { title, content, links };
}
