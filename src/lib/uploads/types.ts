// Client-safe upload rules for the 게시판 editor. The server re-checks type, size and file signature.

export const UPLOAD_TYPES = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/gif": { kind: "image", ext: "gif" },
  "image/webp": { kind: "image", ext: "webp" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
} as const;

export type UploadMime = keyof typeof UPLOAD_TYPES;
export type UploadKind = "image" | "video";

export const UPLOAD_MAX_BYTES: Record<UploadKind, number> = { image: 10 * 1024 * 1024, video: 200 * 1024 * 1024 };

export const IMAGE_ACCEPT = Object.keys(UPLOAD_TYPES).filter((m) => m.startsWith("image/")).join(",");
export const VIDEO_ACCEPT = Object.keys(UPLOAD_TYPES).filter((m) => m.startsWith("video/")).join(",");

export const isUploadMime = (m: string): m is UploadMime => m in UPLOAD_TYPES;

/** URL prefix the editor inserts and the sanitizer allows for <img>/<video> src. */
export const UPLOAD_URL_PREFIX = "/api/uploads/";
export const uploadUrl = (id: string) => `${UPLOAD_URL_PREFIX}${id}`;

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
