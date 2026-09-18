import { describe, it, expect } from "vitest";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";
import { demoWorkspace } from "@/data/demo";
import { authorizeWorkspace, verifyIdentity, PolicySchema } from "@/lib/access";
import { WorkspaceSchema, QuerySchema } from "@/lib/contracts";
import {
  buildDashboard,
  validateReferences,
  normalizeQuery,
} from "@/lib/briefs";
import { bounds, shiftPeriod } from "@/lib/dates";

describe("Snapshot integrity", () => {
  it("validates the complete example, not just individual briefs", () => {
    expect(WorkspaceSchema.safeParse(demoWorkspace).success).toBe(true);
    expect(validateReferences(demoWorkspace)).toEqual([]);
  });
  it("rejects arbitrary private fields nested in evidence", () => {
    const copy = structuredClone(demoWorkspace);
    Object.assign(copy.evidence[0], {
      rawPrompt: "must never reach a browser",
    });
    expect(WorkspaceSchema.safeParse(copy).success).toBe(false);
  });
  it("rejects unknown managers, reporting cycles and criterion references", () => {
    const copy = structuredClone(demoWorkspace);
    copy.people[0].reportsTo = "unknown";
    copy.evidence[0].criteria = { invented: "met" };
    expect(validateReferences(copy)).toContain("Unknown manager: unknown");
    expect(validateReferences(copy)).toContain(
      `Unknown evidence criterion: ${copy.evidence[0].id}`,
    );
    copy.people[0].reportsTo = copy.people[0].id;
    expect(validateReferences(copy)).toContain(
      `Reporting cycle: ${copy.people[0].id}`,
    );
  });
  it("invalidates a parent narrative when a child is corrected without changing IDs", () => {
    const query = QuerySchema.parse({ id: "praetorian", period: "monthly" });
    expect(buildDashboard(demoWorkspace, query).copy).toBeDefined();
    const copy = structuredClone(demoWorkspace);
    copy.evidence.find((e) => e.id === "run-184")!.summary =
      "Corrected test result";
    expect(buildDashboard(copy, query).copy).toBeUndefined();
  });
  it("bounds calendar navigation at both ends without resetting to the demo date", () => {
    for (const period of ["daily", "weekly", "monthly", "yearly"] as const) {
      expect(shiftPeriod("2000-01-01", period, -1)).toBe("2000-01-01");
      expect(shiftPeriod("2100-12-31", period, 1)).toBe("2100-12-31");
      expect(bounds("2000-01-01", period).start).toBe("2000-01-01");
      expect(bounds("2100-12-31", period).end).toBe("2100-12-31");
    }
  });
  it("uses the repository snapshot and authenticated self identity", () => {
    expect(
      normalizeQuery(
        { view: "self", id: "elena" },
        { ...demoWorkspace, asOf: "2027-02-03" },
        "maya",
      ),
    ).toMatchObject({ id: "maya", date: "2027-02-03" });
  });
});
describe("Authorization projection", () => {
  const grant = {
    subject: "test-user",
    personId: "zhiyuan",
    groupIds: [],
    projectIds: ["praetorian"],
  };
  it("removes ungranted projects, evidence, notes, people and generated copy before serialization", () => {
    const scoped = authorizeWorkspace(demoWorkspace, grant);
    expect(scoped.projects.map((p) => p.id)).toEqual(["praetorian"]);
    expect(scoped.evidence.every((e) => e.projectId === "praetorian")).toBe(
      true,
    );
    expect(scoped.people.some((p) => p.id === "priya")).toBe(false);
    expect(JSON.stringify(scoped)).not.toContain(
      "Compared two indexing approaches",
    );
  });
  it("never gives a manager a colleague's suggestions", () => {
    const scoped = authorizeWorkspace(demoWorkspace, {
      ...grant,
      personId: "elena",
      groupIds: ["infra", "quant", "risk"],
    });
    expect(scoped.suggestions).toEqual([]);
    expect(
      buildDashboard(scoped, normalizeQuery({ view: "self" }, scoped, "elena"))
        .suggestions,
    ).toEqual([]);
  });
  it("defaults to no project access and rejects bad or ambiguous grants", () => {
    expect(
      authorizeWorkspace(demoWorkspace, { ...grant, projectIds: [] }).projects,
    ).toEqual([]);
    expect(() =>
      authorizeWorkspace(demoWorkspace, { ...grant, groupIds: ["no-group"] }),
    ).toThrow();
    expect(PolicySchema.safeParse({ principals: [grant, grant] }).success).toBe(
      false,
    );
  });
});
describe("Verified gateway identity", () => {
  it("verifies signature, issuer, audience, expiry and rejects an unsigned token", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const config = {
      publicKey: await exportSPKI(publicKey),
      issuer: "https://issuer.example",
      audience: "stride",
    };
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("test-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .sign(privateKey);
    expect(await verifyIdentity(token, config)).toBe("test-user");
    await expect(
      verifyIdentity(token, { ...config, audience: "another-app" }),
    ).rejects.toThrow();
    await expect(
      verifyIdentity(token, { ...config, issuer: "https://other.example" }),
    ).rejects.toThrow();
    await expect(
      verifyIdentity("eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.", config),
    ).rejects.toThrow();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("test-user")
      .setIssuedAt()
      .setExpirationTime(1)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .sign(privateKey);
    await expect(verifyIdentity(expired, config)).rejects.toThrow();
  });
});
