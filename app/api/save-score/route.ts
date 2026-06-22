import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

interface RequestBody {
  studentId: string;
  testId: string;
  score: number;
  totalMarks: number;
  source?: string;
  breakdown?: unknown[];
  feedback?: string;
  imageUrl?: string;
}

export async function POST(request: Request) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { studentId, testId, score, totalMarks, source, breakdown, feedback, imageUrl } = body;

  if (!studentId || !testId) {
    return NextResponse.json({ error: "studentId and testId are required" }, { status: 400 });
  }
  if (typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "score must be a non-negative number" }, { status: 400 });
  }
  if (typeof totalMarks !== "number" || totalMarks <= 0) {
    return NextResponse.json({ error: "totalMarks must be a positive number" }, { status: 400 });
  }
  if (score > totalMarks) {
    return NextResponse.json({ error: "score cannot exceed totalMarks" }, { status: 400 });
  }

  const { error } = await supabase.from("marks").upsert(
    {
      id: crypto.randomUUID(),
      test_id: testId,
      student_id: studentId,
      score,
      entered_at: new Date().toISOString(),
      source: source ?? "ai_scanned",
      breakdown: breakdown ?? null,
      feedback: feedback ?? null,
      image_url: imageUrl ?? null,
    },
    { onConflict: "student_id,test_id" }
  );

  if (error) {
    console.error("[save-score] Supabase upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
