import { connect, disconnect } from "../db.js";
import "../models/index.js";
import { sendAlertDigests } from "../services/alerts.js";

// The daily alert email, for a scheduler to run: `npm run alerts:digest`.
await connect();
try {
  console.log(`Alert digest emails sent: ${await sendAlertDigests()}`);
} finally {
  await disconnect();
}
