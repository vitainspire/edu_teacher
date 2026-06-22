'use client'
import { useState } from 'react'
import { PenLine, Plus, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/context'
import MarkEntry from '@/components/marks/MarkEntry'

type Step = 'list' | 'new-test' | 'enter-marks'

const TOPICS = [
  'Fractions', 'Algebra', 'Geometry', 'Decimals', 'Percentages',
  'Word Problems', 'Mensuration', 'Statistics', 'Ratio & Proportion',
  'Photosynthesis', 'Force & Motion', 'Light', 'Sound',
  'Reading Comprehension', 'Grammar', 'Essay Writing', 'Poetry',
]

export default function MarksPage() {
  const { teacher, tests, marks, getActiveStudents, createTest, saveMarks } = useApp()
  const [step, setStep] = useState<Step>('list')
  const [topic, setTopic] = useState('')
  const [totalMarks, setTotalMarks] = useState('10')
  const [conductedOn, setConductedOn] = useState(new Date().toISOString().split('T')[0])
  const [currentTestId, setCurrentTestId] = useState('')
  const [saving, setSaving] = useState(false)

  const activeStudents = getActiveStudents()

  const handleCreateTest = async () => {
    if (!topic.trim() || !totalMarks) return
    setSaving(true)
    const id = await createTest({
      subject: teacher?.subject ?? 'Mathematics',
      topic: topic.trim(),
      totalMarks: parseInt(totalMarks),
      conductedOn,
    })
    setCurrentTestId(id)
    setStep('enter-marks')
    setSaving(false)
  }

  const handleSaveMarks = async (entries: Array<{ studentId: string; score: number }>) => {
    await saveMarks(currentTestId, entries)
    setStep('list')
    setTopic('')
    setTotalMarks('10')
  }

  const currentTest = tests.find((t) => t.id === currentTestId)

  // Summarize tests for list view
  const testSummaries = tests
    .sort((a, b) => new Date(b.conductedOn).getTime() - new Date(a.conductedOn).getTime())
    .slice(0, 10)
    .map((t) => ({
      ...t,
      entryCount: marks.filter((m) => m.testId === t.id).length,
    }))

  if (step === 'new-test') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('list')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900">New Test</h1>
          </div>
        </div>
        <div className="px-4 py-4 space-y-5">
          <div>
            <label className="label">Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Fractions"
              className="input-field"
              autoFocus
            />
            {/* Quick topic chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {TOPICS.slice(0, 6).map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    topic === t ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Total Marks *</label>
            <div className="flex gap-2">
              {['5', '10', '20', '25', '50', '100'].map((n) => (
                <button
                  key={n}
                  onClick={() => setTotalMarks(n)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                    totalMarks === n ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={conductedOn}
              onChange={(e) => setConductedOn(e.target.value)}
              className="input-field"
            />
          </div>

          <button
            onClick={handleCreateTest}
            disabled={!topic.trim() || !totalMarks || saving}
            className="btn-primary w-full"
          >
            {saving ? 'Creating…' : `Start Entering Marks (${activeStudents.length} students)`}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'enter-marks' && currentTest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900">{currentTest.topic}</h1>
          <p className="text-sm text-gray-500">
            {teacher?.subject} · Out of {currentTest.totalMarks} ·{' '}
            {new Date(currentTest.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <div className="px-4 py-4">
          <MarkEntry
            students={activeStudents}
            totalMarks={currentTest.totalMarks}
            topic={currentTest.topic}
            onSave={handleSaveMarks}
            onCancel={() => setStep('list')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marks</h1>
            <p className="text-sm text-gray-500">{testSummaries.length} tests recorded</p>
          </div>
          <button
            onClick={() => setStep('new-test')}
            className="flex items-center gap-1.5 bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm"
          >
            <Plus size={16} /> New Test
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {testSummaries.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PenLine size={28} className="text-blue-600" />
            </div>
            <p className="text-lg font-semibold text-gray-800">No tests yet</p>
            <p className="text-gray-500 text-sm mt-1">Tap &quot;New Test&quot; to start entering marks</p>
            <button onClick={() => setStep('new-test')} className="btn-primary mt-5 px-6">
              Create First Test
            </button>
          </div>
        ) : (
          testSummaries.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <PenLine size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{t.topic}</p>
                <p className="text-sm text-gray-500">
                  {new Date(t.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                  Out of {t.totalMarks} · {t.entryCount}/{activeStudents.length} entered
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  t.entryCount >= activeStudents.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {t.entryCount >= activeStudents.length ? 'Complete' : 'Partial'}
                </span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
