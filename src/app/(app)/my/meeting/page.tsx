import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import { allTeams } from "@/lib/members/queries";
import { generateMeetingNotes, saveMeetingNotes, saveMeetingTopics } from "@/lib/meetings/actions";
import { collectMeetingSource, meetingPeriodLabel, renderMeetingSource } from "@/lib/meetings/data";
import { meetingNoteFor } from "@/lib/meetings/queries";
import { openAIConfigured, openAIModel } from "@/lib/reports/openai";
import { reportAccess } from "@/lib/reports/queries";
import { Button } from "@/components/ui/button";
import { AiDocEditor } from "@/components/ai-doc/ai-doc-editor";
import { MeetingTeamPicker } from "./team-picker";
import { TopicsForm } from "./topics-form";

export const metadata: Metadata = { title: "미팅 노트" };

export default async function MeetingPage({ searchParams }: PageProps<"/my/meeting">) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = reportAccess(user);
  const teams = allTeams().filter((t) => access.canEdit(t.id));
  if (teams.length === 0) redirect("/my/today");
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const weekStart = isValidKey(sp.week) ? weekStartOf(sp.week) : thisWeek;
  const requested = Number(sp.team);
  const team = teams.find((t) => t.id === requested) ?? teams.find((t) => t.id === access.myTeamId) ?? teams[0];
  const href = (p: { week?: string; team?: number }) => `/my/meeting?team=${p.team ?? team.id}&week=${p.week ?? weekStart}`;

  const note = meetingNoteFor(team.id, weekStart);
  const src = collectMeetingSource(team.id, weekStart);
  const sourceText = src ? renderMeetingSource(src, note?.topics ?? "") : "";
  const period = meetingPeriodLabel(weekStart);

  const generateAction = async (instructions: string) => {
    "use server";
    return generateMeetingNotes(team.id, weekStart, instructions);
  };
  const saveAction = async (content: string, status: "draft" | "final") => {
    "use server";
    return saveMeetingNotes(team.id, weekStart, content, status);
  };
  const topicsAction = async (topics: string) => {
    "use server";
    return saveMeetingTopics(team.id, weekStart, topics);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">팀 회의 미팅 노트</h2>
          <p className="text-sm text-muted-foreground">
            {team.name} · {period}{weekStart === thisWeek && " · 이번 주"} · 지난주 한 일과 이번주 할 일, 마일스톤을 바탕으로 회의 질문을 준비합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {teams.length > 1 && <MeetingTeamPicker teams={teams} value={team.id} weekStart={weekStart} />}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild aria-label="이전 주"><Link href={href({ week: addDays(weekStart, -7) })}><ChevronLeftIcon className="size-4" /></Link></Button>
            <Button variant="outline" size="sm" asChild><Link href={href({ week: thisWeek })}>이번 주</Link></Button>
            <Button variant="outline" size="icon" asChild aria-label="다음 주"><Link href={href({ week: addDays(weekStart, 7) })}><ChevronRightIcon className="size-4" /></Link></Button>
          </div>
        </div>
      </div>

      <TopicsForm key={`${team.id}:${weekStart}`} initial={note?.topics ?? ""} action={topicsAction} />

      <AiDocEditor
        title={`${team.name} 주간 회의 노트`}
        description={period}
        initialContent={note?.content ?? ""}
        initialStatus={note?.status ?? "draft"}
        meta={note ? { model: note.model, generatedAt: note.generatedAt?.getTime() ?? null, updatedAt: note.updatedAt.getTime(), updatedByName: note.updatedByName } : null}
        canEdit
        aiReady={openAIConfigured()}
        model={openAIModel()}
        sourceText={sourceText}
        sourceLabel="지난주·이번주 기록과 마일스톤 보기"
        aiTitle="AI 미팅 노트"
        aiDescription="회의 주제, 지난주 미완료·이번주 계획, 마일스톤 진행과 지연, 주의 신호를 바탕으로 구성원별 질문과 병목 체크리스트를 만듭니다."
        generateLabel="AI 미팅 노트 생성"
        finalLabel="회의 준비 완료"
        placeholder={"오른쪽에서 ‘AI 미팅 노트 생성’을 누르거나 직접 작성하세요.\n\n# 주간 회의 노트\n## 회의 주제\n- "}
        generateAction={generateAction}
        saveAction={saveAction}
      />
    </div>
  );
}
