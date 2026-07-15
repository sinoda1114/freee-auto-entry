export function normalizeGmailSourceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const isGmailPath =
      /^\/mail\//.test(url.pathname) ||
      /^\/a\/[^/]+\/mail\//.test(url.pathname);
    const messageId = url.hash.split("/").at(-1) ?? "";

    if (
      url.protocol !== "https:" ||
      url.hostname !== "mail.google.com" ||
      !isGmailPath ||
      !/^[a-zA-Z0-9_-]{8,}$/.test(messageId)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
