import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { dinnerById } from "@/lib/dinner/queries";
import { DINNER_NOTE, DINNER_SETTLE_ATTACHMENT, DINNER_TITLE, dinnerDateLine, dinnerPurpose } from "@/lib/dinner/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { PrintToolbar } from "../../leave-request/[id]/toolbar";
import { ApprovalTable, KindHeader } from "../../_components/approval-table";

/**
 * 회식비 품의 pair. stage budget → templates/dinner-budget-request.docx (회식비 청구 품의서),
 * stage settle → templates/dinner-settle-request.docx (회식비 정산 품의서). Both share the 택시비-style 결재표.
 */
export default async function DinnerPrintPage({ params, searchParams }: PageProps<"/print/dinner/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const req = dinnerById(Number(id));
  if (!req) notFound();
  const member = memberById(req.memberId);
  if (!member || !requestAccess(user).canView(member)) notFound();

  const approved = req.status === "approved";
  const approvedOn = approved && req.decidedAt ? todayKey(req.decidedAt).slice(5).replace("-", "/") : null;
  const won = (n: number) => n.toLocaleString("ko-KR");
  const settle = req.stage === "settle";
  const items: { label: string; value: string; bold?: boolean }[] = [
    { label: "목    적", value: dinnerPurpose(req.teamName) },
    ...(settle ? [{ label: "시    기", value: req.dinnerDate ? dinnerDateLine(req.dinnerDate) : "" }] : []),
    { label: "인    원", value: req.headcount },
    { label: "1인당 한도", value: `${won(req.limitPerPerson)}원` },
    { label: "금    액", value: `${won(req.amount)} 원`, bold: settle },
    { label: "법인카드 or 현금 수령인", value: req.payMethod },
    ...(settle ? [{ label: "지급계좌 (개인비용 사용시)", value: req.account }] : []),
  ];
  const note = DINNER_NOTE[req.stage];

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
          title={DINNER_TITLE[req.stage]}
          approved={approved}
          approvedOn={approvedOn}
          firstRowCeo
          receiverDept="경영지원실"
        />

        <p className={`gen-intro${settle ? "" : " taxi-intro"}`}>아래와 같이 결재를 올리오니 검토 후 재가 바랍니다.</p>
        <p className="gen-center">-&nbsp;&nbsp;아&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;래&nbsp;&nbsp;-</p>
        <ol className="dinner-items">
          {items.map((it, i) => (
            <li key={it.label} className={it.bold ? "b" : undefined}>
              <span className="no">{i + 1}.</span>
              <span className="k">{it.label}</span> : <span className="v">{it.value}</span>
            </li>
          ))}
          <li className="note">
            <span className="no">{items.length + 1}.</span>
            <span>
              <span className={settle ? "" : "red"}>{note.title}</span>
              <span className="red body">{settle ? "" : "- "}{note.body}</span>
            </span>
          </li>
        </ol>
        {settle && (
          <p className="gen-attach">
            <span className="k">첨&nbsp;&nbsp;&nbsp;&nbsp;부</span> : <span className="v">{DINNER_SETTLE_ATTACHMENT}</span>
          </p>
        )}

        <div className="footer">㈜ 다이버스</div>
      </div>
    </>
  );
}
