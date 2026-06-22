import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageBase64: string; mimeType?: string; filename?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const { imageBase64, mimeType = "image/jpeg", filename = "scan.jpg" } = body;
  if (!imageBase64) return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });

  const buffer = Buffer.from(imageBase64, "base64");
  const uniqueName = `${Date.now()}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("scanned-papers")
    .upload(uniqueName, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error("[upload-scan] Supabase storage error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("scanned-papers")
    .getPublicUrl(uniqueName);

  return NextResponse.json({ url: urlData.publicUrl });
}
