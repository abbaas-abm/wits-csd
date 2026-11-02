/** Sign-in steps the browser reports to /api/activity. */
export const AUTH_ACTIONS = [
  "otp_requested",
  "otp_resent",
  "otp_request_failed",
  "otp_verified",
  "otp_failed",
  "signed_out",
] as const;

export type AuthAction = (typeof AUTH_ACTIONS)[number];

/**
 * Fire-and-forget: records a sign-in step in the activity log. Never throws
 * and never delays the sign-in flow. `keepalive` lets it finish even when the
 * page navigates away straight after (e.g. on sign-out).
 */
export function logAuthActivity(
  action: AuthAction,
  data: { email?: string; error?: string } = {},
) {
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Logging must never get in the way.
  }
}
