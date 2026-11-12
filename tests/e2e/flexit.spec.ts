import { expect, test, type Browser, type Page } from "@playwright/test";

const stamp = Date.now().toString(36).slice(-6);
const PASSWORD = "flexit-test-pass";

async function signUp(page: Page, name: string, username: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Username").fill(username);
  await expect(page.getByText("Nice, it's yours.")).toBeVisible();
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/new$/);
}

async function newContext(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function postFlex(page: Page, { skill, title, story, photo }: { skill: string; title: string; story?: string; photo?: boolean }) {
  await page.goto("/new");
  await page.locator("label", { hasText: skill }).click();
  await page.getByLabel("What did you make, learn or achieve?").fill(title);
  if (story) await page.getByLabel(/The story/).fill(story);
  if (photo) {
    await page.getByTestId("photo-input").setInputFiles("tests/e2e/fixtures/photo.png");
    await expect(page.getByAltText("Your photo")).toBeVisible();
  }
  await page.getByRole("button", { name: "Flex it" }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url();
}

test.describe.configure({ mode: "serial" });

const maker = { name: "Sara Maker", username: `sara_${stamp}` };
const fan = { name: "Ali Fan", username: `ali_${stamp}` };

test("home page explains the idea and lists every skill", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Made something?");
  const skills = page.getByRole("navigation", { name: "Skills" });
  await expect(skills.getByRole("link")).toHaveCount(13);
  await skills.getByRole("link", { name: /Music/ }).click();
  await expect(page).toHaveURL(/\/s\/music$/);
  await expect(page.getByRole("heading", { level: 1, name: "Music" })).toBeVisible();
});

test("sign-up flags taken usernames", async ({ browser }) => {
  const { context, page } = await newContext(browser);
  await signUp(page, maker.name, maker.username);
  await context.close();

  const other = await newContext(browser);
  await other.page.goto("/sign-up");
  await other.page.getByLabel("Username").fill(maker.username);
  await expect(other.page.getByText("Taken. Try another.")).toBeVisible();
  await other.context.close();
});

test("a maker posts a flex with a photo and it shows up everywhere", async ({ browser }) => {
  const { context, page } = await newContext(browser);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`${maker.username}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Flex it" })).toBeVisible();

  const url = await postFlex(page, {
    skill: "Development",
    title: `Shipped my first app ${stamp}`,
    story: "Took three weekends.\nWorth it.",
    photo: true,
  });

  const image = page.getByRole("img", { name: `Shipped my first app ${stamp}` });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("article").getByText(/Took three weekends\./)).toBeVisible();

  // On the home feed, the skill page and the profile.
  for (const path of ["/", "/s/development", `/u/${maker.username}`]) {
    await page.goto(path);
    await expect(page.getByTestId("feed").getByText(`Shipped my first app ${stamp}`)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Development\s*·\s*1/ })).toBeVisible();
  expect(url).toContain("/p/");
  await context.close();
});

test("new flexes, likes and comments arrive live", async ({ browser }) => {
  const viewer = await newContext(browser);
  await signUp(viewer.page, fan.name, fan.username);
  await viewer.page.goto("/s/music");
  await expect(viewer.page.getByText("No music flexes yet.")).toBeVisible();

  const author = await newContext(browser);
  await author.page.goto("/sign-in");
  await author.page.getByLabel("Email").fill(`${maker.username}@example.com`);
  await author.page.getByLabel("Password").fill(PASSWORD);
  await author.page.getByRole("button", { name: "Sign in" }).click();
  await expect(author.page.getByRole("link", { name: "Flex it" })).toBeVisible();
  const postUrl = await postFlex(author.page, { skill: "Music", title: `First song on guitar ${stamp}` });

  // The viewer's music page offers the new flex without a reload.
  await viewer.page.getByRole("button", { name: "↑ 1 new flex" }).click();
  const card = viewer.page.getByTestId("post-card").filter({ hasText: `First song on guitar ${stamp}` });
  await expect(card).toBeVisible();

  // The viewer likes it; the author's open page counts it live.
  await card.getByRole("button", { name: "Like" }).click();
  await expect(card.getByRole("button", { name: "Unlike" })).toContainText("1");
  await expect(author.page.getByRole("button", { name: "Like" })).toContainText("1");

  // The viewer comments; it appears on the author's page live.
  await viewer.page.goto(postUrl);
  await viewer.page.getByLabel("Add a comment").fill("This is great!");
  await viewer.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(author.page.getByTestId("comments").getByText("This is great!")).toBeVisible();

  // Only the author can delete the flex; the viewer can delete their own comment.
  await expect(viewer.page.getByRole("button", { name: "Delete this flex" })).toHaveCount(0);
  await expect(viewer.page.getByRole("button", { name: "Delete comment" })).toHaveCount(1);

  await viewer.context.close();
  await author.context.close();
});

test("following someone fills the Following tab", async ({ browser }) => {
  const { context, page } = await newContext(browser);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`${fan.username}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Flex it" })).toBeVisible();

  await page.goto(`/u/${maker.username}`);
  await expect(page.getByTestId("follower-count")).toHaveText("0");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
  await expect(page.getByTestId("follower-count")).toHaveText("1");

  await page.goto("/");
  await page.getByRole("tab", { name: "Following" }).click();
  await expect(page.getByTestId("feed").getByText(`Shipped my first app ${stamp}`)).toBeVisible();
  await context.close();
});

test("profiles can be edited and flexes deleted by their owner", async ({ browser }) => {
  const { context, page } = await newContext(browser);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`${maker.username}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Flex it" })).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel(/Headline/).fill("Full-stack developer and weekend guitarist");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto(`/u/${maker.username}`);
  await expect(page.getByText("Full-stack developer and weekend guitarist")).toBeVisible();

  await page.getByTestId("feed").getByRole("link", { name: `First song on guitar ${stamp}` }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete this flex" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${maker.username}$`));
  await expect(page.getByTestId("feed").getByText(`First song on guitar ${stamp}`)).toHaveCount(0);
  await context.close();
});

test("signed-out visitors are sent to sign in before acting", async ({ page }) => {
  await page.goto("/new");
  await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)new$/);
  await page.goto("/");
  await page.getByTestId("post-card").first().getByRole("button", { name: "Like" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("unknown flexes and people show a 404 page", async ({ page }) => {
  await page.goto("/p/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Nothing to flex here")).toBeVisible();
  await page.goto("/u/nobody_here_123");
  await expect(page.getByText("Nothing to flex here")).toBeVisible();
});
