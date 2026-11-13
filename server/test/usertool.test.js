import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { http, models, mongoose, PASSWORD, reset, start, stop } from "./helpers.js";
import { checkUser, createFirstAdmin, listUsers, setPassword } from "../src/scripts/user-tool.js";
import { hashPassword } from "../src/lib/security.js";

const capture = () => {
  const lines = [];
  return { lines, log: (line) => lines.push(line), text: () => lines.join("\n") };
};

describe("user tool", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const make = async (fields = {}) =>
    models.User.create({
      email: "tc1@gmail.com", username: "tc1@gmail.com", role: "contractor_manager", password: await hashPassword("Old!Passw0rd#1"), ...fields,
    });

  it("creates only the first admin with an explicit strong password", async () => {
    await assert.rejects(() => createFirstAdmin("bad-email", PASSWORD, { log: () => {} }), /valid email/);
    const created = await createFirstAdmin("OWNER@EXAMPLE.COM", PASSWORD, { log: () => {} });
    assert.equal(created.email, "owner@example.com");
    assert.equal(created.role, "admin");
    assert.equal(created.is_staff, true);
    assert.equal(created.is_superuser, true);
    await assert.rejects(() => createFirstAdmin("second@example.com", PASSWORD, { log: () => {} }), /already exists/);
  });

  it("reports a healthy account and whether a password matches", async () => {
    await make();
    const ok = capture();
    const result = await checkUser("TC1@gmail.com", { password: "Old!Passw0rd#1", log: ok.log });
    assert.deepEqual(result.problems, []);
    assert.match(ok.text(), /typed password matches: YES/);
    assert.ok(!ok.text().includes("$2"), "never prints the hash");

    const bad = capture();
    const wrong = await checkUser("tc1@gmail.com", { password: "nope", log: bad.log });
    assert.match(wrong.problems.join(" "), /does not match/);
  });

  it("explains a missing account and a switched-off account", async () => {
    const missing = capture();
    assert.equal((await checkUser("ghost@gmail.com", { log: missing.log })).found, false);
    assert.match(missing.text(), /No account with the email/);

    await make({ is_active: false });
    const off = capture();
    assert.match((await checkUser("tc1@gmail.com", { log: off.log })).problems.join(" "), /switched off/);
  });

  it("catches the string-id import problem and an unreadable hash", async () => {
    await mongoose.connection.db.collection("users").insertOne({
      _id: "7", email: "tc1@gmail.com", username: "tc1@gmail.com", role: "technician", password: "!unusable", is_active: true,
    });
    const out = capture();
    const result = await checkUser("tc1@gmail.com", { log: out.log });
    const text = result.problems.join(" ");
    assert.match(text, /not a number/);
    assert.match(text, /unreadable|format this API cannot read/);
  });

  it("sets a strong password, reactivates the account, and refuses a weak one", async () => {
    await make({ is_active: false });
    await assert.rejects(() => setPassword("tc1@gmail.com", "weak", { log: () => {} }), /not strong enough/);
    await setPassword("tc1@gmail.com", PASSWORD, { log: () => {} });
    const res = await http().post("/api/auth/login/").send({ email: "tc1@gmail.com", password: PASSWORD });
    assert.equal(res.status, 200);
    await assert.rejects(() => setPassword("nobody@gmail.com", PASSWORD, { log: () => {} }), /No account/);
  });

  it("lists accounts with role, state and password kind, and never prints a hash", async () => {
    await make();
    await make({ email: "old@gmail.com", username: "old@gmail.com", password: "pbkdf2_sha256$1000000$salt$hash", is_active: false });
    const out = capture();
    const users = await listUsers({ log: out.log });
    assert.equal(users.length, 2);
    assert.match(out.text(), /tc1@gmail.com\s+contractor_manager\s+active\s+bcrypt/);
    assert.match(out.text(), /old@gmail.com\s+contractor_manager\s+DISABLED\s+django-pbkdf2/);
    assert.ok(!out.text().includes("1000000$salt"), "no hash material is printed");
  });
});
