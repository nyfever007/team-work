import "server-only";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Upload } from "@/lib/db/schema";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES, UPLOAD_URL_PREFIX, type UploadMime } from "./types";

/** Local directory for uploaded files (keep it out of `public/`; files are served through an auth-checked route). */
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"));

/** Unreferenced uploads (editor inserts that were never saved in a post) are removed after this long. */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

export class UploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Magic-byte check so a renamed HTML/script file can't be stored as an image or video. */
function signatureMatches(mime: UploadMime, b: Buffer): boolean {
  const hex = b.subarray(0, 12).toString("hex");
  switch (mime) {
    case "image/png":
      return hex.startsWith("89504e470d0a1a0a");
    case "image/jpeg":
      return hex.startsWith("ffd8ff");
    case "image/gif":
      return b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a";
    case "image/webp":
      return b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
    case "video/mp4":
    case "video/quicktime":
      return b.subarray(4, 8).toString("latin1") === "ftyp" || ["moov", "mdat", "wide", "free"].includes(b.subarray(4, 8).toString("latin1"));
    case "video/webm":
      return hex.startsWith("1a45dfa3");
  }
}

/**
 * Stream a request body to disk (no buffering), enforcing the size limit and file signature, then record it.
 * Files land in UPLOAD_DIR/YYYY/MM/<uuid>.<ext>.
 */
export async function saveUpload(opts: { body: WebReadableStream<Uint8Array> | ReadableStream<Uint8Array>; mime: UploadMime; teamId: number; userId: number; originalName: string; declaredSize?: number }): Promise<Upload> {
  const type = UPLOAD_TYPES[opts.mime];
  const max = UPLOAD_MAX_BYTES[type.kind];
  if (opts.declaredSize && opts.declaredSize > max) throw new UploadError(`${type.kind === "image" ? "이미지" : "동영상"}는 ${max / 1024 / 1024}MB 이하만 올릴 수 있습니다.`, 413);

  const id = randomUUID();
  const now = new Date();
  const rel = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), `${id}.${type.ext}`);
  const dest = path.join(UPLOAD_DIR, rel);
  const tmp = `${dest}.part`;
  await mkdir(path.dirname(dest), { recursive: true });

  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > max) cb(new UploadError(`${type.kind === "image" ? "이미지" : "동영상"}는 ${max / 1024 / 1024}MB 이하만 올릴 수 있습니다.`, 413));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(opts.body as WebReadableStream<Uint8Array>), limiter, createWriteStream(tmp));
    if (size === 0) throw new UploadError("빈 파일입니다.");
    const fh = await open(tmp, "r");
    const head = Buffer.alloc(16);
    await fh.read(head, 0, 16, 0);
    await fh.close();
    if (!signatureMatches(opts.mime, head)) throw new UploadError("파일 형식이 올바르지 않습니다.");
    await rename(tmp, dest);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e instanceof UploadError ? e : new UploadError("업로드에 실패했습니다.", 500);
  }

  const row = db
    .insert(schema.uploads)
    .values({ id, teamId: opts.teamId, userId: opts.userId, kind: type.kind, mime: opts.mime, size, path: rel, originalName: opts.originalName.slice(0, 200) })
    .returning()
    .get();
  return row;
}

export function uploadById(id: string): Upload | undefined {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  return db.select().from(schema.uploads).where(eq(schema.uploads.id, id)).get();
}

/** Absolute path of a stored file, refusing anything that escapes UPLOAD_DIR. */
export function uploadFilePath(u: Upload): string {
  const abs = path.resolve(UPLOAD_DIR, u.path);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new UploadError("잘못된 파일 경로입니다.", 400);
  return abs;
}

export async function fileSize(abs: string): Promise<number | null> {
  try {
    return (await stat(abs)).size;
  } catch {
    return null;
  }
}

async function removeRows(rows: Upload[]) {
  if (rows.length === 0) return;
  for (const r of rows) await rm(uploadFilePath(r), { force: true }).catch(() => {});
  db.delete(schema.uploads).where(inArray(schema.uploads.id, rows.map((r) => r.id))).run();
}

/** Upload ids referenced by a post's HTML. */
export function referencedUploadIds(html: string): string[] {
  const re = new RegExp(`${UPLOAD_URL_PREFIX.replace(/\//g, "\\/")}([0-9a-f-]{36})`, "g");
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))];
}

/**
 * After a post is saved: attach the uploads its HTML references (same team only) and delete files this post no
 * longer uses. Returns nothing; the sanitizer has already dropped references to other teams' files.
 */
export async function syncPostUploads(postId: number, teamId: number, html: string) {
  const ids = referencedUploadIds(html);
  if (ids.length) db.update(schema.uploads).set({ postId }).where(and(inArray(schema.uploads.id, ids), eq(schema.uploads.teamId, teamId))).run();
  const stale = db.select().from(schema.uploads).where(eq(schema.uploads.postId, postId)).all().filter((u) => !ids.includes(u.id));
  await removeRows(stale);
}

/** Files of a post that is being deleted (call before deleting the row). */
export async function deletePostUploads(postId: number) {
  await removeRows(db.select().from(schema.uploads).where(eq(schema.uploads.postId, postId)).all());
}

/** Remove uploads never attached to a post within ORPHAN_TTL_MS. Cheap; run on each upload. */
export async function sweepOrphanUploads() {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_MS);
  await removeRows(db.select().from(schema.uploads).where(and(isNull(schema.uploads.postId), lt(schema.uploads.createdAt, cutoff))).all());
}
