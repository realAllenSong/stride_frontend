import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { demoWorkspace } from "../../src/data/demo";

let server: ChildProcess;
let directory: string;
let token: string;
const base = "http://127.0.0.1:3127";
const auth = () => ({ Authorization: `Bearer ${token}` });
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "stride-gateway-test-"));
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  await writeFile(join(directory, "public.pem"), await exportSPKI(publicKey));
  await writeFile(
    join(directory, "policy.json"),
    JSON.stringify({
      principals: [
        {
          subject: "test-user",
          personId: "zhiyuan",
          groupIds: [],
          projectIds: ["praetorian"],
        },
      ],
    }),
  );
  await writeFile(
    join(directory, "workspace.json"),
    JSON.stringify(demoWorkspace),
  );
  token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("test-user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .setIssuer("https://test-gateway.example")
    .setAudience("stride")
    .sign(privateKey);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3127",
    ],
    {
      env: {
        ...process.env,
        STRIDE_AUTH_MODE: "gateway",
        STRIDE_JWT_PUBLIC_KEY_FILE: join(directory, "public.pem"),
        STRIDE_JWT_ISSUER: "https://test-gateway.example",
        STRIDE_JWT_AUDIENCE: "stride",
        STRIDE_ACCESS_POLICY_FILE: join(directory, "policy.json"),
        STRIDE_WORKSPACE_FILE: join(directory, "workspace.json"),
      },
      stdio: "ignore",
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Test server failed to start");
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Test server readiness timed out");
}, 20000);
afterAll(async () => {
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      server.kill("SIGTERM");
    });
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});
it("blocks unauthenticated page and API, including RSC fetches", async () => {
  expect((await fetch(`${base}/api/brief`)).status).toBe(401);
  const html = await (await fetch(base)).text();
  expect(html).toContain("Sign in through your company gateway");
  expect(html).not.toContain("retry-sep9");
  const rsc = await (await fetch(base, { headers: { RSC: "1" } })).text();
  expect(rsc).not.toContain("run-184");
  expect(
    (
      await fetch(`${base}/api/brief`, {
        headers: { Authorization: "Bearer fabricated" },
      })
    ).status,
  ).toBe(401);
});
it("uses server grants for API and server-rendered pages", async () => {
  const res = await fetch(`${base}/api/brief`, { headers: auth() });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.workspace.projects.map((p: { id: string }) => p.id)).toEqual([
    "praetorian",
  ]);
  expect(body.session.mode).toBe("gateway");
  expect(res.headers.get("cache-control")).toContain("no-store");
  const html = await (await fetch(base, { headers: auth() })).text();
  expect(html).toContain("Praetorian");
  expect(html).not.toContain("maya-note");
  for (const query of [
    "id=research",
    "view=people&id=priya",
    "scope=risk",
    "scenario=conflict",
  ]) {
    expect(
      (await fetch(`${base}/api/brief?${query}`, { headers: auth() })).status,
    ).toBe(403);
  }
  const forbidden = await (
    await fetch(`${base}/?id=research`, { headers: auth() })
  ).text();
  expect(forbidden).toContain("This view is not shared with you");
  expect(forbidden).not.toContain("maya-note");
});
it("cannot impersonate a colleague through view=self", async () => {
  const result = await (
    await fetch(`${base}/api/brief?view=self&id=elena`, { headers: auth() })
  ).json();
  expect(result.query.id).toBe("zhiyuan");
  expect(
    result.suggestions.every(
      (s: { personId: string }) => s.personId === "zhiyuan",
    ),
  ).toBe(true);
});
it("refreshes valid snapshots, rejects malformed data and recovers without a restart", async () => {
  const path = join(directory, "workspace.json");
  await writeFile(
    path,
    JSON.stringify({ ...demoWorkspace, rawSessions: ["private"] }),
  );
  expect((await fetch(`${base}/api/brief`, { headers: auth() })).status).toBe(
    503,
  );
  const copy = structuredClone(demoWorkspace);
  copy.projects[0].purpose = "An updated, approved project purpose.";
  await writeFile(path, JSON.stringify(copy));
  const result = await (
    await fetch(`${base}/api/brief`, { headers: auth() })
  ).json();
  expect(result.workspace.projects[0].purpose).toBe(
    "An updated, approved project purpose.",
  );
});
it("serves production security headers with a unique nonce per request", async () => {
  const a = await fetch(base, { headers: auth() });
  const b = await fetch(base, { headers: auth() });
  const csp = a.headers.get("content-security-policy")!;
  expect(csp).toContain("strict-dynamic");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).not.toBe(b.headers.get("content-security-policy"));
  expect(a.headers.get("x-frame-options")).toBe("DENY");
  expect(a.headers.get("x-powered-by")).toBeNull();
});
