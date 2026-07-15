import { supabase } from "@/integrations/supabase/client";

/** Path convention: kids/{page_id}/{owner_kind}/{owner_id}/{filename} */
export async function uploadKidsPhoto(
  file: File,
  pageId: string,
  ownerKind: "child" | "guardian",
  ownerId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `kids/${pageId}/${ownerKind}/${ownerId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("kids-photos").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function getKidsPhotoUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("kids-photos")
    .createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteKidsPhoto(path?: string | null): Promise<void> {
  if (!path) return;
  await supabase.storage.from("kids-photos").remove([path]);
}
