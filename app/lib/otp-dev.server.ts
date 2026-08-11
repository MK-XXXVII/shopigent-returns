// Dev/test helper: bypass OTP for test domains
// When DEV_BYPASS_OTP=true and the email domain is @example.com or @test.com,
// the OTP code is logged and returned in the response instead of emailed.

export function shouldBypassOtp(email: string): boolean {
  if (process.env.DEV_BYPASS_OTP !== "true") return false;
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return ["example.com", "test.com", "example.org"].includes(domain);
}

export function generateDevOtp(): string {
  return "123456"; // Fixed dev OTP
}