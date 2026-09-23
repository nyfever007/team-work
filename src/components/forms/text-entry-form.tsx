"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { SaveState } from "@/lib/logs/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  defaultValue: string;
  placeholder?: string;
  savedLabel?: string | null; // e.g. "9. 22. 09:12"
  rows?: number;
  disabled?: boolean;
};

export function TextEntryForm({ action, defaultValue, placeholder, savedLabel, rows = 5, disabled }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const lastToast = useRef<number>(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok && state.savedAt !== lastToast.current) {
      lastToast.current = state.savedAt;
      toast.success("저장했습니다.");
    } else if (!state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <Textarea
        name="text"
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled || pending}
        className="resize-y"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {savedLabel ? `마지막 저장 ${savedLabel}` : "아직 저장되지 않았습니다"}
          <span className="hidden sm:inline"> · ⌘/Ctrl+Enter로 저장</span>
        </p>
        <Button type="submit" size="sm" disabled={disabled || pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          저장
        </Button>
      </div>
    </form>
  );
}
