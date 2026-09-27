"use client";

import { useRef, useState } from "react";
import { EditorContent, Node, mergeAttributes, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  BoldIcon,
  CodeSquareIcon,
  FilmIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  TvIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IMAGE_ACCEPT, UPLOAD_MAX_BYTES, UPLOAD_TYPES, VIDEO_ACCEPT, formatBytes, isUploadMime } from "@/lib/uploads/types";
import { cn } from "@/lib/utils";

/** Block node for uploaded video files (<video src controls>). YouTube links use the Youtube extension instead. */
const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "", preload: "metadata" })];
  },
});

type Uploading = { key: number; name: string; progress: number };

/** Upload one file to /api/uploads with progress; resolves to its URL and kind. */
function uploadFile(file: File, teamId: number, onProgress: (p: number) => void): Promise<{ url: string; kind: "image" | "video" }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/uploads?team=${teamId}`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { url?: string; kind?: "image" | "video"; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.url && body.kind) resolve({ url: body.url, kind: body.kind });
      else reject(new Error(body.error || (xhr.status === 413 ? "파일이 너무 큽니다." : "업로드에 실패했습니다.")));
    };
    xhr.onerror = () => reject(new Error("업로드에 실패했습니다. 네트워크를 확인하세요."));
    xhr.send(file);
  });
}

/**
 * Tiptap editor for 게시판 posts. Emits HTML into a hidden input (`name`); the server sanitizes it (lib/board/html.ts).
 * Images/videos upload to local disk via /api/uploads (toolbar, paste or drag & drop) and are scoped to `teamId`.
 */
export function RichEditor({ name, teamId, initialHtml, placeholder, minHeight = 260, onChange }: { name: string; teamId: number; initialHtml: string; placeholder?: string; minHeight?: number; onChange?: (html: string) => void }) {
  const [html, setHtml] = useState(initialHtml);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const editorRef = useRef<Editor | null>(null);

  const insertFiles = async (files: File[], pos?: number) => {
    for (const file of files) {
      if (!isUploadMime(file.type)) {
        toast.error(`${file.name}: 이미지(PNG·JPG·GIF·WEBP) 또는 동영상(MP4·WEBM·MOV)만 올릴 수 있습니다.`);
        continue;
      }
      const kind = UPLOAD_TYPES[file.type].kind;
      if (file.size > UPLOAD_MAX_BYTES[kind]) {
        toast.error(`${file.name}: ${kind === "image" ? "이미지" : "동영상"}는 ${formatBytes(UPLOAD_MAX_BYTES[kind])} 이하만 올릴 수 있습니다.`);
        continue;
      }
      const key = ++seq.current;
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        const res = await uploadFile(file, teamId, (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))));
        const ed = editorRef.current;
        if (!ed) continue;
        const node = res.kind === "image" ? { type: "image", attrs: { src: res.url, alt: file.name.replace(/\.[^.]+$/, "") } } : { type: "video", attrs: { src: res.url } };
        // Follow the media with an empty paragraph so the cursor lands below it (otherwise the atom stays selected and
        // the next insert would replace it).
        const content = [node, { type: "paragraph" }];
        const chain = ed.chain().focus();
        (pos != null ? chain.insertContentAt(pos, content) : chain.insertContent(content)).run();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "업로드에 실패했습니다.");
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
      }
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      Image.configure({ inline: false, allowBase64: false }),
      Video,
      Youtube.configure({ nocookie: true, modestBranding: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: placeholder ?? "내용을 입력하세요. 이미지·동영상은 붙여 넣거나 끌어다 놓을 수 있습니다." }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "rich-content prose prose-sm max-w-none px-4 py-3 focus:outline-none", style: `min-height:${minHeight}px` },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (files.length === 0) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (moved || files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(files, pos);
        return true;
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
    onUpdate: ({ editor }) => {
      const next = editor.isEmpty ? "" : editor.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <input type="hidden" name={name} value={html} />
      {editor ? <Toolbar editor={editor} onImage={() => imageInput.current?.click()} onVideo={() => videoInput.current?.click()} busy={uploads.length > 0} /> : <div className="h-10 border-b bg-muted/30" />}
      {uploads.length > 0 && (
        <div className="grid gap-1 border-b bg-brand-soft/40 px-3 py-2 text-xs">
          {uploads.map((u) => (
            <div key={u.key} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="h-1.5 w-32 overflow-hidden rounded-full bg-white">
                <span className="block h-full bg-brand transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">{Math.round(u.progress * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void insertFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_ACCEPT}
        hidden
        onChange={(e) => {
          void insertFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Toolbar({ editor, onImage, onVideo, busy }: { editor: Editor; onImage: () => void; onVideo: () => void; busy: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1" role="toolbar" aria-label="서식">
      <Tool icon={Heading2Icon} label="제목" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Tool icon={Heading3Icon} label="소제목" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <Tool icon={BoldIcon} label="굵게" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Tool icon={ItalicIcon} label="기울임" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Tool icon={UnderlineIcon} label="밑줄" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <Tool icon={StrikethroughIcon} label="취소선" active={s.strike} onClick={() => c().toggleStrike().run()} />
      <Sep />
      <Tool icon={ListIcon} label="글머리 목록" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Tool icon={ListOrderedIcon} label="번호 목록" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <Tool icon={QuoteIcon} label="인용" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <Tool icon={CodeSquareIcon} label="코드 블록" active={s.code} onClick={() => c().toggleCodeBlock().run()} />
      <Tool icon={MinusIcon} label="구분선" onClick={() => c().setHorizontalRule().run()} />
      <Sep />
      <UrlTool
        icon={LinkIcon}
        label="링크"
        active={s.link}
        placeholder="https://"
        initial={() => (editor.getAttributes("link").href as string) ?? ""}
        onSubmit={(url) => (url ? c().extendMarkRange("link").setLink({ href: /^(https?:|mailto:)/.test(url) ? url : `https://${url}` }).run() : c().extendMarkRange("link").unsetLink().run())}
        allowEmpty
      />
      <Tool icon={ImageIcon} label="이미지 올리기" onClick={onImage} disabled={busy} />
      <Tool icon={FilmIcon} label="동영상 올리기" onClick={onVideo} disabled={busy} />
      <UrlTool
        icon={TvIcon}
        label="YouTube 링크"
        placeholder="https://youtu.be/…"
        initial={() => ""}
        onSubmit={(url) => {
          if (!c().setYoutubeVideo({ src: url }).run()) toast.error("YouTube 주소가 올바르지 않습니다.");
        }}
      />
      <div className="ml-auto flex items-center gap-0.5">
        <Tool icon={Undo2Icon} label="실행 취소" onClick={() => c().undo().run()} disabled={!s.canUndo} />
        <Tool icon={Redo2Icon} label="다시 실행" onClick={() => c().redo().run()} disabled={!s.canRedo} />
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function Tool({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40", active && "bg-brand-soft text-accent-foreground")}
    >
      <Icon className="size-4" />
    </button>
  );
}

function UrlTool({ icon: Icon, label, active, placeholder, initial, onSubmit, allowEmpty }: { icon: LucideIcon; label: string; active?: boolean; placeholder: string; initial: () => string; onSubmit: (url: string) => void; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(initial());
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          className={cn("grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground", active && "bg-brand-soft text-accent-foreground")}
        >
          <Icon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!value.trim() && !allowEmpty) return;
                onSubmit(value.trim());
                setOpen(false);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={!value.trim() && !allowEmpty}
            onClick={() => {
              onSubmit(value.trim());
              setOpen(false);
            }}
          >
            {allowEmpty && !value.trim() ? "해제" : "넣기"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
