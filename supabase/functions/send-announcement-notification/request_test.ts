import { parseAnnouncementId } from "./request.ts";

const id = "11111111-1111-4111-8111-111111111111";
Deno.test("accepts only a persisted announcement identifier", () => {
  if (parseAnnouncementId({ announcement_id: id }) !== id) throw new Error("Wrong identifier");
});
Deno.test("rejects custom text, recipients and immediate WhatsApp delivery", () => {
  for (const body of [
    null, [], {}, { announcement_id: "invalid" },
    { department_id: id, department_name: "Fake", announcement_title: "Custom", skip_whatsapp: false },
    { announcement_id: id, skip_whatsapp: false },
    { announcement_id: id, announcement_title: "Custom" },
    { announcement_id: id, phone: "5511999999999" },
  ]) {
    let rejected = false;
    try { parseAnnouncementId(body); } catch { rejected = true; }
    if (!rejected) throw new Error("Unsafe body accepted");
  }
});