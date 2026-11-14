// Strict request contract: external delivery options and custom content are not accepted.
export function parseAnnouncementId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
  const fields = Object.keys(body);
  const id = (body as Record<string, unknown>).announcement_id;
  if (fields.length !== 1 || fields[0] !== "announcement_id" || typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid request");
  }
  return id;
}