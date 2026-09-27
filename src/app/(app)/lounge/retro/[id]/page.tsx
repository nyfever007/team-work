import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, EyeOffIcon, FlagIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatTime } from "@/lib/dates";
import { openAIConfigured } from "@/lib/reports/openai";
import { milestoneTitle, retroAccess, retroById, retroItemsView, teamMemberOptions } from "@/lib/retro/queries";
import { RETRO_STATUS_LABEL } from "@/lib/retro/types";
import { RetroBoard } from "@/components/retro/retro-board";
import { RetroControls } from "@/components/retro/retro-controls";
import { RetroSummary } from "@/components/retro/retro-summary";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "회고" };

export default async function RetroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const retro = retroById(Number(id));
  if (!retro) notFound();
  const access = retroAccess(user, retro);
  if (!access) notFound();

  const open = retro.status === "open";
  const items = retroItemsView(retro, access.memberId);
  const members = teamMemberOptions(retro.teamId);
  const listHref = user.role === "admin" ? `/lounge/retro?team=${retro.teamId}` : "/lounge/retro";
  const msTitle = milestoneTitle(retro.milestoneId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Link href={listHref} className="inline-flex w-fit items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-3.5" />
            회고 목록
          </Link>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {retro.title}
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", open ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>{RETRO_STATUS_LABEL[retro.status]}</span>
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {retro.createdByName} · {formatTime(retro.createdAt)}
            </span>
            {msTitle && (
              <span className="inline-flex items-center gap-1">
                <FlagIcon className="size-3" />
                {msTitle}
              </span>
            )}
            {retro.anonymous && (
              <span className="inline-flex items-center gap-1">
                <EyeOffIcon className="size-3" />
                익명
              </span>
            )}
          </p>
        </div>
        {access.canLead && <RetroControls retroId={retro.id} title={retro.title} open={open} listHref={listHref} />}
      </div>

      {!open && <p className="text-xs text-muted-foreground">마감된 회고입니다. Try 담당자 지정과 완료 표시는 계속할 수 있습니다.</p>}

      <RetroSummary retroId={retro.id} summary={retro.summary} canLead={access.canLead} aiEnabled={openAIConfigured()} hasItems={items.length > 0} />

      <RetroBoard retroId={retro.id} items={items} members={members} myMemberId={access.memberId} canWrite={access.canWrite} canLead={access.canLead} open={open} />
    </div>
  );
}
