import { redirect } from "next/navigation";

/** 이번 달(월간 목표) was removed by request — members only write 주간 보고. Old links land there. */
export default function MonthRedirect() {
  redirect("/my/week");
}
