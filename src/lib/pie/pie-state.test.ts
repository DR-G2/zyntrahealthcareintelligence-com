import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describePieStatus,
  loadPieView,
  mapPieStateRow,
  PIE_MIN_OBSERVATIONS,
  resolvePieView,
  syncPieState,
  type PieClient,
  type PieDeps,
  type PieStateRow,
} from "./pie-state";

const USER = "aaaaaaaa-0000-0000-0000-00000000000a";

function row(evidenceCount: number, level?: string): PieStateRow {
  return {
    state_version: 3,
    confidence: evidenceCount / 100,
    calculated_at: "2026-10-06T11:00:00Z",
    updated_at: "2026-10-06T11:00:00Z",
    state: {
      capability: { estimate: 0.5714 },
      decision: { estimate: 0.8 },
      timing: { estimate: 0.7 },
      calibration: { estimate: 0.66 },
      sustained_performance: { estimate: 0.5714 },
      learning: { estimate: 0.5714 },
      evidence_count: evidenceCount,
      evidence_level: level ?? (evidenceCount < 6 ? "INSUFFICIENT" : "PRELIMINARY"),
    },
  };
}

interface FakeOptions {
  userId?: string | null;
  rebuildError?: { message: string; code?: string } | null;
  readError?: { message: string; code?: string } | null;
  refreshError?: { message: string } | null;
  stateRow?: PieStateRow | null;
}

function fakeClient(opts: FakeOptions = {}) {
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const reads: string[] = [];
  const schema = vi.fn();
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: opts.userId === null ? null : { user: { id: opts.userId ?? USER } } },
      }),
    },
    rpc: (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "refresh_candidate_intelligence") return Promise.resolve({ data: null, error: opts.refreshError ?? null });
      if (fn === "rebuild_candidate_state") return Promise.resolve({ data: "state-id", error: opts.rebuildError ?? null });
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
    },
    from: (relation: string) => {
      reads.push(relation);
      return {
        select: () => ({
          maybeSingle: () => Promise.resolve({ data: opts.stateRow ?? null, error: opts.readError ?? null }),
        }),
      };
    },
    // Must never be used: browsers may not call the internal pie schema.
    schema,
  };
  return { client: client as unknown as PieClient, calls, reads, schema };
}

