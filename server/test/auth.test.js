import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { as, http, makeUser, models, outbox, PASSWORD, reset, start, stop } from "./helpers.js";

const register = (body = {}) =>
  http()
    .post("/api/auth/register/")
    .send({ email: "new@test.local", password: PASSWORD, first_name: "New", last_name: "Person", role: "facility_manager", ...body });
const login = (email, password = PASSWORD) => http().post("/api/auth/login/").send({ email, password });

describe("registration", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("creates an account and never echoes the password", async () => {
    const res = await register();
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { email: "new@test.local", first_name: "New", last_name: "Person", phone: "", role: "facility_manager" });
  });

  it("creates a technician profile with a public token for technicians", async () => {
    await register({ email: "tech@test.local", role: "technician" });
    const user = await models.User.findOne({ email: "tech@test.local" }).lean();
    const profile = await models.TechnicianProfile.findOne({ user: user._id }).lean();
    assert.ok(profile);
    assert.match(profile.public_token, /^[0-9a-f-]{36}$/);
  });

  it("stores the email lowercase and trimmed", async () => {
    await register({ email: "  Afrah.Shaikh@Example.COM " });
    const user = await models.User.findOne({}).lean();
    assert.equal(user.email, "afrah.shaikh@example.com");
  });

  it("rejects a duplicate that differs only by case", async () => {
    assert.equal((await register({ email: "dup@test.local" })).status, 201);
    const res = await register({ email: "DUP@test.local" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.email, ["A user with this email already exists."]);
    assert.equal(await models.User.countDocuments(), 1);
  });

  it("reports every missing field the way the form expects", async () => {
    const res = await http().post("/api/auth/register/").send({});
    assert.equal(res.status, 400);
    for (const field of ["email", "password", "role"]) assert.deepEqual(res.body[field], ["This field is required."]);
  });

  it("refuses to self-register as an admin", async () => {
    const res = await register({ role: "admin" });
    assert.equal(res.status, 400);
    assert.match(res.body.role[0], /not a valid choice/);
  });

  it("enforces the password policy and reports every problem at once", async () => {
    const res = await register({ password: "short" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.password, [
      "Use at least 10 characters.",
      "Include both upper and lower case letters.",
      "Include a number.",
      "Include a symbol such as ! @ # ?",
    ]);
  });

  for (const [password, expected] of [
    ["alllowercase1!x", /upper and lower/],
    ["ALLUPPERCASE1!X", /upper and lower/],
    ["NoNumbersHere!!", /Include a number/],
    ["NoSymbols12345Ab", /Include a symbol/],
    ["Password@123", /too common/],
    ["Maria-Lopez-9!x", /similar to your personal information/],
  ]) {
    it(`rejects the password ${JSON.stringify(password)}`, async () => {
      const res = await register({ first_name: "Maria", last_name: "Lopez", password });
      assert.equal(res.status, 400);
      assert.ok(res.body.password.some((m) => expected.test(m)), JSON.stringify(res.body.password));
    });
  }

  it("rejects a password containing the email name", async () => {
    const res = await register({ email: "jonathan@test.local", password: "Jonathan-77!zz" });
    assert.match(res.body.password.join(" "), /similar to your personal information/);
  });

  it("accepts a strong password and a passphrase-style one", async () => {
    assert.equal((await register({ email: "a@test.local", password: "Tr1cky-Horse-Battery!" })).status, 201);
    assert.equal((await register({ email: "b@test.local", password: "k9#Lm2$vQx7pW" })).status, 201);
  });

  it("still lets someone with an older, weaker password sign in", async () => {
    await models.User.create({
      email: "old@test.local", username: "old@test.local", role: "technician",
      password: await (await import("../src/lib/security.js")).hashPassword("oldpass123"),
    });
    assert.equal((await login("old@test.local", "oldpass123")).status, 200);
  });

  it("validates the email address", async () => {
    const res = await register({ email: "not-an-email" });
    assert.deepEqual(res.body.email, ["Enter a valid email address."]);
  });
});

describe("sign in", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("returns tokens and the user", async () => {
    await register();
    const res = await login("new@test.local");
    assert.equal(res.status, 200);
    assert.ok(res.body.access && res.body.refresh);
    assert.equal(res.body.user.email, "new@test.local");
    assert.equal(res.body.user.role, "facility_manager");
    assert.equal(res.body.user.password, undefined);
  });

  for (const typed of ["new@test.local", "New@Test.Local", "NEW@TEST.LOCAL", "  new@test.local  "]) {
    it(`accepts the email typed as ${JSON.stringify(typed)}`, async () => {
      await register();
      assert.equal((await login(typed)).status, 200);
    });
  }

  it("accepts an account stored with capitals (created before emails were normalised)", async () => {
    await models.User.create({
      email: "Legacy@Example.com", username: "Legacy@Example.com", role: "technician",
      password: (await import("../src/lib/security.js")).hashPassword ? await (await import("../src/lib/security.js")).hashPassword(PASSWORD) : "",
    });
    assert.equal((await login("legacy@example.com")).status, 200);
    assert.equal((await login("Legacy@Example.com")).status, 200);
  });

  it("rejects a wrong password and an unknown email identically", async () => {
    await register();
    const wrong = await login("new@test.local", "WrongPass123");
    const unknown = await login("nobody@test.local");
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it("rejects an inactive account", async () => {
    await register();
    await models.User.updateOne({ email: "new@test.local" }, { is_active: false });
    assert.equal((await login("new@test.local")).status, 401);
  });

  it("requires both fields", async () => {
    const res = await http().post("/api/auth/login/").send({});
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.email, ["This field is required."]);
    assert.deepEqual(res.body.password, ["This field is required."]);
  });

  it("rotates refresh tokens and refuses an access token as a refresh token", async () => {
    await register();
    const { access, refresh } = (await login("new@test.local")).body;

    const refreshed = await http().post("/api/auth/refresh/").send({ refresh });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.access && refreshed.body.refresh);

    assert.equal((await http().post("/api/auth/refresh/").send({ refresh: access })).status, 401);
    assert.equal((await http().post("/api/auth/refresh/").send({ refresh: "garbage" })).status, 401);
  });

  it("refuses a refresh token as an access token", async () => {
    await register();
    const { refresh } = (await login("new@test.local")).body;
    assert.equal((await http().get("/api/auth/me/").set(as(refresh))).status, 401);
  });
});

