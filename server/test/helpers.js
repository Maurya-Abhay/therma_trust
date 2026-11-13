// Environment first: config.js reads it at import time.
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27117/thermatrust_test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.BCRYPT_ROUNDS = "4";
process.env.PUSH_SEND_ASYNC = "false";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `thermatrust-test-uploads-${process.pid}`);
process.env.FRONTEND_URL = "https://app.test";
process.env.SMTP_HOST = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.ALERTS_CRON_TOKEN = "";

const { default: supertest } = await import("supertest");
const { default: mongoose } = await import("mongoose");
const { createApp } = await import("../src/app.js");
const { connect, disconnect } = await import("../src/db.js");
const models = await import("../src/models/index.js");
const { hashPassword, signAccessToken } = await import("../src/lib/security.js");
const { dec } = await import("../src/lib/decimal.js");
const { outbox } = await import("../src/services/email.js");

export { models, outbox, dec, mongoose };
export const PASSWORD = "Str0ng-Pass!123";

const app = createApp();
export const http = () => supertest(app);

export async function start() {
  await connect();
  await Promise.all(Object.values(models).filter((m) => m?.init).map((m) => m.init()));
}

export async function stop() {
  await disconnect();
}

/** Empty every collection (and counters) so each test starts from nothing. */
export async function reset() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  outbox.length = 0;
}

const SEQ = { n: 0 };

export async function makeUser(role = "facility_manager", overrides = {}) {
  SEQ.n += 1;
  const user = await models.User.create({
    email: `${role}${SEQ.n}@test.local`,
    username: `${role}${SEQ.n}@test.local`,
    password: await hashPassword(PASSWORD),
    first_name: role.split("_")[0],
    last_name: `User${SEQ.n}`,
    role,
    is_staff: role === "admin",
    ...overrides,
  });
  const plain = user.toObject();
  return { user: plain, token: signAccessToken(plain) };
}

export const as = (token) => ({ Authorization: `Bearer ${token}` });

export async function makeRefrigerants() {
  const create = (data) => models.RefrigerantType.create(data).then((d) => d.toObject());
  return {
    r134a: await create({ code: "R-134a", name: "R-134a", gwp: 1430 }),
    r32: await create({ code: "R-32", name: "R-32", gwp: 675, is_a2l: true }),
    r717: await create({ code: "R-717", name: "Ammonia", gwp: 0, is_ammonia: true }),
    r744: await create({ code: "R-744", name: "CO2", gwp: 1, is_high_pressure: true }),
  };
}

export async function makeFacility(owner, overrides = {}) {
  return (
    await models.Facility.create({
      owner: owner._id, name: "Test Facility", address: "1 Test St", service_area: "Testville", segment: "cold_storage",
      ...overrides,
    })
  ).toObject();
}

export async function makeEquipment(facility, refrigerant, overrides = {}) {
  return (
    await models.Equipment.create({
      facility: facility._id, name: "Chiller 1", category: "commercial_chiller", refrigerant_type: refrigerant._id,
      criticality: "medium", ...overrides,
    })
  ).toObject();
}

export async function makeContractor(manager, overrides = {}) {
  return (
    await models.ContractorCompany.create({
      manager: manager._id, name: "Test Contractor", service_area: "Testville", verification_status: "verified", ...overrides,
    })
  ).toObject();
}

export async function makeTechnician(contractor = null, overrides = {}) {
  const { user, token } = await makeUser("technician");
  const profile = (
    await models.TechnicianProfile.create({
      user: user._id, contractor: contractor?._id ?? null, service_area: "Testville", years_experience: 5,
      public_token: crypto.randomUUID(), ...overrides,
    })
  ).toObject();
  return { user, token, profile };
}

export async function makeJob(facility, equipment, creator, overrides = {}) {
  return (
    await models.JobRequest.create({
      facility: facility._id, equipment: equipment._id, created_by: creator._id, description: "Compressor tripping",
      urgency: "scheduled", status: "open", risk_level: "medium", required_capabilities: [], ...overrides,
    })
  ).toObject();
}

export async function verifiedSkill(technician, fields) {
  return models.CapabilitySkill.create({
    technician: technician._id, capability_type: "equipment", status: "verified", ...fields,
  });
}
