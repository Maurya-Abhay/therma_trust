/**
 * Look at, or repair, one account.
 *
 *   MONGODB_URI=... npm run user -- create-admin  # also set ADMIN_EMAIL and ADMIN_PASSWORD
 *   MONGODB_URI=... npm run user -- list
 *   MONGODB_URI=... npm run user -- check tc1@gmail.com
 *   MONGODB_URI=... CHECK_PASSWORD='the password you are typing' npm run user -- check tc1@gmail.com
 *   MONGODB_URI=... NEW_PASSWORD='A-New-Str0ng-Pass!' npm run user -- set-password tc1@gmail.com
 *
 * `create-admin` creates the first admin only; it refuses to run if an admin/staff account already exists.
 * `check` explains why sign-in would fail (missing account, switched off, wrong id type, an
 * unreadable password hash, a password that does not match) without ever printing the hash.
 * `set-password` replaces the password (it must pass the same strength rules as the app).
 * Both refuse to run unless MONGODB_URI is set explicitly.
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connect, disconnect } from "../db.js";
import { hashPassword, passwordProblems, verifyPassword } from "../lib/security.js";
import { CI, TechnicianProfile, User } from "../models/index.js";

const scheme = (hash) => {
  if (!hash) return "none (cannot sign in)";
  if (hash.startsWith("pbkdf2_sha256$")) return "Django PBKDF2 (accepted, upgraded on first sign-in)";
  if (hash.startsWith("$2")) return "bcrypt";
  return `unrecognised (starts with "${hash.slice(0, 4)}...")`;
};

const bsonKind = (value) => (typeof value === "object" && value !== null ? value.constructor?.name ?? "object" : typeof value);

export async function checkUser(email, { password, log = console.log } = {}) {
  const typed = email.trim();
  // Which database this is: the API must be pointed at the same one, or accounts that exist here
  // will not exist for it (a connection string without "/thermatrust" quietly uses a database named "test").
  const totalUsers = await mongoose.connection.db.collection("users").countDocuments();
  log(`Database: ${JSON.stringify(mongoose.connection.name)} (${totalUsers} accounts)`);
  const raw = await mongoose.connection.db.collection("users").findOne({ email: typed }, { collation: CI });
  const problems = [];

  if (!raw) {
    const similar = await mongoose.connection.db
      .collection("users")
      .find({ email: { $regex: typed.split("@")[0].slice(0, 6).replace(/[^a-z0-9]/gi, ""), $options: "i" } })
      .project({ email: 1 })
      .limit(5)
      .toArray();
    log(`No account with the email ${JSON.stringify(typed)} in this database.`);
    log(similar.length ? `Similar emails: ${similar.map((u) => JSON.stringify(u.email)).join(", ")}` : "No similar emails either: is MONGODB_URI the right database?");
    return { found: false, problems: ["account not found"] };
  }

  log(`Found: ${JSON.stringify(raw.email)} (id ${JSON.stringify(raw._id)}, role ${raw.role})`);
  log(`  active:             ${raw.is_active}`);
  log(`  password stored as: ${scheme(raw.password)}`);
  log(`  id type:            ${bsonKind(raw._id)}`);

  if (raw.is_active === false) problems.push("The account is switched off (is_active is false), so sign-in is refused.");
  if (raw.email !== raw.email.trim() || raw.email !== raw.email.toLowerCase()) {
    log("  note: the stored email has capitals or spaces; sign-in still matches it without regard to case.");
  }
  if (typeof raw._id !== "number") {
    problems.push(
      `The id is stored as ${bsonKind(raw._id)}, not a number, so sign-in fails with a server error. Re-run the import with --replace from the current code.`
    );
  }
  if (!raw.password || !(raw.password.startsWith("$2") || raw.password.startsWith("pbkdf2_sha256$"))) {
    problems.push("The stored password is empty or in a format this API cannot read. Set a new one with: npm run user -- set-password <email>");
  }

  // The same lookups the API performs, so a mismatch shows up here and not at sign-in.
  const viaApp = await User.findOne({ email: typed }).collation(CI).lean();
  if (!viaApp) problems.push("The API's own lookup does not find this account.");
  else if (typeof raw._id === "number" && !(await User.findById(raw._id).lean())) problems.push("Looking the account up by id fails.");

  if (raw.role === "technician" && typeof raw._id === "number") {
    const profile = await TechnicianProfile.findOne({ user: raw._id }).lean();
    log(`  technician profile: ${profile ? "yes" : "MISSING (technician pages will show an error)"}`);
    if (!profile) problems.push("This technician account has no technician profile.");
  }

  if (password !== undefined) {
    const ok = await verifyPassword(password, raw.password);
    log(`  typed password matches: ${ok ? "YES" : "NO"}`);
    if (!ok) problems.push("The password you gave does not match the stored one. Use 'Forgot password', or set a new one with this tool.");
  } else {
    log("  (give CHECK_PASSWORD=... to test whether a specific password matches)");
  }

  log(problems.length ? `\nProblems found:\n${problems.map((p) => `  - ${p}`).join("\n")}` : "\nNo problems found with this account's record.");
  return { found: true, problems };
}

/** Every account with its role and how its password is stored. Never prints a hash. */
export async function listUsers({ log = console.log } = {}) {
  const users = await mongoose.connection.db
    .collection("users")
    .find({}, { projection: { email: 1, role: 1, is_active: 1, password: 1 } })
    .sort({ _id: 1 })
    .toArray();
  log(`Database: ${JSON.stringify(mongoose.connection.name)} (${users.length} accounts)
`);
  for (const u of users) {
    const kind = !u.password ? "no password" : u.password.startsWith("$2") ? "bcrypt" : u.password.startsWith("pbkdf2_sha256$") ? "django-pbkdf2" : "unreadable";
    log(`  ${String(u._id).padStart(3)}  ${u.email.padEnd(34)} ${String(u.role).padEnd(19)} ${u.is_active ? "active  " : "DISABLED"} ${kind}`);
  }
  return users;
}

