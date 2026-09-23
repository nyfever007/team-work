import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "admin1234";
const name = process.env.ADMIN_NAME ?? "Administrator";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;

const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();

if (existing) {
  console.log(`User "${username}" already exists, skipping.`);
} else {
  db.insert(schema.users).values({ username, email, name, role: "admin", passwordHash: hashPassword(password) }).run();
  console.log(`Created user "${username}".`);
}
