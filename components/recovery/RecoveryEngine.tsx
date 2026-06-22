'use client'
import { useState } from 'react'
import { Lightbulb, ThumbsUp, ThumbsDown, Minus, RefreshCw } from 'lucide-react'
import type { RecoveryAttempt } from '@/lib/types'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'

interface Props {
  studentId: string
  studentName: string
  topic: string
  grade: string
  attempts: number
  previousAttempts: RecoveryAttempt[]
  onSaveFeedback: (attempt: RecoveryAttempt) => Promise<void>
}

interface Approach {
  explanation: string
  example: string
  checkQuestion: string
}

export default function RecoveryEngine({
  studentId, studentName, topic, grade, attempts,
  previousAttempts, onSaveFeedback,
}: Props) {
  const [approach, setApproach] = useState<Approach | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)

  const generateApproach = async () => {
    setLoading(true)
    setError('')
    setFeedbackSaved(false)
    try {
      const previousApproaches = previousAttempts.map((a) => a.approachUsed)
      const prevKey = [...previousApproaches].sort().join('~~')
      const ck = aiKey('recovery', { topic: topic.toLowerCase().trim(), grade, attempts, prevKey })
      const cached = getAiCache<Approach>(ck)
      if (cached) { setApproach(cached); setLoading(false); return }
      const res = await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, topic, attempts, previousApproaches, studentName }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAiCache(ck, data, TTL.ONE_WEEK)
      setApproach(data)
    } catch {
      setError('Could not generate approach. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = async (helped: boolean | null) => {
    if (!approach) return
    const record: RecoveryAttempt = {
      id: crypto.randomUUID(),
      studentId,
      topic,
      approachUsed: approach.explanation.slice(0, 120),
      helped,
      generatedAt: new Date().toISOString(),
    }
    await onSaveFeedback(record)
    setFeedbackSaved(true)
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
          <Lightbulb size={18} className="text-orange-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Try a Different Approach</p>
          <p className="text-xs text-gray-500">{topic} · {previousAttempts.length} previous tries</p>
        </div>
      </div>

      {!approach && !loading && (
        <button onClick={generateApproach} className="btn-primary w-full">
          Generate New Approach
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6 gap-3">
          <RefreshCw size={20} className="animate-spin text-blue-600" />
          <span className="text-gray-600">Thinking of a new way to explain…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {approach && !loading && (
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">New Explanation</p>
            <p className="text-gray-700 text-base leading-relaxed">{approach.explanation}</p>
          </div>

          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">📍 Indian Example to Use</p>
            <p className="text-gray-700 text-base leading-relaxed">{approach.example}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">❓ Check Understanding</p>
            <p className="text-gray-700 text-base italic">&ldquo;{approach.checkQuestion}&rdquo;</p>
          </div>

          {!feedbackSaved ? (
            <div>
              <p className="text-sm text-center text-gray-500 mb-2">Did this help after class?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-100 text-green-700 rounded-xl font-semibold text-sm"
                >
                  <ThumbsUp size={16} /> Yes
                </button>
                <button
                  onClick={() => handleFeedback(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm"
                >
                  <Minus size={16} /> Partially
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-600 rounded-xl font-semibold text-sm"
                >
                  <ThumbsDown size={16} /> No
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-green-700 font-semibold">✓ Feedback saved</p>
              <button
                onClick={generateApproach}
                className="btn-ghost text-sm mt-2"
              >
                Try another approach
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