export async function createFirstAdmin(email, password, { log = console.log } = {}) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Set ADMIN_PASSWORD in the shell environment before creating the admin.");
  }
  if (await User.exists({ $or: [{ role: "admin" }, { is_staff: true }] })) {
    throw new Error("An admin/staff account already exists. Refusing to create another bootstrap admin.");
  }
  if (await User.findOne({ email: normalizedEmail }).collation(CI).lean()) {
    throw new Error("An account with ADMIN_EMAIL already exists. Use the existing account or choose another email.");
  }
  const issues = passwordProblems(password, { email: normalizedEmail });
  if (issues.length) throw new Error(`ADMIN_PASSWORD is not strong enough:\n  - ${issues.join("\n  - ")}`);

  const user = await User.create({
    email: normalizedEmail,
    username: normalizedEmail,
    password: await hashPassword(password),
    role: "admin",
    is_staff: true,
    is_superuser: true,
    is_active: true,
  });
  log(`First admin created for ${user.email}. Remove ADMIN_PASSWORD from the shell environment now.`);
  return user;
}

export async function setPassword(email, newPassword, { log = console.log } = {}) {
  const user = await User.findOne({ email: email.trim() }).collation(CI);
  if (!user) throw new Error(`No account with the email ${JSON.stringify(email.trim())}.`);
  const issues = passwordProblems(newPassword, user);
  if (issues.length) throw new Error(`That password is not strong enough:\n  - ${issues.join("\n  - ")}`);
  user.password = await hashPassword(newPassword);
  user.is_active = true;
  await user.save();
  log(`Password updated for ${user.email}. The account is active. They can sign in now.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, email] = process.argv.slice(2);
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI explicitly: this tool reads and edits accounts and will not guess a database.");
    process.exit(1);
  }
  const validCommand = ["create-admin", "check", "set-password", "list"].includes(command);
  const missingArgument = ["check", "set-password"].includes(command) && !email;
  if (!validCommand || missingArgument) {
    console.error("Usage: npm run user -- create-admin (ADMIN_EMAIL + ADMIN_PASSWORD env) | list | check <email> | set-password <email>");
    process.exit(1);
  }
  await connect();
  try {
    if (command === "create-admin") {
      await createFirstAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    } else if (command === "list") await listUsers();
    else if (command === "check") await checkUser(email, { password: process.env.CHECK_PASSWORD });
    else {
      if (!process.env.NEW_PASSWORD) throw new Error("Set NEW_PASSWORD to the new password first.");
      await setPassword(email, process.env.NEW_PASSWORD);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}
