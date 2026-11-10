// Only documented codes are reflected back; provider messages may contain private data.
export function providerAuthFailure(payload, status) {
  const candidate = payload?.code ?? payload?.error_code;
  const messages = {
    email_address_not_authorized:
      "Supabase cannot send confirmation emails to this address with its default email service. Configure custom SMTP in Supabase Auth, then try again.",
    email_provider_disabled:
      "Email signup is disabled in Supabase Auth. Enable the Email provider before creating an account.",
    signup_disabled:
      "New account signup is disabled in Supabase Auth. Enable new user signups to continue.",
    weak_password:
      "This password does not meet the project's password policy. Choose a stronger password.",
    email_address_invalid: "Enter a valid email address.",
    email_not_confirmed:
      "Confirm your email address before signing in. Check your inbox or request a new confirmation email.",
    invalid_credentials: "The email or password is incorrect.",
    otp_expired:
      "The verification code is invalid or expired. Check the newest email or request a new code.",
    captcha_failed:
      "Supabase rejected the CAPTCHA verification. This application's authentication form needs CAPTCHA integration if bot protection is enabled.",
  };
  const known =
    typeof candidate === "string" && Object.hasOwn(messages, candidate);
  return {
    status: status >= 500 ? 503 : status === 401 ? 401 : 400,
    code: known ? "AUTH_" + candidate.toUpperCase() : "AUTH_PROVIDER",
    message: known
      ? messages[candidate]
      : status >= 500
        ? "Supabase could not complete authentication. Check Supabase Auth logs for email delivery, database or provider errors."
        : "Supabase rejected authentication. Check Supabase Auth logs for the failed request's error code.",
  };
}
