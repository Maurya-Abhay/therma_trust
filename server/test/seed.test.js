import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { as, http, models, reset, start, stop } from "./helpers.js";
import { seedDemoData } from "../src/scripts/seed.js";

describe("demo seed", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const counts = async () => ({
    users: await models.User.countDocuments(),
    technicians: await models.TechnicianProfile.countDocuments(),
    skills: await models.CapabilitySkill.countDocuments(),
    jobs: await models.JobRequest.countDocuments(),
    cylinders: await models.RefrigerantCylinder.countDocuments(),
    questions: await models.AssessmentQuestion.countDocuments(),
  });

  it("is idempotent and produces working demo accounts", async () => {
    await seedDemoData({ log: () => {} });
    const first = await counts();
    assert.deepEqual(first, { users: 6, technicians: 3, skills: 14, jobs: 2, cylinders: 3, questions: 10 });

    await seedDemoData({ log: () => {} });
    assert.deepEqual(await counts(), first);

    const login = await http().post("/api/auth/login/").send({ email: "fm@demo.local", password: "demopass123" });
    assert.equal(login.status, 200);
    const jobs = await http().get("/api/jobs/").set(as(login.body.access));
    assert.equal(jobs.body.count, 2);
    assert.ok(jobs.body.results.every((j) => j.scheduled_for), "demo jobs are scheduled so the calendar has work");

    const matches = await http().get(`/api/jobs/${jobs.body.results.find((j) => j.urgency === "urgent").id}/matches/`).set(as(login.body.access));
    assert.equal(matches.body.length, 3);
    assert.equal(matches.body[0].name, "Arjun Senior");
  });
});
