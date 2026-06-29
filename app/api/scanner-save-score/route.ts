import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getClientIp } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

// Scanner portal save — bypasses RLS via service role key.
// Verifies ownership by checking the test's teacher_id matches the supplied teacherId.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: {
    teacherId: string
    testId: string
    studentId: string
    score: number
    totalMarks: number
    breakdown?: unknown
    feedback?: string
    imageUrl?: string
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { teacherId, testId, studentId, score, totalMarks, breakdown, feedback, imageUrl } = body;

  if (!teacherId || !testId || !studentId || score === undefined || !totalMarks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (score < 0 || score > totalMarks) {
    return NextResponse.json({ error: 'score out of range' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the test belongs to this teacher
  const { data: test, error: testErr } = await admin
    .from('tests')
    .select('teacher_id')
    .eq('id', testId)
    .single();

  if (testErr || !test) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 });
  }
  if ((test as { teacher_id: string }).teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin.from('marks').upsert(
    {
      id: crypto.randomUUID(),
      test_id: testId,
      student_id: studentId,
      score,
      entered_at: new Date().toISOString(),
      source: 'ai_scanned',
      breakdown: breakdown ?? null,
      feedback: feedback ?? null,
      image_url: imageUrl ?? null,
    },
    { onConflict: 'student_id,test_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
