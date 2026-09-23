import type { Metadata } from "next";
import { isNull } from "drizzle-orm";
import { KeyRoundIcon, PencilIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { leaveBalance } from "@/lib/leaves/balance";
import { allMembers, allTeams } from "@/lib/members/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaderBadge } from "@/components/leader-badge";
import { AccountDialog } from "./account-dialog";
import { DeleteMemberButton } from "./delete-member-button";
import { MemberDialog } from "./member-dialog";

export const metadata: Metadata = { title: "구성원" };

function formatDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default async function UsersPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";

  const members = allMembers();
  const teams = allTeams();

  const today = todayKey();
  const balances = new Map(members.map((m) => [m.id, leaveBalance(m, today)]));

  const accounts = db
    .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email, role: schema.users.role, memberId: schema.users.memberId, name: schema.users.name })
    .from(schema.users)
    .all();
  const accountByMember = new Map(accounts.filter((a) => a.memberId != null).map((a) => [a.memberId as number, a]));
  const unlinkedUsers = isAdmin
    ? db.select({ id: schema.users.id, username: schema.users.username, email: schema.users.email, name: schema.users.name }).from(schema.users).where(isNull(schema.users.memberId)).all()
    : [];

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">구성원</h2>
          <p className="text-sm text-muted-foreground">
            {teams.length}개 팀 · 구성원 {members.length}명 · 연차·병가는 입사일 기준 연차 연도 · 팀장 지정은{" "}
            <Link href="/admin/teams" className="underline underline-offset-4">
              팀 관리
            </Link>
            에서
          </p>
        </div>
        {isAdmin && (
          <MemberDialog
            teams={teams}
            trigger={
              <Button>
                <PlusIcon className="size-4" />
                구성원 추가
              </Button>
            }
          />
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>팀</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>직책 · 직급</TableHead>
              <TableHead>이메일 · 전화</TableHead>
              <TableHead>입사일</TableHead>
              <TableHead className="text-right">연차(연간)</TableHead>
              <TableHead className="text-right">사용</TableHead>
              <TableHead className="text-right">잔여</TableHead>
              <TableHead className="text-right">병가 잔여</TableHead>
              <TableHead>계정</TableHead>
              {isAdmin && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 11 : 10} className="h-24 text-center text-muted-foreground">
                  등록된 구성원이 없습니다.{isAdmin && " ‘구성원 추가’ 버튼으로 첫 구성원을 등록하세요."}
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => {
              const account = accountByMember.get(m.id) ?? null;
              const b = balances.get(m.id)!;
              return (
                <TableRow key={m.id} className={m.id === me.memberId ? "bg-muted/40" : undefined}>
                  <TableCell>
                    <Badge variant="secondary">{m.team}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.isLeader && <LeaderBadge className="ml-2" />}
                    {m.id === me.memberId && (
                      <Badge variant="outline" className="ml-2">
                        나
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.position}
                    {m.rank && <span className="ml-1 text-xs text-muted-foreground">{m.rank}</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{m.email || "—"}</div>
                    <div className="tabular-nums">{m.phone || ""}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.joinedAt}</TableCell>
                  <TableCell className="text-right tabular-nums" title={`${b.period.yearIndex}년차 · ${b.annual.rule} · ${b.period.start} ~ ${b.period.end}`}>
                    {formatDays(b.annual.total)}
                    <span className="ml-1 text-[10px] text-muted-foreground">{b.annual.mode === "override" ? "지정" : `${b.period.yearIndex}년차`}</span>
                    {b.annual.accrued < b.annual.total && <span className="ml-1 text-[10px] text-muted-foreground">발생 {formatDays(b.annual.accrued)}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatDays(b.annual.used)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${b.annual.remaining < 0 ? "text-destructive" : ""}`}>{formatDays(b.annual.remaining)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${b.sick.remaining <= 0 ? "text-destructive" : ""}`}>{formatDays(b.sick.remaining)}</TableCell>
                  <TableCell>
                    {account ? (
                      isAdmin ? (
                        <AccountDialog
                          memberId={m.id}
                          memberName={m.name}
                          account={{ id: account.id, username: account.email ?? account.username, role: account.role }}
                          unlinkedUsers={unlinkedUsers}
                          trigger={
                            <Button variant="ghost" size="sm" className="-ml-2 font-normal">
                              <KeyRoundIcon className="size-3.5 text-muted-foreground" />{account.email ?? `@${account.username}`}
                            </Button>
                          }
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{account.email ?? `@${account.username}`}</span>
                      )
                    ) : isAdmin ? (
                      <AccountDialog
                        memberId={m.id}
                        memberName={m.name}
                        memberEmail={m.email}
                        account={null}
                        unlinkedUsers={unlinkedUsers}
                        trigger={
                          <Button variant="outline" size="sm">
                            <UserPlusIcon className="size-3.5" />
                            계정 연결
                          </Button>
                        }
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">없음</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <MemberDialog
                          member={m}
                          teams={teams}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`${m.name} 수정`}>
                              <PencilIcon className="size-4" />
                            </Button>
                          }
                        />
                        <DeleteMemberButton id={m.id} name={m.name} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
