import { ZodError } from "zod";
import { ConfigurationError } from "../../lib/env.mjs";
export function authFailure(error) {
  if (error instanceof ConfigurationError)
    return {
      status: 503,
      code: "AUTH_CONFIGURATION",
      error:
        "Authentication configuration is missing or invalid on this deployment. Check SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_BASE_URL in Vercel, then redeploy.",
    };
  if (error instanceof ZodError) {
    const issue = error.issues[0],
      field = issue?.path.at(-1);
    let message = "Check the authentication form and try again.";
    if (field === "email") message = "Enter a valid email address.";
    if (field === "password")
      message =
        issue.code === "too_small" && issue.minimum >= 12
          ? "Use a password with at least 12 characters."
          : issue.code === "too_big"
            ? "Use a password no longer than 128 characters."
            : "Enter your password.";
    if (field === "token")
      message = "Enter the 6-10 digit confirmation code from your email.";
    return { status: 400, code: "AUTH_INPUT", error: message };
  }
  if (error instanceof SyntaxError)
    return {
      status: 400,
      code: "AUTH_REQUEST",
      error:
        "The authentication request is invalid. Reload the page and try again.",
    };
  return {
    status: 500,
    code: "AUTH_UNEXPECTED",
    error:
      "Authentication could not be completed. Please try again. If it continues, check the deployment function logs.",
  };
}
