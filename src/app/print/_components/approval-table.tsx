import { RETENTIONS, RETENTION_LABEL } from "@/lib/general/types";

type Props = {
  docNo: string;
  writtenAt: string;
  teamName: string;
  position: string;
  memberName: string;
  retention: number;
  title: string;
  /** Once approved, the 1차 작성자 box carries the member's name and the approval date (MM/DD). */
  approved: boolean;
  approvedOn: string | null;
  /** 택시비 품의서 has 대표이사 in the 1차 row; 일반 품의서 leaves that column blank. */
  firstRowCeo?: boolean;
  /** Pre-printed 수신 부서 (택시비: 경영지원실). */
  receiverDept?: string;
};

/**
 * 결재표 shared by the 품의서 templates (일반, 택시비…). Word grid (dxa): 817, 992, 851, 992, 567, 992, 993, 992, 992, 1054.
 * 1차/2차 결재 each span 4 rows; bottom row is 제목. Leave has its own older layout in print/leave-request.
 */
export function ApprovalTable({ docNo, writtenAt, teamName, position, memberName, retention, title, approved, approvedOn, firstRowCeo = false, receiverDept = "" }: Props) {
  const retentionText = RETENTIONS.map((r) => `${r === retention ? "■" : "□"}${RETENTION_LABEL[r]}`).join(" ");
  return (
    <table className="form approval">
      <colgroup>
        {[817, 992, 851, 992, 567, 992, 993, 992, 992, 1054].map((w, i) => (
          <col key={i} style={{ width: `${(w / 9242) * 100}%` }} />
        ))}
      </colgroup>
      <tbody>
        <tr className="tt">
          <td className="lbl nl two">문서<br />번호</td>
          <td className="l big" colSpan={3}>{docNo}</td>
          <td className="nr" colSpan={6}>위임전결규정에 의거 전결</td>
        </tr>
        <tr>
          <td className="lbl nl two">작성<br />일자</td>
          <td className="l big" colSpan={3}>{writtenAt}</td>
          <td className="lbl stack" rowSpan={4}>1차<br /><br />결재</td>
          <td className="lbl">작성자</td>
          <td className="lbl">부서장</td>
          <td className="lbl">담당임원</td>
          <td className="lbl">부사장</td>
          {firstRowCeo ? <td className="lbl nr">대표이사</td> : <td className="nr" rowSpan={4} />}
        </tr>
        <tr>
          <td className="lbl nl two">보관<br />부서</td>
          <td className="l" colSpan={3}>{teamName}</td>
          <td className="tall signed" rowSpan={2}>{approved ? memberName : null}</td>
          <td className="tall" rowSpan={2} />
          <td className="tall" rowSpan={2} />
          <td className="tall" rowSpan={2} />
          {firstRowCeo && <td className="tall nr" rowSpan={2} />}
        </tr>
        <tr>
          <td className="lbl nl two">보존<br />기간</td>
          <td className="l" colSpan={3} style={{ fontSize: "8.5pt", whiteSpace: "nowrap", letterSpacing: "-0.03em" }}>{retentionText}</td>
        </tr>
        <tr>
          <td className="lbl nl" rowSpan={2}>작성자</td>
          <td className="lbl">소속</td>
          <td className="lbl">직위</td>
          <td className="lbl">성명</td>
          <td className="sig">{approvedOn ?? "/"}</td>
          <td className="sig">/</td>
          <td className="sig">/</td>
          <td className="sig">/</td>
          {firstRowCeo && <td className="sig nr">/</td>}
        </tr>
        <tr>
          <td className="big">{teamName}</td>
          <td className="big">{position}</td>
          <td className="big">{memberName}</td>
          <td className="lbl stack" rowSpan={4}>2차<br /><br />결재</td>
          <td className="lbl">부서장</td>
          <td className="lbl">담당이사</td>
          <td className="lbl">관리이사</td>
          <td className="lbl">부사장</td>
          <td className="lbl nr">대표이사</td>
        </tr>
        <tr>
          <td className="lbl nl" rowSpan={2}>수신</td>
          <td className="lbl">부서</td>
          <td className="l" colSpan={2}>{receiverDept}</td>
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
        <tr>
          <td className="lbl nl two">참고<br />사항</td>
          <td className="l" colSpan={3} />
          <td className="sig">/</td>
          <td className="sig">/</td>
          <td className="sig">/</td>
          <td className="sig">/</td>
          <td className="sig nr">/</td>
        </tr>
        <tr className="tb">
          <td className="lbl nl">제목</td>
          <td className="l big nr" colSpan={9}>{title}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Logo centred at the very top (same as the leave form), then the "□ 보고 □ 기안 ■ 품의 □ 업무협조" line. */
export function KindHeader() {
  return (
    <>
      <div className="hdr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/diverse-logo.png" alt="DIVERSE" />
      </div>
      <p className="gen-kind">□ 보&nbsp;&nbsp;고&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;□ 기&nbsp;&nbsp;안&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>■ 품&nbsp;&nbsp;의</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;□ 업무협조</p>
    </>
  );
}
