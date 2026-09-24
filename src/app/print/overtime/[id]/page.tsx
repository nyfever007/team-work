import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { memberById } from "@/lib/members/queries";
import { overtimeById } from "@/lib/overtime/queries";
import { overtimeLine } from "@/lib/overtime/types";
import { requestAccess } from "@/lib/requests/queries";
import { PrintToolbar } from "../../leave-request/[id]/toolbar";

/**
 * 시간외(휴일) 근무신청서 — mirrors templates/overtime-request.docx (A4, margins 20/20/15/20mm,
 * title 18pt bold underline, body 굴림 10pt with exact 20pt lines, date/signature lines 12pt).
 * 신청일 and 신청인 are filled automatically; 부서장 carries the approver's name once approved.
 */
export default async function OvertimePrintPage({ params, searchParams }: PageProps<"/print/overtime/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const req = overtimeById(Number(id));
  if (!req) notFound();
  const member = memberById(req.memberId);
  if (!member || !requestAccess(user).canView(member)) notFound();

  const [y, m, d] = req.writtenAt.split("-").map(Number);
  const approved = req.status === "approved";

  return (
    <>
      <PrintToolbar autoPrint={sp.auto === "1"} />
      <div className="sheet ot-sheet">
        {req.status === "cancelled" && <div className="status-stamp">취 소</div>}
        {req.status === "rejected" && <div className="status-stamp">반 려</div>}
        <h1 className="ot-title">시간외(휴일) 근무신청서</h1>

        <p className="ot-h">1. 신 청 인</p>
        <ol className="ot-items">
          <li><span className="n">1)</span><span className="k">부&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;서</span>：<span className="v">{req.teamName}</span></li>
          <li><span className="n">2)</span><span className="k">직&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;위</span>：<span className="v">{req.position}</span></li>
          <li><span className="n">3)</span><span className="k">담당업무</span>：<span className="v">{req.duty}</span></li>
          <li><span className="n">4)</span><span className="k">성&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</span>：<span className="v">{req.memberName}</span></li>
        </ol>

        <p className="ot-h ot-gap">2. 신 청 내 용</p>
        <ol className="ot-items">
          <li><span className="n">1)</span>시간외 근무일자 및 예상 근무 시간 :</li>
          <li className="sub">- {overtimeLine(req.startAt, req.endAt, req.hours)}</li>
          <li><span className="n">2)</span>시간외 근무 신청 사유(자세히 기록)</li>
        </ol>
        <div className="ot-reason">{req.reason}</div>

        <p className="ot-confirm">상기와 같은 내용으로 시간외 근무를 신청합니다.</p>
        <p className="ot-date">
          {y} 년&nbsp;&nbsp;&nbsp;{m} 월&nbsp;&nbsp;&nbsp;{d} 일
        </p>
        <div className="ot-sign">
          <div>
            <span className="role">신 청 인</span>
            <span className="name">{req.memberName}</span>
            <span className="mark">(서명)</span>
          </div>
          <div>
            <span className="role">부 서 장</span>
            <span className="name">{approved ? req.decidedByName : ""}</span>
            <span className="mark">(서명)</span>
          </div>
        </div>

        <ul className="ot-notes">
          <li>시간외(휴일) 근무신청은 사전승인을 원칙으로 합니다.</li>
          <li>평일 초과근무(야근)는 이메일을 통해 사전신청해주시고, 수신은 결재권자, 참조에 경영지원실 담당자(김수경 차장, 이채석 과장)를 넣어주시기 바랍니다.</li>
        </ul>
      </div>
    </>
  );
}
