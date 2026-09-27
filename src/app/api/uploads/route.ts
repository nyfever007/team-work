import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { teamScope } from "@/lib/teams/scope";
import { saveUpload, sweepOrphanUploads, UploadError } from "@/lib/uploads/storage";
import { isUploadMime, uploadUrl } from "@/lib/uploads/types";

/**
 * POST /api/uploads?team=ID — raw file body (not multipart), `Content-Type` = file type, `X-File-Name` = encoded name.
 * Excluded from the proxy matcher so large videos stream straight to disk; auth + team checks happen here.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const teamId = Number(req.nextUrl.searchParams.get("team"));
  const scope = teamScope(user, String(teamId));
  if (!teamId || !scope.canRead(teamId)) return NextResponse.json({ error: "이 팀에 파일을 올릴 권한이 없습니다." }, { status: 403 });

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!isUploadMime(mime)) return NextResponse.json({ error: "이미지(PNG·JPG·GIF·WEBP) 또는 동영상(MP4·WEBM·MOV)만 올릴 수 있습니다." }, { status: 415 });
  if (!req.body) return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });

  let name = "";
  try {
    name = decodeURIComponent(req.headers.get("x-file-name") ?? "");
  } catch {}

  try {
    const row = await saveUpload({ body: req.body, mime, teamId, userId: user.id, originalName: name, declaredSize: Number(req.headers.get("content-length")) || undefined });
    void sweepOrphanUploads().catch(() => {});
    return NextResponse.json({ id: row.id, url: uploadUrl(row.id), kind: row.kind, size: row.size });
  } catch (e) {
    const status = e instanceof UploadError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error && e.message ? e.message : "업로드에 실패했습니다." }, { status });
  }
}
