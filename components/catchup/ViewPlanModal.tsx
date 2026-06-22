'use client'
import { X, BookOpen, HelpCircle, Zap, AlertCircle } from 'lucide-react'
import type { CatchupMaterial } from '@/lib/types'

interface Props {
  plan: CatchupMaterial
  onClose: () => void
}

export default function ViewPlanModal({ plan, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(7,21,58,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(7,21,58,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Catch-up Plan</p>
            <p className="font-black text-slate-900 text-base leading-tight">{plan.studentName}</p>
            <p className="text-xs text-slate-400 font-medium">{plan.topic} · {plan.subject} Grade {plan.grade}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Focus note */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-start gap-2.5">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Teacher Focus</p>
              <p className="text-sm font-semibold text-slate-800">{plan.focusNote}</p>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={13} className="text-blue-500" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Explanation for Student</p>
            </div>
            <div className="bg-slate-50 rounded-2xl px-4 py-3">
              <p className="text-sm text-slate-700 leading-relaxed">{plan.explanation}</p>
            </div>
          </div>

          {/* Practice questions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle size={13} className="text-blue-500" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Practice Questions</p>
            </div>
            <div className="space-y-2">
              {plan.practiceQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                  <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-slate-700">{q}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-blue-500" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">10-min Activity</p>
            </div>
            <div className="bg-slate-50 rounded-2xl px-4 py-3">
              <p className="text-sm text-slate-700 leading-relaxed">{plan.activity}</p>
            </div>
          </div>

        </div>

        <div className="px-5 pb-6 pt-3 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
