"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  BookOpen, ArrowRight, ScanLine, CheckCircle2,
  FileText, LogOut, RefreshCw, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/scanner/spinner";

interface TestRow {
  id: string;
  topic: string;
  total_marks: number;
  conducted_on: string;
  subject: string;
  term: string | null;
  class_id: string | null;
  scanned: number;
  total: number;
}

interface WorksheetRow {
  id: string;
  topic: string;
  total_marks: number;
  subject: string;
  class_id: string | null;
  created_at: string;
  scanned: number;
  total: number;
}

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
}

interface TestGroup {
  cls: ClassRow | null;
  tests: TestRow[];
}

interface WorksheetGroup {
  cls: ClassRow | null;
  worksheets: WorksheetRow[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function ConnectPage() {
  const router = useRouter();

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState("");

  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [testGroups, setTestGroups]           = useState<TestGroup[]>([]);
  const [worksheetGroups, setWorksheetGroups] = useState<WorksheetGroup[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError]     = useState<string | null>(null);

  const loadAll = useCallback(async (tId: string) => {
    setTestsLoading(true);
    setTestsError(null);

    const [testsRes, wsRes, classesRes] = await Promise.all([
      supabase
        .from("tests")
        .select("id, topic, total_marks, conducted_on, class_id, subject, term")
        .eq("teacher_id", tId)
        .order("conducted_on", { ascending: false }),
      supabase
        .from("worksheets")
        .select("id, topic, total_marks, subject, class_id, created_at")
        .eq("teacher_id", tId)
        .order("created_at", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name, grade, section")
        .eq("teacher_id", tId),
    ]);

    if (testsRes.error) { setTestsError(testsRes.error.message); setTestsLoading(false); return; }

    const rawTests = (testsRes.data ?? []) as Omit<TestRow, "scanned" | "total">[];
    const rawWs    = (wsRes.data ?? []) as Omit<WorksheetRow, "scanned" | "total">[];
    const classes  = (classesRes.data ?? []) as ClassRow[];

    const classMap = new Map<string, ClassRow>();
    for (const c of classes) classMap.set(c.id, c);

    // All unique class IDs across tests + worksheets
    const allClassIds = [
      ...new Set([
        ...rawTests.map(t => t.class_id),
        ...rawWs.map(w => w.class_id),
      ].filter(Boolean) as string[])
    ];

    // Student counts per class
    const studentMap = new Map<string, number>();
    if (allClassIds.length > 0) {
      const { data } = await supabase
        .from("students")
        .select("id, class_id")
        .in("class_id", allClassIds)
        .eq("is_active", true);
      for (const s of (data ?? []) as { id: string; class_id: string }[])
        studentMap.set(s.class_id, (studentMap.get(s.class_id) ?? 0) + 1);
    }

    // Marks counts per test
    const testIds = rawTests.map(t => t.id);
    const marksMap = new Map<string, number>();
    if (testIds.length > 0) {
      const { data } = await supabase.from("marks").select("test_id").in("test_id", testIds);
      for (const m of (data ?? []) as { test_id: string }[])
        marksMap.set(m.test_id, (marksMap.get(m.test_id) ?? 0) + 1);
    }

    // Worksheet marks counts per worksheet
    const wsIds = rawWs.map(w => w.id);
    const wsMarksMap = new Map<string, number>();
    if (wsIds.length > 0) {
      const { data } = await supabase
        .from("worksheet_marks")
        .select("worksheet_id")
        .in("worksheet_id", wsIds);
      for (const m of (data ?? []) as { worksheet_id: string }[])
        wsMarksMap.set(m.worksheet_id, (wsMarksMap.get(m.worksheet_id) ?? 0) + 1);
    }

    // Group tests by class
    const tGroups = new Map<string, TestGroup>();
    for (const raw of rawTests) {
      const key = raw.class_id ?? "__none__";
      if (!tGroups.has(key))
        tGroups.set(key, { cls: raw.class_id ? (classMap.get(raw.class_id) ?? null) : null, tests: [] });
      tGroups.get(key)!.tests.push({
        ...raw,
        scanned: marksMap.get(raw.id) ?? 0,
        total: raw.class_id ? (studentMap.get(raw.class_id) ?? 0) : 0,
      });
    }

    // Group worksheets by class
    const wGroups = new Map<string, WorksheetGroup>();
    for (const raw of rawWs) {
      const key = raw.class_id ?? "__none__";
      if (!wGroups.has(key))
        wGroups.set(key, { cls: raw.class_id ? (classMap.get(raw.class_id) ?? null) : null, worksheets: [] });
      wGroups.get(key)!.worksheets.push({
        ...raw,
        scanned: wsMarksMap.get(raw.id) ?? 0,
        total: raw.class_id ? (studentMap.get(raw.class_id) ?? 0) : 0,
      });
    }

    setTestGroups([...tGroups.values()]);
    setWorksheetGroups([...wGroups.values()]);
    setTestsLoading(false);
  }, []);

  useEffect(() => {
    const tId = localStorage.getItem("scanner_teacher_id");
    if (tId) {
      setTeacherId(tId);
      setTeacherName(localStorage.getItem("scanner_teacher_name") ?? "");
      void loadAll(tId);
    }
  }, [loadAll]);

  async function handleCodeConnect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCodeError(null);
    setCodeLoading(true);

    const { data, error: dbError } = await supabase
      .from("teachers")
      .select("id, name, school_name")
      .eq("teacher_code", trimmed.toUpperCase())
      .single();

    if (dbError || !data) {
      setCodeError("Teacher code not found. Please check with your teacher.");
      setCodeLoading(false);
      return;
    }

    const t = data as { id: string; name: string; school_name: string | null };
    localStorage.setItem("scanner_teacher_id", t.id);
    localStorage.setItem("scanner_teacher_name", t.name ?? "");
    localStorage.setItem("scanner_school_name", t.school_name ?? "");
    setTeacherId(t.id);
    setTeacherName(t.name ?? "");
    setCodeLoading(false);
    void loadAll(t.id);
  }

  function disconnect() {
    localStorage.removeItem("scanner_teacher_id");
    localStorage.removeItem("scanner_teacher_name");
    localStorage.removeItem("scanner_school_name");
    setTeacherId(null);
    setTestGroups([]);
    setWorksheetGroups([]);
    setCode("");
  }

  // ── Connected: show tests + worksheets ─────────────────────────────────────
  if (teacherId) {
    const totalTests   = testGroups.reduce((s, g) => s + g.tests.length, 0);
    const totalScanned = testGroups.reduce((s, g) => s + g.tests.reduce((ss, t) => ss + t.scanned, 0), 0);
    const totalWs      = worksheetGroups.reduce((s, g) => s + g.worksheets.length, 0);

    return (
      <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] pb-safe px-4 pt-6">
        <div className="w-full max-w-sm mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-500 mb-0.5">
                {localStorage.getItem("scanner_school_name") || "School"}
              </p>
              <h1 className="text-xl font-black text-gray-900 leading-tight">{teacherName || "Teacher"}</h1>
              {!testsLoading && (totalTests > 0 || totalWs > 0) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {totalTests} test{totalTests !== 1 ? "s" : ""}
                  {totalWs > 0 ? ` · ${totalWs} worksheet${totalWs !== 1 ? "s" : ""}` : ""}
                  {totalScanned > 0 ? ` · ${totalScanned} papers scanned` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => void loadAll(teacherId)}
                disabled={testsLoading}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw size={15} className={testsLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={disconnect}
                className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
                title="Disconnect"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* Body */}
          {testsLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : testsError ? (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-red-600 font-medium">{testsError}</p>
            </div>
          ) : (testGroups.length === 0 && worksheetGroups.length === 0) ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <BookOpen size={28} className="text-indigo-300" />
              </div>
              <p className="text-gray-500 font-bold text-sm">No tests or worksheets yet</p>
              <p className="text-xs text-gray-400 mt-1">The teacher hasn&apos;t created any content yet.</p>
            </div>
          ) : (
            <div className="space-y-8">

              {/* ── Tests section ── */}
              {testGroups.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-indigo-400 shrink-0" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-400">Tests</p>
                  </div>
                  {testGroups.map((group, gi) => (
                    <div key={gi}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 px-1">
                        {group.cls
                          ? `Grade ${group.cls.grade}${group.cls.section ? ` · Sec ${group.cls.section}` : ""} — ${group.cls.name}`
                          : "No class assigned"}
                      </p>
                      <div className="space-y-2.5">
                        {group.tests.map(test => {
                          const completed  = test.total > 0 && test.scanned >= test.total;
                          const inProgress = !completed && test.scanned > 0;
                          return (
                            <div key={test.id} className="flex items-stretch gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (test.class_id)
                                    router.push(`/scanner/${test.class_id}/tests/${test.id}/scan`);
                                }}
                                disabled={!test.class_id}
                                className={cn(
                                  "group flex-1 flex items-center rounded-2xl px-4 py-3.5 shadow-sm border active:scale-[0.98] transition-all text-left",
                                  completed
                                    ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
                                    : "bg-white border-gray-100 hover:border-indigo-100",
                                  !test.class_id && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <div className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mr-3",
                                  completed ? "bg-emerald-100" : "bg-indigo-50 group-hover:bg-indigo-100"
                                )}>
                                  {completed
                                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                                    : <FileText size={16} className="text-indigo-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-bold truncate leading-snug", completed ? "text-emerald-800" : "text-gray-900")}>
                                    {test.topic}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-xs text-gray-400">{formatDate(test.conducted_on)}</span>
                                    <span className="text-gray-300">·</span>
                                    <span className={cn("text-xs font-bold", completed ? "text-emerald-600" : "text-indigo-500")}>
                                      {test.total_marks}m
                                    </span>
                                    {test.subject && (
                                      <><span className="text-gray-300">·</span>
                                      <span className="text-xs text-gray-400 truncate">{test.subject}</span></>
                                    )}
                                  </div>
                                  {completed && (
                                    <p className="text-[10px] font-black tracking-wide uppercase text-emerald-600 mt-0.5">
                                      ✓ All {test.total} scanned
                                    </p>
                                  )}
                                  {inProgress && (
                                    <p className="text-[10px] font-semibold text-indigo-500 mt-0.5">
                                      {test.scanned} of {test.total} scanned
                                    </p>
                                  )}
                                </div>
                              </button>
                              {test.class_id && (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/scanner/${test.class_id}/tests/${test.id}/multi-scan`)}
                                  className={cn(
                                    "shrink-0 w-[56px] rounded-2xl flex flex-col items-center justify-center gap-1 shadow-md active:scale-95 transition-transform",
                                    completed
                                      ? "bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-emerald-200/60"
                                      : "bg-gradient-to-b from-indigo-600 to-indigo-700 shadow-indigo-200/60"
                                  )}
                                >
                                  <ScanLine size={20} className="text-white" />
                                  <span className="text-[9px] font-black tracking-wide text-white/80 uppercase">Scan</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Worksheets section ── */}
              {worksheetGroups.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={13} className="text-violet-500 shrink-0" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-500">Worksheets</p>
                  </div>
                  {worksheetGroups.map((group, gi) => (
                    <div key={gi}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 px-1">
                        {group.cls
                          ? `Grade ${group.cls.grade}${group.cls.section ? ` · Sec ${group.cls.section}` : ""} — ${group.cls.name}`
                          : "No class assigned"}
                      </p>
                      <div className="space-y-2.5">
                        {group.worksheets.map(ws => {
                          const completed  = ws.total > 0 && ws.scanned >= ws.total;
                          const inProgress = !completed && ws.scanned > 0;
                          return (
                            <div key={ws.id} className="flex items-stretch gap-2">
                              <div className={cn(
                                "group flex-1 flex items-center rounded-2xl px-4 py-3.5 shadow-sm border",
                                completed
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-white border-gray-100"
                              )}>
                                <div className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mr-3",
                                  completed ? "bg-emerald-100" : "bg-violet-50"
                                )}>
                                  {completed
                                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                                    : <ClipboardList size={16} className="text-violet-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-bold truncate leading-snug", completed ? "text-emerald-800" : "text-gray-900")}>
                                    {ws.topic}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-xs text-gray-400">{formatDate(ws.created_at)}</span>
                                    <span className="text-gray-300">·</span>
                                    <span className={cn("text-xs font-bold", completed ? "text-emerald-600" : "text-violet-500")}>
                                      {ws.total_marks}m
                                    </span>
                                    {ws.subject && (
                                      <><span className="text-gray-300">·</span>
                                      <span className="text-xs text-gray-400 truncate">{ws.subject}</span></>
                                    )}
                                  </div>
                                  {completed && (
                                    <p className="text-[10px] font-black tracking-wide uppercase text-emerald-600 mt-0.5">
                                      ✓ All {ws.total} scanned
                                    </p>
                                  )}
                                  {inProgress && (
                                    <p className="text-[10px] font-semibold text-violet-500 mt-0.5">
                                      {ws.scanned} of {ws.total} scanned
                                    </p>
                                  )}
                                </div>
                              </div>
                              {ws.class_id && (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/scanner/worksheet/${ws.id}/multi-scan`)}
                                  className={cn(
                                    "shrink-0 w-[56px] rounded-2xl flex flex-col items-center justify-center gap-1 shadow-md active:scale-95 transition-transform",
                                    completed
                                      ? "bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-emerald-200/60"
                                      : "bg-gradient-to-b from-violet-600 to-violet-700 shadow-violet-200/60"
                                  )}
                                >
                                  <ScanLine size={20} className="text-white" />
                                  <span className="text-[9px] font-black tracking-wide text-white/80 uppercase">Scan</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center text-xs text-gray-400 pb-4 leading-relaxed px-2">
                Tap <span className="font-bold text-indigo-500">Scan</span> on a test or <span className="font-bold text-violet-500">Scan</span> on a worksheet to photograph each student&apos;s pages — AI grades automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Not connected: enter the teacher code ───────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] pb-safe">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-300/40">
            <BookOpen size={36} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Enter Teacher Code</h1>
            <p className="text-sm text-gray-400 mt-1.5">Ask your teacher for their 6-letter scanner code</p>
          </div>
        </div>

        <form onSubmit={handleCodeConnect} className="space-y-3">
          <input
            type="text"
            placeholder="E.G. K7M2P9"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full px-5 py-5 rounded-2xl border-2 border-gray-100 bg-white text-2xl font-black text-center text-gray-900 placeholder:text-gray-200 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent tracking-[0.4em] uppercase shadow-sm transition-all"
          />

          {codeError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <span className="text-red-400">⚠</span>
              <p className="text-sm text-red-600 font-medium">{codeError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={codeLoading}
            className={cn(
              "w-full py-4 rounded-2xl text-white font-black text-base active:scale-[0.97] transition-all flex items-center justify-center gap-2",
              codeLoading
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-xl shadow-indigo-200 hover:shadow-indigo-300"
            )}
          >
            {codeLoading ? <><Spinner size="sm" /> Connecting…</> : <>Connect <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
