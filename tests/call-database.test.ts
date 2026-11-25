import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const host = "715f834d-7c31-4f98-9e00-fdf2b12a3f84";
const other = "715f834d-7c31-4f98-9e00-fdf2b12a3f85";
const room = "a".repeat(48),
  room2 = "b".repeat(48);
async function reserve(user = host, id = room) {
  return db.query<{ id: string; expires_at: Date; created_at: Date }>(
    "select * from public.reserve_call($1,$2,'voice','price_plus')",
    [user, id],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609280001_paid_calls.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [host, other]);
}, 20000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL call reservations", () => {
  it("rejects unpaid users and denies browser table/function access", async () => {
    await expect(reserve()).rejects.toThrow(
      "An active subscription is required",
    );
    const result = await db.query<{ tables: boolean; rpc: boolean }>(
      "select has_table_privilege('authenticated','public.subscriptions','INSERT') as tables, has_function_privilege('anon','public.reserve_call(uuid,text,text,text)','EXECUTE') as rpc",
    );
    expect(result.rows[0]).toEqual({ tables: false, rpc: false });
  });
  it("reuses the active reservation and prevents overlapping hosts/rooms", async () => {
    await db.query(
      "insert into public.subscriptions(stripe_subscription_id,user_id,status,price_id,current_period_end,updated_at) values('sub_host',$1,'active','price_plus',now()+interval '1 month',now()),('sub_other',$2,'active','price_plus',now()+interval '1 month',now())",
      [host, other],
    );
    const first = (await reserve()).rows[0];
    expect((await reserve()).rows[0].id).toBe(first.id);
    expect(
      new Date(first.expires_at).getTime() -
        new Date(first.created_at).getTime(),
    ).toBe(30 * 60 * 1000);
    await expect(reserve(other)).rejects.toThrow(
      "A friend is already hosting this room",
    );
    await expect(reserve(host, room2)).rejects.toThrow(
      "You are already hosting a call",
    );
  });
  it("enforces five sessions per UTC month and allows a new month", async () => {
    for (let i = 1; i < 5; i++) {
      await db.exec(
        "update public.call_sessions set expires_at=now()-interval '1 minute'",
      );
      await reserve();
    }
    await db.exec(
      "update public.call_sessions set expires_at=now()-interval '1 minute'",
    );
    await expect(reserve()).rejects.toThrow(
      "This month’s five call sessions have been used",
    );
    await db.exec(
      "update public.call_sessions set created_at=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')-interval '1 second'",
    );
    expect((await reserve()).rows).toHaveLength(1);
  });
  it("denies further access when the subscription expires or is canceled", async () => {
    await db.exec(
      "update public.subscriptions set current_period_end=now()-interval '1 second'",
    );
    await expect(reserve()).rejects.toThrow(
      "An active subscription is required",
    );
    await db.exec(
      "update public.subscriptions set current_period_end=now()+interval '1 month',status='canceled'",
    );
    await expect(reserve()).rejects.toThrow(
      "An active subscription is required",
    );
  });
  it("ignores late entitlement snapshots and never resurrects canceled subscriptions", async () => {
    async function apply(status: string, event: number) {
      await db.query(
        "select public.apply_subscription('sub_events',$1,$2,'price_plus',now()+interval '1 month',$3)",
        [other, status, event],
      );
    }
    await apply("active", 100);
    await apply("past_due", 102);
    await apply("active", 101);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.subscriptions where stripe_subscription_id='sub_events'",
        )
      ).rows[0].status,
    ).toBe("past_due");
    await apply("canceled", 103);
    await apply("active", 103);
    await apply("active", 104);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.subscriptions where stripe_subscription_id='sub_events'",
        )
      ).rows[0].status,
    ).toBe("canceled");
  });
});
