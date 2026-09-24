import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { LEAVE_FORM_LABEL, type LeaveType } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { formatDays } from "@/lib/requests/calc";
import { requestAccess, requestById } from "@/lib/requests/queries";
import { PrintToolbar } from "./toolbar";

/** Boxes in the template's 구분 rows, in order. 반차 covers both half types. */
const ROW1: { label: string; types: LeaveType[] }[] = [
  { label: "연차", types: ["annual"] },
  { label: "반차", types: ["half_am", "half_pm"] },
  { label: "공가", types: ["official"] },
  { label: "청원휴가", types: ["petition"] },
  { label: "보상휴가", types: ["compensatory"] },
];
const ROW2: { label: string; types: LeaveType[] }[] = [
  { label: "병가", types: ["sick"] },
  { label: "조퇴", types: ["early_leave"] },
  { label: "산전·후휴가", types: ["maternity"] },
  { label: "그 외 기타휴가", types: ["other"] },
];

export default async function LeaveRequestPrintPage({ params, searchParams }: PageProps<"/print/leave-request/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const req = requestById(Number(id));
  if (!req) notFound();
  const member = memberById(req.memberId);
  if (!member || !requestAccess(user).canView(member)) notFound();

  const box = (types: LeaveType[]) => (types.includes(req.type) ? "■" : "□");
  const half = req.type === "half_am" ? " (오전)" : req.type === "half_pm" ? " (오후)" : "";
  const period = req.startDate === req.endDate ? req.startDate : `${req.startDate} ~ ${req.endDate}`;
  // Once approved, the 1차 결재 작성자 box carries the member's name and the approval date (MM/DD, KST) below it.
  const approved = req.status === "approved";
  const approvedOn = approved && req.decidedAt ? todayKey(req.decidedAt).slice(5).replace("-", "/") : null;

  return (
    <>
      <PrintToolbar autoPrint={sp.auto === "1"} />
      <div className="sheet">
        {req.status === "cancelled" && <div className="status-stamp">취 소</div>}
        {req.status === "rejected" && <div className="status-stamp">반 려</div>}
        <div className="hdr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/diverse-logo.png" alt="DIVERSE" />
        </div>
        <p className="title-line">■ 휴 가&nbsp;&nbsp;&nbsp;&nbsp;□ 휴 직</p>

        {/* 결재표: 10 grid columns from the template (dxa). No outer left/right borders; thick top/bottom (sz 12 = 1.5pt). */}
        <table className="form approval">
          <colgroup>
            {[817, 992, 851, 992, 567, 992, 993, 992, 992, 1054].map((w, i) => (
              <col key={i} style={{ width: `${(w / 9242) * 100}%` }} />
            ))}
          </colgroup>
          <tbody>
            <tr className="tt">
              <td className="lbl nl two">문서<br />번호</td>
              <td className="l big" colSpan={3} />
              <td className="nr" colSpan={6}>위임전결규정에 의거 전결</td>
            </tr>
            <tr>
              <td className="lbl nl two">작성<br />일자</td>
              <td className="l big" colSpan={3}>{req.writtenAt}</td>
              <td className="lbl stack" rowSpan={3}>1차<br /><br />결재</td>
              <td className="lbl">작성자</td>
              <td className="lbl">부서장</td>
              <td className="lbl">담당임원</td>
              <td className="lbl">부사장</td>
              <td className="lbl nr">대표이사</td>
            </tr>
            <tr>
              <td className="lbl nl two">보관<br />부서</td>
              <td className="l" colSpan={3}>{req.teamName}</td>
              <td className="tall signed" rowSpan={2}>{approved ? req.memberName : null}</td>
              <td className="tall" rowSpan={2} />
              <td className="tall" rowSpan={2} />
              <td className="tall" rowSpan={2} />
              <td className="tall nr" rowSpan={2} />
            </tr>
            <tr>
              <td className="lbl nl two">보존<br />기간</td>
              <td className="l" colSpan={3} style={{ fontSize: "9pt", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>□1년 □2년 ■3년 □5년 □영구</td>
            </tr>
            <tr>
              <td className="lbl nl" rowSpan={2}>작성자</td>
              <td className="lbl">소속</td>
              <td className="lbl">직위</td>
              <td className="lbl">성명</td>
              <td className="lbl" rowSpan={2} />
              <td className="sig">{approvedOn ?? "/"}</td>
              <td className="sig">/</td>
              <td className="sig">/</td>
              <td className="sig">/</td>
              <td className="sig nr">/</td>
            </tr>
            <tr>
              <td className="big">{req.teamName}</td>
              <td className="big">{req.position}</td>
              <td className="big">{req.memberName}</td>
              <td className="lbl">부서장</td>
              <td className="lbl">담당이사</td>
              <td className="lbl">관리이사</td>
              <td className="lbl">부사장</td>
              <td className="lbl nr">대표이사</td>
            </tr>
            <tr>
              <td className="lbl nl" rowSpan={2}>수신</td>
              <td className="lbl">부서</td>
              <td className="l" colSpan={2}>경영지원실</td>
              <td className="lbl stack" rowSpan={2}>2차<br /><br />결재</td>
              <td className="tall" rowSpan={2} />
              <td className="tall" rowSpan={2} />
              <td className="tall" rowSpan={2} />
              <td className="tall" rowSpan={2} />
              <td className="tall nr" rowSpan={2} />
            </tr>
            <tr>
              <td className="lbl">담당</td>
              <td className="l" colSpan={2} />
            </tr>
            <tr className="tb">
              <td className="lbl nl two">참고<br />사항</td>
              <td className="l" colSpan={3} />
              <td className="lbl" />
              <td className="sig">/</td>
              <td className="sig">/</td>
              <td className="sig">/</td>
              <td className="sig">/</td>
              <td className="sig nr">/</td>
            </tr>
          </tbody>
        </table>

        <p className="intro">아래와 같이 결재를 올리오니 검토 후 재가 바랍니다.</p>
        <p className="center">- 아 래 -</p>

        {/* 신청표: 5 grid columns (dxa 1242, 3255, 6, 1419, 3304) */}
        <table className="form">
          <colgroup>
            {[1242, 3255, 6, 1419, 3304].map((w, i) => (
              <col key={i} style={{ width: `${(w / 9226) * 100}%` }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <td className="lbl big tall" rowSpan={2}>구&nbsp;&nbsp;&nbsp;&nbsp;분</td>
              <td className="opts tall" colSpan={4}>
                {ROW1.map((o) => (
                  <span key={o.label} className={`box ${o.types.includes(req.type) ? "on" : ""}`}>{box(o.types)}{o.label}{o.label === "반차" && o.types.includes(req.type) ? half : ""}</span>
                ))}
              </td>
            </tr>
            <tr>
              <td className="opts tall" colSpan={4}>
                {ROW2.map((o) => (
                  <span key={o.label} className={`box ${o.types.includes(req.type) ? "on" : ""}`}>{box(o.types)}{o.label}</span>
                ))}
              </td>
            </tr>
            <tr>
              <td className="lbl big tall">신청일자</td>
              <td className="big tall" colSpan={4}>{period}{req.type === "early_leave" && " (조퇴)"}</td>
            </tr>
            <tr>
              <td className="lbl big tall">신청일수</td>
              <td className="big tall" colSpan={2}>{formatDays(req.days)} 일</td>
              <td className="lbl big tall">잔여일수</td>
              <td className="big tall">{formatDays(req.remainingDays)} 일 ( {formatDays(req.usedDays)} 일 / {formatDays(req.totalDays)} 일 )</td>
            </tr>
            <tr>
              <td className="lbl big tall">업무대행</td>
              <td className="big tall">{req.delegate}</td>
              <td className="lbl big tall" colSpan={2}>연 락 처</td>
              <td className="big tall">{req.contact}</td>
            </tr>
            <tr>
              <td className="lbl big tall">사&nbsp;&nbsp;&nbsp;&nbsp;유</td>
              <td className="reason big tall" colSpan={4}>{req.reason || `${LEAVE_FORM_LABEL[req.type]} 사용`}</td>
            </tr>
          </tbody>
        </table>

        <div className="notes">
          <div className="note"><span className="mk">※</span><span>휴가는 구분항목에서 해당되는 부문에 체크하고, 휴직은 상단에 체크합니다.</span></div>
          <div className="note"><span className="mk">※</span><span>사유는 상세히 기재를 부탁 드립니다. (연차/반차 제외)</span></div>
          <div className="note"><span className="mk">※</span><span>잔여일수 작성요령 : 잔여일수 (본 신청일수 포함한 사용일수 / 총 휴가일수)</span></div>
          <div className="note"><span className="mk">※</span><span>증빙서류</span></div>
          <div className="note sub"><span className="mk">■</span><span>공가 : 훈련소집통지서 및 참석증(공가사유로 인한 조퇴에도 해당)</span></div>
          <div className="note sub"><span className="mk">■</span><span>병가 : 병원 영수증(병가사유로 인한 조퇴에도 해당)</span></div>
          <div className="note sub red"><span className="mk" /><span>(치과치료, 피부질환치료, 성형치료, 의료검진 등 개인적인 사유는 병가 사용 불가)</span></div>
          <div className="note sub"><span className="mk">■</span><span>청원휴가 : 경사인 경우 그에 따른 증빙서류(ex. 청첩장, 출산증명서 등)</span></div>
          <div className="note sub"><span className="mk">■</span><span>보상휴가 : 사전 품의 필요</span></div>
        </div>

        <div className="footer">㈜ 다이버스</div>
      </div>
    </>
  );
}
