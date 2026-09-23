"use client";

import { useEffect } from "react";

export function PrintToolbar({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);
  return (
    <div className="toolbar">
      <button type="button" onClick={() => window.close()}>닫기</button>
      <button type="button" className="primary" onClick={() => window.print()}>인쇄</button>
    </div>
  );
}
