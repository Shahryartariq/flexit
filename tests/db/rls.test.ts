import { afterAll, describe, expect, it } from "vitest";
import { actAs, closePool, createUser, inTransaction, rowCount, tryQuery, type Db } from "./helpers";

afterAll(closePool);

async function newPost(db: Db, title = "Shipped my first app") {
  const { rows } = await db.query(
    "insert into public.posts (skill_slug, title, body) values ('development', $1, 'It works!') returning id",
    [title],
  );
  return rows[0].id as string;
}

describe("sign-up trigger", () => {
  it("creates a profile with the chosen username and display name", () =>
    inTransaction(async (db) => {
      const id = await createUser(db, { username: "Sherry_dev", display_name: "Sherry" });
      const { rows } = await db.query("select username, display_name from public.profiles where id = $1", [id]);
      expect(rows[0]).toEqual({ username: "sherry_dev", display_name: "Sherry" });
    }));

  it("still creates a profile when the username is taken or missing", () =>
    inTransaction(async (db) => {
      await createUser(db, { username: "maker" });
      const second = await createUser(db, { username: "maker" }, "maker@example.com");
      const oauth = await createUser(db, { user_name: "Octo-Cat", full_name: "Octo Cat" });
      const { rows } = await db.query(
        "select id, username, display_name from public.profiles where id in ($1, $2)",
        [second, oauth],
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[second].username).toMatch(/^maker_[0-9a-f]{5}$/);
      expect(byId[oauth].username).toMatch(/^octocat_[0-9a-f]{5}$/);
      expect(byId[oauth].display_name).toBe("Octo Cat");
    }));
});

describe("reading", () => {
  it("lets anyone read skills, profiles and posts", () =>
    inTransaction(async (db) => {
      const author = await createUser(db, { username: "author" });
      await actAs(db, author);
      await newPost(db);
      await actAs(db, null);
      expect(await rowCount(db, "select 1 from public.skills")).toBe(12);
      expect(await rowCount(db, "select 1 from public.profiles where username = 'author'")).toBe(1);
      expect(await rowCount(db, "select 1 from public.posts where author_id = $1", [author])).toBe(1);
    }));

  it("does not let anonymous visitors write", () =>
    inTransaction(async (db) => {
      await actAs(db, null);
      const error = await tryQuery(
        db,
        "insert into public.posts (skill_slug, title) values ('art', 'Sneaky post')",
      );
      expect(error).toMatch(/permission denied/);
    }));
});

describe("posts", () => {
  it("are always written as the signed-in user", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      const other = await createUser(db);
      await actAs(db, me);
      const id = await newPost(db);
      const { rows } = await db.query("select author_id from public.posts where id = $1", [id]);
      expect(rows[0].author_id).toBe(me);

      const spoof = await tryQuery(
        db,
        "insert into public.posts (author_id, skill_slug, title) values ($1, 'art', 'Not mine')",
        [other],
      );
      expect(spoof).toMatch(/permission denied/);
    }));

  it("cannot have their counters set by clients", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      await actAs(db, me);
      const forged = await tryQuery(
        db,
        "insert into public.posts (skill_slug, title, like_count) values ('art', 'Fake fame', 9999)",
      );
      expect(forged).toMatch(/permission denied/);
      const id = await newPost(db);
      expect(await tryQuery(db, "update public.posts set like_count = 50 where id = $1", [id])).toMatch(
        /permission denied/,
      );
    }));

  it("can only be edited and deleted by their author", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const stranger = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);

      await actAs(db, stranger);
      expect(await rowCount(db, "update public.posts set title = 'Hijacked' where id = $1", [id])).toBe(0);
      expect(await rowCount(db, "delete from public.posts where id = $1", [id])).toBe(0);

      await actAs(db, author);
      expect(await rowCount(db, "update public.posts set title = 'Shipped v2' where id = $1", [id])).toBe(1);
      expect(await rowCount(db, "delete from public.posts where id = $1", [id])).toBe(1);
    }));

  it("only accept images from the author's own folder", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      const other = await createUser(db);
      await actAs(db, me);
      const ok = await tryQuery(
        db,
        "insert into public.posts (skill_slug, title, image_path) values ('art', 'My painting', $1)",
        [`${me}/abc123def.webp`],
      );
      expect(ok).toBeNull();
      const stolen = await tryQuery(
        db,
        "insert into public.posts (skill_slug, title, image_path) values ('art', 'Their painting', $1)",
        [`${other}/abc123def.webp`],
      );
      expect(stolen).toMatch(/check constraint/);
    }));

  it("reject bad links and too-short titles", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      await actAs(db, me);
      expect(
        await tryQuery(db, "insert into public.posts (skill_slug, title, link) values ('art', 'Link test', 'javascript:alert(1)')"),
      ).toMatch(/check constraint/);
      expect(await tryQuery(db, "insert into public.posts (skill_slug, title) values ('art', 'Hi')")).toMatch(
        /check constraint/,
      );
    }));

  it("are limited to 10 an hour per person", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      await actAs(db, me);
      for (let i = 0; i < 10; i += 1) await newPost(db, `Win number ${i + 1}`);
      expect(await tryQuery(db, "insert into public.posts (skill_slug, title) values ('art', 'One too many')")).toMatch(
        /10 flexes an hour/,
      );
    }));
});

