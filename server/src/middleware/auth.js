import { ApiError, unauthorized } from "../lib/errors.js";
import { verifyToken } from "../lib/security.js";
import { User } from "../models/index.js";

/** Bearer-token authentication. Attaches the lean user document as `req.user`. */
export async function authenticate(req, _res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") throw unauthorized();

  const id = verifyToken(token, "access");
  const user = id ? await User.findById(id).lean() : null;
  if (!user || !user.is_active) {
    throw new ApiError(401, {
      detail: "Given token not valid for any token type",
      code: "token_not_valid",
      messages: [{ token_class: "AccessToken", token_type: "access", message: "Token is invalid or expired" }],
    });
  }
  req.user = user;
  next();
}
