/** Turn legacy free-text daily_logs.plan into daily_tasks rows (once per member/day). Idempotent. */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";

const logs = db.select().from(schema.dailyLogs).all().filter((l) => l.plan.trim());
let converted = 0;
db.transaction((tx) => {
  for (const log of logs) {
    const existing = tx.select({ id: schema.dailyTasks.id }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, log.memberId), eq(schema.dailyTasks.date, log.date))).all();
    if (existing.length) continue;
    const titles = log.plan.split("\n").map((s) => s.replace(/^\s*[-*•·]\s*/, "").trim()).filter(Boolean);
    const doneText = log.done;
    titles.forEach((title, i) => {
      const status = doneText.includes(title) ? "done" : "todo";
      tx.insert(schema.dailyTasks).values({ memberId: log.memberId, date: log.date, title, status, position: i + 1, createdAt: log.planUpdatedAt ?? new Date(), reviewedAt: status === "done" ? log.doneUpdatedAt : null }).run();
    });
    // keep the free text as history but clear plan so pages don't show it twice
    tx.update(schema.dailyLogs).set({ plan: "" }).where(eq(schema.dailyLogs.id, log.id)).run();
    converted++;
  }
});
console.log(`Converted ${converted} daily log(s) into tasks.`);