describe("likes and comments", () => {
  it("keep the post counters in sync", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);

      await actAs(db, fan);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);
      await db.query("insert into public.comments (post_id, body) values ($1, 'Congrats!')", [id]);
      let { rows } = await db.query("select like_count, comment_count from public.posts where id = $1", [id]);
      expect(rows[0]).toEqual({ like_count: 1, comment_count: 1 });

      await db.query("delete from public.likes where post_id = $1", [id]);
      ({ rows } = await db.query("select like_count, comment_count from public.posts where id = $1", [id]));
      expect(rows[0]).toEqual({ like_count: 0, comment_count: 1 });
    }));

  it("can only be removed by their owner, and post authors can remove comments", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      const troll = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);

      await actAs(db, fan);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);
      await actAs(db, troll);
      await db.query("insert into public.comments (post_id, body) values ($1, 'Mean comment')", [id]);
      expect(await rowCount(db, "delete from public.likes where post_id = $1", [id])).toBe(0);

      await actAs(db, author);
      expect(await rowCount(db, "delete from public.comments where post_id = $1", [id])).toBe(1);
    }));

  it("cannot be made in someone else's name", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);
      await actAs(db, fan);
      expect(
        await tryQuery(db, "insert into public.likes (post_id, user_id) values ($1, $2)", [id, author]),
      ).toMatch(/permission denied/);
      expect(
        await tryQuery(db, "insert into public.comments (post_id, author_id, body) values ($1, $2, 'hi')", [id, author]),
      ).toMatch(/permission denied/);
    }));
});

describe("follows", () => {
  it("are made as yourself, never to yourself", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      const them = await createUser(db);
      await actAs(db, me);
      expect(await tryQuery(db, "insert into public.follows (following_id) values ($1)", [them])).toBeNull();
      expect(await tryQuery(db, "insert into public.follows (following_id) values ($1)", [me])).toMatch(
        /check constraint/,
      );
      await actAs(db, them);
      expect(await rowCount(db, "delete from public.follows where follower_id = $1", [me])).toBe(0);
    }));
});

describe("profiles", () => {
  it("can only be edited by their owner, and usernames stay fixed", () =>
    inTransaction(async (db) => {
      const me = await createUser(db, { username: "owner_one" });
      const other = await createUser(db);
      await actAs(db, other);
      expect(await rowCount(db, "update public.profiles set headline = 'pwned' where id = $1", [me])).toBe(0);
      await actAs(db, me);
      expect(
        await rowCount(db, "update public.profiles set headline = 'Full-stack developer' where id = $1", [me]),
      ).toBe(1);
      expect(await tryQuery(db, "update public.profiles set username = 'new_name' where id = $1", [me])).toMatch(
        /permission denied/,
      );
    }));
});

describe("storage", () => {
  it("lets people upload only into their own folder", () =>
    inTransaction(async (db) => {
      const me = await createUser(db);
      const other = await createUser(db);
      await actAs(db, me);
      expect(
        await tryQuery(db, "insert into storage.objects (bucket_id, name) values ('post-images', $1)", [
          `${me}/photo123.webp`,
        ]),
      ).toBeNull();
      expect(
        await tryQuery(db, "insert into storage.objects (bucket_id, name) values ('post-images', $1)", [
          `${other}/photo123.webp`,
        ]),
      ).toMatch(/row-level security/);
    }));
});

