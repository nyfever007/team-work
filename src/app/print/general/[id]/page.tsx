import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { generalById } from "@/lib/general/queries";
import { amountLine } from "@/lib/general/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { PrintToolbar } from "../../leave-request/[id]/toolbar";
import { ApprovalTable, KindHeader } from "../../_components/approval-table";

/**
 * 일반 품의서 — mirrors templates/general-request.docx. 결재표 = shared `ApprovalTable` (1차 row without 대표이사).
 */
export default async function GeneralPrintPage({ params, searchParams }: PageProps<"/print/general/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const req = generalById(Number(id));
  if (!req) notFound();
  const member = memberById(req.memberId);
  if (!member || !requestAccess(user).canView(member)) notFound();

  const approved = req.status === "approved";
  const approvedOn = approved && req.decidedAt ? todayKey(req.decidedAt).slice(5).replace("-", "/") : null;
  // Optional lines (기간·시기) drop out and the rest renumber, like the Word list.
  const items: { label: string; value: string; bold?: boolean }[] = [
    { label: "목    적", value: req.purpose },
    { label: "거 래 처", value: req.vendor },
    ...(req.period ? [{ label: "기    간", value: req.period }] : []),
    ...(req.timing ? [{ label: "시    기", value: req.timing }] : []),
    { label: "금    액", value: amountLine(req.amount, req.currency, req.vat), bold: true },
    { label: "지급계좌", value: req.account },
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
          title={req.title}
          approved={approved}
          approvedOn={approvedOn}
        />

        <p className="gen-intro">아래와 같이 결재를 올리오니 검토 후 재가 바랍니다.</p>
        <p className="gen-center">-&nbsp;&nbsp;아&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;래&nbsp;&nbsp;-</p>
        <ol className="gen-items">
          {items.map((it, i) => (
            <li key={it.label} className={it.bold ? "b" : undefined}>
              <span className="no">{i + 1}.</span>
              <span className="k">{it.label}</span>
              <span className="c">:</span>
              <span className="v">{it.value}</span>
            </li>
          ))}
        </ol>
        {req.extra && <div className="gen-extra">{req.extra}</div>}
        <p className="gen-attach">
          <span className="k">첨&nbsp;&nbsp;&nbsp;&nbsp;부</span> : <span className="v">{req.attachment}</span>
        </p>

        <div className="footer">㈜ 다이버스</div>
      </div>
    </>
  );
}
