import { expect, test } from "@playwright/test";

function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("the web app is installable and keeps its shell available offline", async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/app",
    name: "ClickClack",
    short_name: "ClickClack",
    start_url: "/app",
    scope: "/",
    display: "standalone",
  });

  for (const [path, size] of [
    ["/icons/clickclack-192.png", 192],
    ["/icons/clickclack-512.png", 512],
    ["/icons/clickclack-maskable-512.png", 512],
  ] as const) {
    const iconResponse = await request.get(path);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toBe("image/png");
    expect(pngSize(await iconResponse.body())).toEqual({ width: size, height: size });
  }

  await page.goto("/app");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /\/icons\/clickclack-192\.png$/,
  );

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return { scope: ready.scope, scriptURL: ready.active?.scriptURL };
  });
  expect(registration.scope).toBe(new URL("/", page.url()).href);
  expect(registration.scriptURL).toContain("/service-worker.js");

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await page.context().setOffline(true);
  await page.goto(`/app?offline-proof=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("ClickClack");
});
