// Supabase Auth error → localized message key (auth.errors.* in src/messages).
// Pure: no raw provider text ever reaches the user.

export type AuthErrorKey =
  | "invalidEmail"
  | "invalidCode"
  | "rateLimited"
  | "emailSendFailed"
  | "signupDisabled"
  | "providerDisabled"
  | "linkInvalid"
  | "sessionExpired"
  | "network"
  | "blocked"
  | "generic";

interface AuthLikeError {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  name?: string | null;
}

const BY_CODE: Record<string, AuthErrorKey> = {
  validation_failed: "invalidEmail",
  email_address_invalid: "invalidEmail",
  otp_expired: "invalidCode",
  over_email_send_rate_limit: "rateLimited",
  over_request_rate_limit: "rateLimited",
  email_address_not_authorized: "emailSendFailed",
  signup_disabled: "signupDisabled",
  email_provider_disabled: "providerDisabled",
  otp_disabled: "providerDisabled",
  provider_disabled: "providerDisabled",
  oauth_provider_not_supported: "providerDisabled",
  anonymous_provider_disabled: "providerDisabled",
  flow_state_expired: "linkInvalid",
  flow_state_not_found: "linkInvalid",
  bad_code_verifier: "linkInvalid",
  bad_oauth_state: "linkInvalid",
  bad_oauth_callback: "linkInvalid",
  session_not_found: "sessionExpired",
  session_expired: "sessionExpired",
  refresh_token_not_found: "sessionExpired",
  refresh_token_already_used: "sessionExpired",
  user_not_found: "sessionExpired",
  user_banned: "blocked",
  request_timeout: "network",
};

/** Map any Supabase auth error (or thrown value) to a message key. */
export function authErrorKey(err: unknown): AuthErrorKey {
  if (!err || typeof err !== "object") return "generic";
  const e = err as AuthLikeError;
  const code = typeof e.code === "string" ? e.code : "";
  if (code && BY_CODE[code]) return BY_CODE[code];

  // Older servers / fetch failures carry no code: fall back on status + name.
  if (e.name === "AuthRetryableFetchError" || e.status === 0) return "network";
  if (e.status === 429) return "rateLimited";
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (msg.includes("token has expired or is invalid")) return "invalidCode";
  if (msg.includes("rate limit")) return "rateLimited";
  if (msg.includes("error sending")) return "emailSendFailed";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "network";
  return "generic";
}

/** Errors on updateUser({ email }) that mean "log in to that account instead of upgrading". */
export function isExistingAccountError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as AuthLikeError;
  if (code === "email_exists" || code === "user_already_exists" || code === "identity_already_exists") return true;
  // Manual linking disabled: upgrading in place is impossible, the merge path still works.
  if (code === "manual_linking_disabled") return true;
  return typeof message === "string" && /already (been )?registered|already exists/i.test(message);
}

/** Login-screen `?error=` values set by server routes. */
export function queryErrorKey(value: string | null | undefined): AuthErrorKey | null {
  if (value === "link_invalid") return "linkInvalid";
  if (value === "auth_failed") return "generic";
  return null;
}
