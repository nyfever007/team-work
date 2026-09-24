import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { taxiById } from "@/lib/taxi/queries";
import { TAXI_TITLE, periodLine } from "@/lib/taxi/types";
import { PrintToolbar } from "../../leave-request/[id]/toolbar";
import { ApprovalTable, KindHeader } from "../../_components/approval-table";

/** 택시비 지급 품의서 — mirrors templates/taxi-request.docx (1차 row includes 대표이사, 수신 부서 = 경영지원실, fixed 제목). */
export default async function TaxiPrintPage({ params, searchParams }: PageProps<"/print/taxi/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const req = taxiById(Number(id));
  if (!req) notFound();
  const member = memberById(req.memberId);
  if (!member || !requestAccess(user).canView(member)) notFound();

  const approved = req.status === "approved";
  const approvedOn = approved && req.decidedAt ? todayKey(req.decidedAt).slice(5).replace("-", "/") : null;
  const items = [
    { label: "지급 요청 사유", value: req.reason },
    { label: "이 용 기 간", value: periodLine(req.useStart, req.useEnd) },
    { label: "부   서   명", value: req.teamName },
    { label: "작 성 담 당 자", value: `${req.position} ${req.memberName}` },
    { label: "총 이 용 금 액", value: `${req.amount.toLocaleString("ko-KR")} 원` },
    { label: "지 급 계 좌", value: req.account },
  ];

  return (
    <>
      <PrintToolbar autoPrint={sp.auto === "1"} />
      <div className="sheet">
        {req.status === "cancelled" && <div className="status-stamp">취 소</div>}
        {req.status === "rejected" && <div className="status-stamp">반 려</div>}
        <KindHeader />
        <ApprovalTable
          docNo={req.docNo}
          writtenAt={req.writtenAt}
          teamName={req.teamName}
          position={req.position}
          memberName={req.memberName}
          retention={req.retention}
          title={TAXI_TITLE}
          approved={approved}
          approvedOn={approvedOn}
          firstRowCeo
          receiverDept="경영지원실"
        />

        <p className="gen-intro taxi-intro">아래와 같이 결재를 올리오니 검토 후 재가 바랍니다.</p>
        <p className="gen-center taxi-center">-&nbsp;&nbsp;아&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;래&nbsp;&nbsp;-</p>
        <ol className="gen-items taxi-items">
          {items.map((it, i) => (
            <li key={it.label}>
              <span className="no">{i + 1}.</span>
              <span className="k">{it.label}</span>
              <span className="c">:</span>
              <span className="v">{it.value}</span>
            </li>
          ))}
        </ol>
        <ul className="taxi-attach">
          <li>
            <span className="k">첨&nbsp;&nbsp;부</span> : <span className="v">{req.attachment}</span>
          </li>
        </ul>

        <div className="footer">㈜ 다이버스</div>
      </div>
    </>
  );
}
