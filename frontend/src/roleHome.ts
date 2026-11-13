import type { Role } from "./types";

/**
 * Moves from a public page (landing, sign-in, sign-up) into the signed-in app. The app is a separate
 * React Router app that reads the address bar when it starts, and a client-side jump can start it before
 * the address has changed, so it sees "/" and bounces back to the landing page forever. A full page load
 * always starts it on the right address.
 */
export function enterApp(role: Role) {
  window.location.replace(ROLE_HOME[role]);
}

export const ROLE_HOME: Record<Role, string> = {
  facility_manager: "/facilities",
  technician: "/profile",
  contractor_manager: "/company",
  admin: "/admin",
};