describe("profile", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("reads and updates the signed-in user", async () => {
    const { token } = await makeUser("facility_manager");
    const me = await http().get("/api/auth/me/").set(as(token));
    assert.equal(me.status, 200);

    const patched = await http().patch("/api/auth/me/").set(as(token)).send({ first_name: "Renamed", phone: "+91 98765 43210" });
    assert.equal(patched.body.first_name, "Renamed");
    assert.equal(patched.body.phone, "+919876543210");
  });

  it("does not let a user change their own role", async () => {
    const { token } = await makeUser("technician");
    const res = await http().patch("/api/auth/me/").set(as(token)).send({ role: "admin" });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, "technician");
  });

  it("normalises an edited email and blocks collisions in any case", async () => {
    const a = await makeUser("facility_manager");
    const b = await makeUser("technician");
    const collision = await http().patch("/api/auth/me/").set(as(a.token)).send({ email: b.user.email.toUpperCase() });
    assert.equal(collision.status, 400);

    const changed = await http().patch("/api/auth/me/").set(as(a.token)).send({ email: "New.Me@Example.com" });
    assert.equal(changed.body.email, "new.me@example.com");
    const again = await http().patch("/api/auth/me/").set(as(a.token)).send({ email: "NEW.ME@example.com" });
    assert.equal(again.status, 200);
  });
});

describe("password reset", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const requestLink = async (email) => {
    const res = await http().post("/api/auth/password-reset/").send({ email });
    assert.equal(res.status, 200);
    const mail = outbox.at(-1);
    if (!mail) return null;
    const url = new URL(mail.text.match(/https?:\/\/\S+/)[0]);
    return { uid: url.searchParams.get("uid"), token: url.searchParams.get("token") };
  };

  it("answers the same whether or not the account exists, and only emails real accounts", async () => {
    await register();
    const known = await http().post("/api/auth/password-reset/").send({ email: "new@test.local" });
    const unknown = await http().post("/api/auth/password-reset/").send({ email: "ghost@test.local" });
    assert.deepEqual(known.body, unknown.body);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, "new@test.local");
  });

  it("resets the password once, then the link is dead", async () => {
    await register();
    const link = await requestLink("NEW@test.local");
    const ok = await http().post("/api/auth/password-reset/confirm/").send({ ...link, password: "Brand!New#Pass456" });
    assert.equal(ok.status, 200);

    assert.equal((await login("new@test.local", "Brand!New#Pass456")).status, 200);
    assert.equal((await login("new@test.local", PASSWORD)).status, 401);

    const reused = await http().post("/api/auth/password-reset/confirm/").send({ ...link, password: "Another!Pass#789x" });
    assert.equal(reused.status, 400);
  });

  it("rejects a tampered token and a weak password", async () => {
    await register();
    const link = await requestLink("new@test.local");
    const bad = await http().post("/api/auth/password-reset/confirm/").send({ ...link, token: `${link.token}x`, password: "Brand!New#Pass456" });
    assert.equal(bad.status, 400);

    const weak = await http().post("/api/auth/password-reset/confirm/").send({ ...link, password: "12345678" });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.password.length > 0);
  });
});

describe("phone numbers", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const withPhone = (phone) => http().post("/api/auth/register/").send({
    email: "p@test.local", password: PASSWORD, first_name: "P", last_name: "Q", role: "facility_manager", phone,
  });

  for (const [typed, stored] of [
    ["+91 98765 43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["+91-9800000001", "+919800000001"],
    ["+1 202 555 0123", "+12025550123"],
    ["+44 7911 123456", "+447911123456"],
    ["", ""],
  ]) {
    it(`stores ${JSON.stringify(typed)} as ${JSON.stringify(stored)}`, async () => {
      const res = await withPhone(typed);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal((await models.User.findOne({}).lean()).phone, stored);
    });
  }

  for (const bad of ["+9198765432101", "+91 98765", "9876543210", "+1 202 555 01234", "abc", "+999 123456789"]) {
    it(`rejects ${JSON.stringify(bad)}`, async () => {
      const res = await withPhone(bad);
      assert.equal(res.status, 400);
      assert.match(res.body.phone[0], /valid phone number with its country code/);
      assert.equal(await models.User.countDocuments(), 0);
    });
  }

  it("validates profile edits and facility contact numbers the same way", async () => {
    const { token } = await makeUser("facility_manager");
    assert.equal((await http().patch("/api/auth/me/").set(as(token)).send({ phone: "+9198765432101" })).status, 400);
    const ok = await http().patch("/api/auth/me/").set(as(token)).send({ phone: "+91 98765 43210" });
    assert.equal(ok.body.phone, "+919876543210");

    const facility = { name: "F", address: "A", service_area: "S" };
    assert.equal((await http().post("/api/facilities/").set(as(token)).send({ ...facility, contact_phone: "+91 123" })).status, 400);
    const created = await http().post("/api/facilities/").set(as(token)).send({ ...facility, contact_phone: "+91 22 6123 4567" });
    assert.equal(created.status, 201);
    assert.equal(created.body.contact_phone, "+912261234567");
  });
});
