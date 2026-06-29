import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getClientIp } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

// Upload a scanned paper image from the scanner portal.
// Accepts either testId or worksheetId for ownership verification.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(ip);
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

  let body: { teacherId: string; testId?: string; worksheetId?: string; studentId: string; imageDataUrl: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { teacherId, testId, worksheetId, studentId, imageDataUrl } = body;
  if (!teacherId || (!testId && !worksheetId) || !studentId || !imageDataUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const commaIdx = imageDataUrl.indexOf(',');
  if (commaIdx === -1) return NextResponse.json({ error: 'Invalid data URL' }, { status: 400 });
  const base64 = imageDataUrl.slice(commaIdx + 1);

  const admin = createAdminClient();

  // Verify teacher ownership
  if (testId) {
    const { data: test, error: testErr } = await admin
      .from('tests').select('teacher_id').eq('id', testId).single();
    if (testErr || !test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    if ((test as { teacher_id: string }).teacher_id !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (worksheetId) {
    const { data: ws, error: wsErr } = await admin
      .from('worksheets').select('teacher_id').eq('id', worksheetId).single();
    if (wsErr || !ws) return NextResponse.json({ error: 'Worksheet not found' }, { status: 404 });
    if ((ws as { teacher_id: string }).teacher_id !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const buffer = Buffer.from(base64, 'base64');
  const folder = testId ? `scanner/${testId.slice(0, 8)}` : `worksheets/${worksheetId!.slice(0, 8)}`;
  const filename = `${folder}/${studentId.slice(0, 8)}_${Date.now()}.jpg`;

  const { error: uploadErr } = await admin.storage
    .from('scanned-papers')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: urlData } = admin.storage.from('scanned-papers').getPublicUrl(filename);
  return NextResponse.json({ url: urlData.publicUrl });
}
