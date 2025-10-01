import request from "supertest";
import fs from "fs";
import path from "path";
import app from "../server.js";

describe("/sign endpoint", () => {
  const tmpFile = path.join(
    process.cwd(),
    "src",
    "__tests__",
    "fixtures",
    "dummy.bin"
  );
  beforeAll(async () => {
    await fs.promises.mkdir(path.dirname(tmpFile), { recursive: true });
    await fs.promises.writeFile(tmpFile, Buffer.from("hello"));
  });
  afterAll(async () => {
    await fs.promises.unlink(tmpFile).catch(() => {});
  });

  it("rejects without auth", async () => {
    const res = await request(app).post("/sign").attach("file", tmpFile);
    expect(res.status).toBe(401);
  });

  it("rejects missing file field", async () => {
    process.env.AUTH_TOKEN = "testtoken";
    const res = await request(app)
      .post("/sign")
      .set("Authorization", "Bearer testtoken");
    expect(res.status).toBe(400);
  });

  it("signs (dry run) with auth", async () => {
    process.env.DRY_RUN = "1";
    process.env.AUTH_TOKEN = "testtoken";
    const res = await request(app)
      .post("/sign")
      .set("Authorization", "Bearer testtoken")
      .attach("file", tmpFile);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/octet-stream");
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("queues second signing request until first completes", async () => {
    process.env.DRY_RUN = "1";
    process.env.AUTH_TOKEN = "testtoken";
    // Larger file to keep first busy a tiny bit
    const bigFile = path.join(path.dirname(tmpFile), "big.bin");
    await fs.promises.writeFile(bigFile, Buffer.alloc(1_000_000, 2));

    const firstPromise = request(app)
      .post("/sign")
      .set("Authorization", "Bearer testtoken")
      .attach("file", bigFile);

    // Slight delay then enqueue second
    await new Promise((r) => setTimeout(r, 5));

    const secondPromise = request(app)
      .post("/sign")
      .set("Authorization", "Bearer testtoken")
      .attach("file", tmpFile);

    const [firstRes, secondRes] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    await fs.promises.unlink(bigFile).catch(() => {});
  });
});
