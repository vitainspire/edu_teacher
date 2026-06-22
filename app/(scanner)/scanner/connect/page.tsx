"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/scanner/spinner";

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
}

export default function ConnectPage() {
  const router = useRouter();

  // Connection state
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState("");

  // Code-entry state
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Class-list state
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  const loadClasses = useCallback(async (tId: string) => {
    setClassesLoading(true);
    setClassesError(null);
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, grade, section")
      .eq("teacher_id", tId)
      .order("grade", { ascending: true });
    if (error) setClassesError(error.message);
    else setClasses((data ?? []) as ClassRow[]);
    setClassesLoading(false);
  }, []);

  // On mount: if already connected to a teacher, show their classes.
  useEffect(() => {
    const tId = localStorage.getItem("scanner_teacher_id");
    if (tId) {
      setTeacherId(tId);
      setTeacherName(localStorage.getItem("scanner_teacher_name") ?? "");
      void loadClasses(tId);
    }
  }, [loadClasses]);

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
    void loadClasses(t.id);
  }

  // ── Connected: show the teacher's class list ────────────────────────────────
  if (teacherId) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] pb-safe px-4 pt-6">
        <div className="w-full max-w-sm mx-auto space-y-5">
          <div className="text-center space-y-1">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{teacherName || "Teacher"}</p>
            <h1 className="text-xl font-black text-gray-900">Select a Class</h1>
            <p className="text-sm text-gray-400">Tap a class to start scanning answer sheets</p>
          </div>

          {classesLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : classesError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600 font-medium">{classesError}</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <BookOpen size={30} className="text-indigo-400" />
              </div>
              <p className="text-gray-500 font-semibold">No classes found</p>
              <p className="text-sm text-gray-400 mt-1">Ask the teacher to create a class in EduTeach.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => router.push(`/scanner/${cls.id}/tests`)}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
                    <span className="text-white font-black text-base leading-none">{cls.grade ?? "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-base">{cls.name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {cls.grade ? `Grade ${cls.grade}` : "—"}
                      {cls.section ? ` · Section ${cls.section}` : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              ))}
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
            <p className="text-sm text-gray-400 mt-1.5">Ask the teacher for their scanner code</p>
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
