import { randomUUID } from "node:crypto";

/** Users created by `prisma/seed.ts`; the seed is re-run before every test run. */
export const USERS = {
  primary: {
    username: "leapsome",
    password: "!password123",
  },
  receiver: {
    username: "jane",
  },
} as const;

/** Builds feedback content with a unique title so parallel tests never collide on the shared database. */
export function buildFeedback(prefix: string) {
  const id = randomUUID().slice(0, 8);

  return {
    title: `${prefix} ${id}`,
    body: `Constructive feedback created by the ${prefix.toLowerCase()} scenario (${id}).`,
    receiver: USERS.receiver.username,
  };
}
