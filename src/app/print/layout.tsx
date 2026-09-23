import type { Metadata } from "next";
import "./print.css";

export const metadata: Metadata = { title: "인쇄" };

export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return <div className="print-root">{children}</div>;
}
