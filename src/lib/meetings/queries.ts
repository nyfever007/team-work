import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export function meetingNoteFor(teamId: number, weekStart: string) {
  return db.select().from(schema.meetingNotes).where(and(eq(schema.meetingNotes.teamId, teamId), eq(schema.meetingNotes.weekStart, weekStart))).get();
}
