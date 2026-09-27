import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate } from "@/lib/dates";
import { memberOneOnOnes, type MemberOneOnOne } from "@/lib/one-on-one/queries";
import { ONE_ON_ONE_STATUS_LABEL } from "@/lib/one-on-one/types";
import { ActionList } from "@/components/one-on-one/action-list";
import { MemberAgendaForm } from "@/components/one-on-one/member-agenda-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "1:1" };

function Section({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function MeetingCard({ m }: { m: MemberOneOnOne }) {
  const planned = m.status === "planned";
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-bold">{formatKoDate(m.date)}</CardTitle>
          <Badge className={planned ? "bg-brand-soft text-accent-foreground" : "bg-emerald-100 text-emerald-800"}>{ONE_ON_ONE_STATUS_LABEL[m.status]}</Badge>
          <span className="ml-auto text-xs text-muted-foreground">{m.leaderName}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Section label="안건" text={m.agenda} />
        {planned ? <MemberAgendaForm meetingId={m.id} initial={m.memberAgenda} /> : <Section label="내가 올린 주제" text={m.memberAgenda} />}
        <Section label="논의·합의" text={m.notes} />
        {m.actions.length > 0 && (
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">후속 조치</span>
            <ActionList actions={m.actions.map((a) => ({ id: a.id, title: a.title, owner: a.owner, done: a.doneAt != null }))} toggle="member" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function MyOneOnOnePage() {
  const user = await requireUser();
  if (user.memberId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // memberOneOnOnes never selects privateNotes.
  const all = memberOneOnOnes(user.memberId);
  const planned = all.filter((m) => m.status === "planned").sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const past = all.filter((m) => m.status !== "planned");

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-bold">1:1 미팅</h2>
        <p className="text-sm text-muted-foreground">
          예정 {planned.length}건 · 지난 {past.length}건
        </p>
      </div>

      {all.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>아직 1:1 기록이 없습니다</CardTitle>
            <CardDescription>팀장이 1:1을 잡으면 여기에 표시됩니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {planned.length > 0 && (
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground">예정</h3>
              {planned.map((m) => (
                <MeetingCard key={m.id} m={m} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground">지난 1:1</h3>
              {past.map((m) => (
                <MeetingCard key={m.id} m={m} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
