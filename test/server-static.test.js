const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
let serverProcess;
let baseUrl;

before(async () => {
  const portReservation = net.createServer();
  await new Promise((resolve, reject) => {
    portReservation.once("error", reject);
    portReservation.listen(0, "127.0.0.1", resolve);
  });
  const { port } = portReservation.address();
  await new Promise((resolve, reject) => {
    portReservation.close((error) => (error ? reject(error) : resolve()));
  });

  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "" },
    stdio: "ignore",
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Express server exited with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Express server did not become ready within 10 seconds");
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await new Promise((resolve) => serverProcess.once("exit", resolve));
  }
});

test("serves the homepage with its stylesheet reference", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html\b/);
  assert.match(html, /href="styles\.css"/);
});

test("serves root and nested frontend assets with the correct MIME types", async () => {
  for (const [assetPath, contentType] of [
    ["/styles.css", /^text\/css\b/],
    ["/catalog.js", /^application\/javascript\b/],
    ["/app.js", /^application\/javascript\b/],
    ["/js/core.js", /^application\/javascript\b/],
  ]) {
    const response = await fetch(new URL(assetPath, baseUrl));
    const body = await response.text();

    assert.equal(response.status, 200, assetPath);
    assert.match(response.headers.get("content-type"), contentType, assetPath);
    assert.ok(body.length > 0, assetPath);
  }
});

test("does not expose server files or the local database", async () => {
  for (const privatePath of ["/server.js", "/package.json", "/db.json"]) {
    const response = await fetch(new URL(privatePath, baseUrl));
    assert.equal(response.status, 404, privatePath);
  }
});
