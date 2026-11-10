export function rateLimitDetails(providerCode, retryAfter, now = Date.now()) {
  let retryAfterSeconds;
  if (typeof retryAfter === "string" && retryAfter.trim()) {
    const value = retryAfter.trim();
    const seconds = /^\d+$/.test(value)
      ? Number(value)
      : Math.ceil((Date.parse(value) - now) / 1000);
    if (Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 2147483647)
      retryAfterSeconds = seconds;
  }
  const email = providerCode === "over_email_send_rate_limit";
  return {
    code: email ? "AUTH_EMAIL_RATE_LIMITED" : "AUTH_RATE_LIMITED",
    message: email
      ? "The email service has temporarily limited confirmation emails. Check your inbox for an earlier confirmation, or try again later."
      : "Too many authentication attempts. Please wait before trying again.",
    retryAfterSeconds,
  };
}
