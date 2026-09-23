import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon, PrinterIcon } from 'lucide-react';
import { requireUser } from '@/lib/auth/dal';
import { todayKey } from '@/lib/dates';
import { leaveBalance } from '@/lib/leaves/balance';
import { LeaveBalanceCard } from '@/components/leaves/balance-card';
import {
  LEAVE_BADGE_CLASS,
  LEAVE_LABEL,
  REQUEST_STATUS_LABEL,
} from '@/lib/leaves/types';
import { allMembers } from '@/lib/members/queries';
import { formatDays } from '@/lib/requests/calc';
import { requestAccess, requestsFor } from '@/lib/requests/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: '휴가 품의서' };

export default async function RequestsPage() {
  const user = await requireUser();
  const access = requestAccess(user);
  const visible = allMembers().filter((m) => access.canView(m));
  const requests = requestsFor(visible.map((m) => m.id));
  const canCreate = access.isAdmin || !!access.me;
  const today = todayKey();
  const myBalance = access.me ? leaveBalance(access.me, today) : null;
  const teamBalances =
    access.isAdmin || access.me?.isLeader
      ? visible.map((m) => ({ m, b: leaveBalance(m, today) }))
      : [];

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>휴가 현황 · 품의서</h2>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href='/schedule/requests/new'>
              <PlusIcon className='size-4' />
              품의서 작성
            </Link>
          </Button>
        )}
      </div>

      {access.me && myBalance && (
        <LeaveBalanceCard name={access.me.name} balance={myBalance} />
      )}

      {teamBalances.length > 0 && (
        <details className='rounded-lg border'>
          <summary className='cursor-pointer px-4 py-3 text-sm font-medium'>
            {access.isAdmin ? '전체 구성원' : '팀'} 잔여 현황{' '}
            <span className='font-normal text-muted-foreground'>
              ({teamBalances.length}명)
            </span>
          </summary>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구성원</TableHead>
                <TableHead className='text-right'>연차 가능</TableHead>
                <TableHead className='text-right'>연차 사용</TableHead>
                <TableHead className='text-right'>연차 잔여</TableHead>
                <TableHead className='text-right'>병가 사용</TableHead>
                <TableHead className='text-right'>병가 잔여</TableHead>
                <TableHead>연차 연도 (입사일 기준)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamBalances.map(({ m, b }) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className='font-medium'>{m.name}</span>{' '}
                    <span className='text-xs text-muted-foreground'>
                      {m.team}
                    </span>
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {formatDays(b.annual.accrued)}{b.annual.accrued < b.annual.total && <span className='ml-1 text-[10px] text-muted-foreground'>/ {formatDays(b.annual.total)}</span>}
                  </TableCell>
                  <TableCell className='text-right tabular-nums text-muted-foreground'>
                    {formatDays(b.annual.used)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-medium',
                      b.annual.remaining < 0 && 'text-destructive',
                    )}
                  >
                    {formatDays(b.annual.remaining)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums text-muted-foreground'>
                    {formatDays(b.sick.used)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-medium',
                      b.sick.remaining <= 0 && 'text-destructive',
                    )}
                  >
                    {formatDays(b.sick.remaining)}
                  </TableCell>
                  <TableCell className='text-xs text-muted-foreground tabular-nums'>
                    {b.period.yearIndex}년차 · {b.period.start} ~ {b.period.end}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      )}

      {!access.me && !access.isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
            <CardDescription>
              구성원 정보와 연결된 계정만 품의서를 작성하고 볼 수 있습니다.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>문서번호</TableHead>
                <TableHead>성명</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>신청일자</TableHead>
                <TableHead className='text-right'>일수</TableHead>
                <TableHead>사유</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className='w-24' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='h-24 text-center text-muted-foreground'
                  >
                    아직 품의서가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {requests.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    r.status === 'cancelled' && 'text-muted-foreground',
                  )}
                >
                  <TableCell className='font-mono text-xs'>
                    <Link
                      href={`/schedule/requests/${r.id}`}
                      className='hover:underline'
                    >
                      {r.docNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className='font-medium'>{r.memberName}</div>
                    <div className='text-xs text-muted-foreground'>
                      {r.teamName} · {r.position}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        LEAVE_BADGE_CLASS[r.type],
                      )}
                    >
                      {LEAVE_LABEL[r.type]}
                    </span>
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {r.startDate}
                    {r.endDate !== r.startDate && ` ~ ${r.endDate}`}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {formatDays(r.days)}일
                  </TableCell>
                  <TableCell
                    className='max-w-64 truncate text-sm'
                    title={r.reason}
                  >
                    {r.reason || (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === 'cancelled' ? 'outline' : 'secondary'
                      }
                    >
                      {REQUEST_STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Button variant='ghost' size='sm' asChild>
                        <Link href={`/schedule/requests/${r.id}`}>보기</Link>
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        asChild
                        aria-label={`${r.docNo} 인쇄`}
                      >
                        <a
                          href={`/print/leave-request/${r.id}`}
                          target='_blank'
                          rel='noopener'
                        >
                          <PrinterIcon className='size-4' />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