function deps(client: PieClient, overrides: Partial<PieDeps> = {}): PieDeps {
  return { ensureSession: async () => undefined, getClient: () => client, ...overrides };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("PIE UI state mapping", () => {
  it("maps zero observations / no row to Building evidence", () => {
    expect(resolvePieView(null)).toEqual({ status: "building", observations: 0, pie: null });
    const zero = resolvePieView(row(0));
    expect(zero.status).toBe("building");
    expect(describePieStatus(zero, false).headline).toBe("Building evidence");
  });

  it("maps fewer than 6 observations to Building evidence", () => {
    for (const n of [1, 5]) {
      const view = resolvePieView(row(n));
      expect(view.status).toBe("building");
      if (view.status === "building") expect(view.observations).toBe(n);
      expect(describePieStatus(view, false).detail).toBe(`${n} of ${PIE_MIN_OBSERVATIONS} observations needed`);
    }
  });

  it("treats an INSUFFICIENT evidence level as Building evidence even with 6+ observations", () => {
    expect(resolvePieView(row(8, "INSUFFICIENT")).status).toBe("building");
  });

  it("maps a valid state to the actual PIE state", () => {
    const view = resolvePieView(row(7));
    expect(view.status).toBe("ready");
    if (view.status !== "ready") return;
    expect(view.pie.capability).toBeCloseTo(0.5714);
    expect(view.pie.observation_count).toBe(7);
    expect(view.pie.state_sequence).toBe(3);
    expect(view.pie.identification_status).toBe("IDENTIFIED");
    expect(describePieStatus(view, false)).toEqual({
      tone: "ready",
      headline: "IDENTIFIED",
      detail: "Evidence: PRELIMINARY",
    });
  });

  it("clamps malformed estimates instead of rendering NaN", () => {
    const pie = mapPieStateRow({ state_version: 1, confidence: "x", state: { capability: { estimate: "bad" }, evidence_count: 10, evidence_level: "PRELIMINARY" } });
    expect(pie?.capability).toBe(0);
    expect(pie?.data_quality).toBe(0);
  });

  it("never uses Awaiting Signal for any state", () => {
    const views = [
      null,
      resolvePieView(null),
      resolvePieView(row(3)),
      resolvePieView(row(30)),
      { status: "unavailable" as const, diagnostic: { stage: "read" as const, message: "x" } },
    ];
    for (const v of views) {
      for (const loading of [true, false]) {
        const copy = describePieStatus(v, loading);
        expect(`${copy.headline} ${copy.detail}`.toLowerCase()).not.toContain("awaiting signal");
      }
    }
    expect(describePieStatus({ status: "unavailable", diagnostic: { stage: "rebuild", message: "x" } }, false).headline)
      .toBe("PIE temporarily unavailable");
  });
});

describe("PIE RPC boundary (loadPieView)", () => {
  it("rebuilds via the public wrapper with the caller's own V2 user id, then reads my_pie_state", async () => {
    const { client, calls, reads, schema } = fakeClient({ stateRow: row(7) });
    const view = await loadPieView(deps(client));
    expect(view.status).toBe("ready");
    expect(calls).toContainEqual({ fn: "rebuild_candidate_state", args: { p_user_id: USER } });
    expect(reads).toEqual(["my_pie_state"]);
    expect(schema).not.toHaveBeenCalled();
  });

  it("returns Building evidence when the rebuild succeeds and there are no observations yet", async () => {
    const { client } = fakeClient({ stateRow: row(0) });
    expect((await loadPieView(deps(client))).status).toBe("building");
  });

  it("reports rebuild RPC failures as unavailable with diagnostics (not as 'no state')", async () => {
    const { client, reads } = fakeClient({ rebuildError: { message: "permission denied for function rebuild_candidate_state", code: "42501" } });
    const view = await loadPieView(deps(client));
    expect(view).toEqual({
      status: "unavailable",
      diagnostic: expect.objectContaining({ stage: "rebuild", code: "42501" }),
    });
    expect(reads).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith("[PIE] temporarily unavailable", expect.objectContaining({ stage: "rebuild" }));
  });

  it("reports my_pie_state read failures as unavailable", async () => {
    const { client } = fakeClient({ readError: { message: "permission denied for table pie_candidate_state", code: "42501" } });
    const view = await loadPieView(deps(client));
    expect(view.status).toBe("unavailable");
    if (view.status === "unavailable") expect(view.diagnostic.stage).toBe("read");
  });

  it("reports V2 auth bridge failures as unavailable (session stage)", async () => {
    const { client, calls } = fakeClient();
    const view = await loadPieView(deps(client, { ensureSession: async () => { throw new Error("Failed to fetch"); } }));
    expect(view).toEqual({ status: "unavailable", diagnostic: expect.objectContaining({ stage: "session", message: "Failed to fetch" }) });
    expect(calls).toEqual([]);
  });

  it("reports a missing V2 session user as unavailable", async () => {
    const { client } = fakeClient({ userId: null });
    const view = await loadPieView(deps(client));
    expect(view.status).toBe("unavailable");
    if (view.status === "unavailable") expect(view.diagnostic.stage).toBe("session");
  });

  it("reports missing V2 configuration as unavailable (config stage)", async () => {
    const view = await loadPieView({
      ensureSession: async () => undefined,
      getClient: () => { throw new Error("V2 Supabase is not configured."); },
    });
    expect(view.status).toBe("unavailable");
    if (view.status === "unavailable") expect(view.diagnostic.stage).toBe("config");
  });

  it("does not let a canonical-intelligence refresh failure block PIE", async () => {
    const { client } = fakeClient({ refreshError: { message: "Service role required" }, stateRow: row(12) });
    expect((await loadPieView(deps(client))).status).toBe("ready");
  });
});

describe("PIE post-attempt sync (syncPieState)", () => {
  it("never throws and reports failure without blocking the caller", async () => {
    const result = await syncPieState({
      ensureSession: async () => { throw new Error("bridge down"); },
      getClient: () => fakeClient().client,
    });
    expect(result.ok).toBe(false);
  });

  it("rebuilds through the public wrapper only", async () => {
    const { client, calls, schema } = fakeClient();
    expect(await syncPieState(deps(client))).toEqual({ ok: true });
    expect(calls.map((c) => c.fn)).toEqual(["refresh_candidate_intelligence", "rebuild_candidate_state"]);
    expect(calls[1].args).toEqual({ p_user_id: USER });
    expect(schema).not.toHaveBeenCalled();
  });

  it("surfaces a rebuild error as a diagnostic", async () => {
    const { client } = fakeClient({ rebuildError: { message: "User scope violation", code: "42501" } });
    const result = await syncPieState(deps(client));
    expect(result).toEqual({ ok: false, diagnostic: expect.objectContaining({ stage: "rebuild", code: "42501" }) });
  });
});
