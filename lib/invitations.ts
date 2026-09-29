export function invitationPath(value: string): string | null {
  try {
    const url = new URL(value.trim(), "https://pindou.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return /^\/room\/[a-f0-9]{48}\/?$/.test(url.pathname)
      ? url.pathname.replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}