describe("deleting an account", () => {
  it("removes the person and everything they posted, and nobody else's", () =>
    inTransaction(async (db) => {
      const leaver = await createUser(db, { username: "leaver" });
      const stayer = await createUser(db, { username: "stayer" });
      await actAs(db, stayer);
      const kept = await newPost(db, "Still here");
      await actAs(db, leaver);
      await newPost(db, "Goodbye post");
      await db.query("insert into public.likes (post_id) values ($1)", [kept]);
      await db.query("insert into public.follows (following_id) values ($1)", [stayer]);

      await db.query("select public.delete_my_account()");

      await actAs(db, null);
      expect(await rowCount(db, "select 1 from public.profiles where id = $1", [leaver])).toBe(0);
      expect(await rowCount(db, "select 1 from public.posts where author_id = $1", [leaver])).toBe(0);
      expect(await rowCount(db, "select 1 from public.follows where follower_id = $1", [leaver])).toBe(0);
      const { rows } = await db.query("select like_count from public.posts where id = $1", [kept]);
      expect(rows[0].like_count).toBe(0);
    }));

  it("can't be called by anonymous visitors", () =>
    inTransaction(async (db) => {
      await actAs(db, null);
      expect(await tryQuery(db, "select public.delete_my_account()")).toMatch(/permission denied/);
    }));
});

describe("notifications", () => {
  it("tell authors about likes, comments and follows, once, and never about themselves", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);

      await actAs(db, fan);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);
      await db.query("delete from public.likes where post_id = $1", [id]);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);
      await db.query("insert into public.comments (post_id, body) values ($1, 'Nice!')", [id]);
      await db.query("insert into public.follows (following_id) values ($1)", [author]);

      await actAs(db, author);
      const { rows } = await db.query(
        "select kind, actor_id from public.notifications order by kind",
      );
      expect(rows).toEqual([
        { kind: "comment", actor_id: fan },
        { kind: "follow", actor_id: fan },
        { kind: "like", actor_id: fan },
      ]);
    }));

  it("are private to the person they're for", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      const snoop = await createUser(db);
      await actAs(db, fan);
      await db.query("insert into public.follows (following_id) values ($1)", [author]);

      await actAs(db, snoop);
      expect(await rowCount(db, "select 1 from public.notifications")).toBe(0);
      expect(await rowCount(db, "update public.notifications set read_at = now()")).toBe(0);
      await actAs(db, null);
      expect(await tryQuery(db, "select 1 from public.notifications")).toMatch(/permission denied/);

      await actAs(db, author);
      expect(await rowCount(db, "update public.notifications set read_at = now()")).toBe(1);
      expect(await tryQuery(db, "update public.notifications set kind = 'like'")).toMatch(/permission denied/);
      expect(
        await tryQuery(db, "insert into public.notifications (recipient_id, actor_id, kind) values ($1, $1, 'follow')", [author]),
      ).toMatch(/permission denied/);
    }));
});

describe("reports", () => {
  it("hide a flex after three people report it, except from its author", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const reporters = [await createUser(db), await createUser(db), await createUser(db)];
      await actAs(db, author);
      const id = await newPost(db);
      expect(await tryQuery(db, "insert into public.reports (post_id, reason) values ($1, 'spam')", [id])).toMatch(
        /row-level security/,
      );

      for (const [i, reporter] of reporters.entries()) {
        await actAs(db, reporter);
        await db.query("insert into public.reports (post_id, reason) values ($1, 'spam')", [id]);
        const visible = await rowCount(db, "select 1 from public.posts where id = $1", [id]);
        expect(visible).toBe(i < 2 ? 1 : 0);
      }
      await actAs(db, null);
      expect(await rowCount(db, "select 1 from public.posts where id = $1", [id])).toBe(0);
      await actAs(db, author);
      expect(await rowCount(db, "select 1 from public.posts where id = $1 and hidden", [id])).toBe(1);
    }));

  it("can't be repeated or read by others", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const reporter = await createUser(db);
      const other = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);
      await actAs(db, reporter);
      await db.query("insert into public.reports (post_id, reason) values ($1, 'offensive')", [id]);
      expect(await tryQuery(db, "insert into public.reports (post_id, reason) values ($1, 'spam')", [id])).toMatch(
        /duplicate key/,
      );
      await actAs(db, other);
      expect(await rowCount(db, "select 1 from public.reports")).toBe(0);
    }));
});

describe("editing a flex", () => {
  it("stamps edited_at only when the content changes", () =>
    inTransaction(async (db) => {
      const author = await createUser(db);
      const fan = await createUser(db);
      await actAs(db, author);
      const id = await newPost(db);
      await actAs(db, fan);
      await db.query("insert into public.likes (post_id) values ($1)", [id]);
      let { rows } = await db.query("select edited_at from public.posts where id = $1", [id]);
      expect(rows[0].edited_at).toBeNull();

      await actAs(db, author);
      await db.query("update public.posts set body = 'Now with more detail' where id = $1", [id]);
      ({ rows } = await db.query("select edited_at from public.posts where id = $1", [id]));
      expect(rows[0].edited_at).not.toBeNull();
      expect(await tryQuery(db, "update public.posts set hidden = false where id = $1", [id])).toMatch(
        /permission denied/,
      );
    }));
});
