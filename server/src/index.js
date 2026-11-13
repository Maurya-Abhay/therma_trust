import { createApp } from "./app.js";
import { assertProductionSafe, config } from "./config.js";
import { connect, disconnect } from "./db.js";
import "./models/index.js";

assertProductionSafe();

await connect();
// Make sure unique indexes (email, audit chain links, ...) exist before taking traffic.
const mongoose = (await import("mongoose")).default;
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

// Demo deployments can opt in to (idempotent) demo data on every boot, as the previous build step did.
if (process.env.SEED_DEMO_DATA === "true") {
  const { seedDemoData } = await import("./scripts/seed.js");
  await seedDemoData();
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`ThermaTrust API listening on :${config.port} (${config.env})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
