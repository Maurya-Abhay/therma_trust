import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { http, reset, start, stop } from "./helpers.js";

describe("smoke", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("answers the health check", async () => {
    const res = await http().get("/api/health/");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });

  it("requires authentication elsewhere", async () => {
    const res = await http().get("/api/facilities/");
    assert.equal(res.status, 401);
    assert.equal(res.body.detail, "Authentication credentials were not provided.");
  });

  it("returns JSON for unknown routes", async () => {
    const res = await http().get("/api/nope/");
    assert.equal(res.status, 404);
    assert.equal(res.body.detail, "Not found.");
  });
});
