/** Turn legacy free-text weekly_reports.plan into weekly_items rows (once per member/week). Idempotent. */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";

const reports = db.select().from(schema.weeklyReports).all().filter((r) => r.plan.trim());
let converted = 0;
db.transaction((tx) => {
  for (const r of reports) {
    const existing = tx.select({ id: schema.weeklyItems.id }).from(schema.weeklyItems).where(and(eq(schema.weeklyItems.memberId, r.memberId), eq(schema.weeklyItems.weekStart, r.weekStart))).all();
    if (existing.length) continue;
    const titles = r.plan.split("\n").map((s) => s.replace(/^\s*[-*•·]\s*(\(주간\)\s*)?/, "").trim()).filter(Boolean);
    titles.forEach((title, i) => {
      const done = r.result.includes(title);
      tx.insert(schema.weeklyItems).values({ memberId: r.memberId, weekStart: r.weekStart, title, status: done ? "done" : "todo", position: i + 1, createdAt: r.planUpdatedAt ?? new Date(), doneAt: done ? r.resultUpdatedAt : null }).run();
    });
    tx.update(schema.weeklyReports).set({ plan: "" }).where(eq(schema.weeklyReports.id, r.id)).run();
    converted++;
  }
});
console.log(`Converted ${converted} weekly report(s) into items.`);
