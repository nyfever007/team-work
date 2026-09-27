import "server-only";
import sanitizeHtml from "sanitize-html";
import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { referencedUploadIds } from "@/lib/uploads/storage";
import { UPLOAD_URL_PREFIX } from "@/lib/uploads/types";

/** Max stored HTML length (the plain-text limit is checked separately). */
export const POST_HTML_MAX = 200_000;

const YOUTUBE = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/[\w-]+(\?[\w=&%-]*)?$/;
const uploadSrc = (src: string, allowed: Set<string>) => {
  const id = src.startsWith(UPLOAD_URL_PREFIX) ? src.slice(UPLOAD_URL_PREFIX.length) : "";
  return /^[0-9a-f-]{36}$/.test(id) && allowed.has(id);
};

/**
 * Sanitize editor HTML before storing it. Keeps the Tiptap toolbar's formatting, links (http/https/mailto, opened in a
 * new tab), <img>/<video> only from this team's uploads, and YouTube embeds. Everything else (scripts, styles, event
 * handlers, other iframes, foreign images) is dropped.
 */
export function sanitizePostHtml(html: string, teamId: number): string {
  const ids = referencedUploadIds(html);
  const allowed = new Set(
    ids.length
      ? db
          .select({ id: schema.uploads.id, teamId: schema.uploads.teamId })
          .from(schema.uploads)
          .where(inArray(schema.uploads.id, ids))
          .all()
          .filter((u) => u.teamId === teamId)
          .map((u) => u.id)
      : [],
  );

  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "img", "video", "div", "iframe"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      video: ["src", "controls", "preload"],
      div: ["data-youtube-video"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow", "frameborder"],
      ol: ["start"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: [], video: [] },
    allowProtocolRelative: false,
    allowedClasses: { code: [/^language-[\w-]+$/] },
    exclusiveFilter: (frame) => {
      if (frame.tag === "img" || frame.tag === "video") return !uploadSrc(frame.attribs.src ?? "", allowed);
      if (frame.tag === "iframe") return !YOUTUBE.test(frame.attribs.src ?? "");
      return false;
    },
    transformTags: {
      // Only the YouTube wrapper <div> survives; any other div is unwrapped (renamed to a disallowed tag, text kept).
      div: (tagName, attribs): sanitizeHtml.Tag => (attribs["data-youtube-video"] !== undefined ? { tagName, attribs: { "data-youtube-video": "" } } : { tagName: "x-unwrap", attribs: {} }),
      a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" } }),
      video: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src ?? "", controls: "", preload: "metadata" } }),
      iframe: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src ?? "", width: "640", height: "360", allowfullscreen: "true", frameborder: "0", allow: "encrypted-media; picture-in-picture; fullscreen" } }),
    },
  }).trim();
}

/** Plain text of sanitized HTML (block boundaries become newlines) for search, excerpts and AI sources. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>/gi, "\n")
    .replace(/<(img|video)[^>]*>/gi, (m) => (m.startsWith("<img") ? " [이미지] " : " [동영상] "))
    .replace(/<iframe[^>]*>/gi, " [동영상] ");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** HTML for an old plain-text post so it can be edited in the rich editor. */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
