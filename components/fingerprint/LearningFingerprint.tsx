import { BookOpen, Star, TrendingUp, TrendingDown, Minus, Calendar, Zap, Target } from 'lucide-react'
import type { Fingerprint, TopicMastery } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { getMasteryBarColor, getMasteryLabel, getMasteryColor } from '@/lib/logic/mastery'

interface Props {
  fingerprint: Fingerprint
  mastery: TopicMastery[]
  attendanceRate: number
}

function SparkLine({ rate }: { rate: number }) {
  const bars = [0.4, 0.5, 0.45, 0.55, 0.6, 0.65, rate]
  return (
    <div className="flex items-end gap-0.5 h-6">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-2 rounded-sm bg-blue-400 transition-all"
          style={{ height: `${h * 100}%`, opacity: i === bars.length - 1 ? 1 : 0.4 + i * 0.08 }}
        />
      ))}
    </div>
  )
}

export default function LearningFingerprint({ fingerprint, mastery, attendanceRate }: Props) {
  const { learningStyle, isConsistent, peakDay, strongTopics, weakTopics, improvementRate } = fingerprint

  const trendIcon = improvementRate > 0.02 ? TrendingUp : improvementRate < -0.02 ? TrendingDown : Minus
  const TrendIcon = trendIcon
  const trendColor = improvementRate > 0.02 ? 'text-green-600' : improvementRate < -0.02 ? 'text-red-500' : 'text-gray-500'
  const trendLabel = improvementRate > 0.02 ? 'Improving' : improvementRate < -0.02 ? 'Declining' : 'Stable'

  return (
    <div className="space-y-3">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <BookOpen size={18} className="text-purple-600" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Learning Style</p>
          <p className="font-bold text-gray-900 capitalize mt-0.5">
            {learningStyle === 'story-based' ? '📖 Story' : '🔢 Analytical'}
          </p>
        </div>

        <div className="card text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <TrendIcon size={18} className={trendColor} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Trend</p>
          <p className={`font-bold mt-0.5 ${trendColor}`}>{trendLabel}</p>
        </div>

        <div className="card text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Calendar size={18} className="text-green-600" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Best Day</p>
          <p className="font-bold text-gray-900 mt-0.5">{peakDay}</p>
        </div>

        <div className="card text-center">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Zap size={18} className="text-amber-600" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Consistency</p>
          <p className={`font-bold mt-0.5 ${isConsistent ? 'text-green-600' : 'text-yellow-600'}`}>
            {isConsistent ? 'Consistent' : 'Variable'}
          </p>
        </div>
      </div>

      {/* Attendance */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 mb-2">Attendance</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${attendanceRate >= 0.75 ? 'bg-green-500' : attendanceRate >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${attendanceRate * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-900 w-10 text-right">
            {Math.round(attendanceRate * 100)}%
          </span>
        </div>
      </div>

      {/* Topic Mastery */}
      {mastery.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-3">Topic Mastery</p>
          <div className="space-y-3">
            {mastery.map((t) => (
              <div key={t.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{t.topic}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getMasteryColor(t.mastery)}`}>
                    {getMasteryLabel(t.mastery)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getMasteryBarColor(t.mastery)}`}
                      style={{ width: `${t.mastery * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {Math.round(t.mastery * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{t.attempts} attempt{t.attempts !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong / Weak Topics */}
      {(strongTopics.length > 0 || weakTopics.length > 0) && (
        <div className="card">
          <div className="grid grid-cols-2 gap-3">
            {strongTopics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <Star size={12} /> Strong
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {strongTopics.map((t) => (
                    <Badge key={t} variant="green">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {weakTopics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <Target size={12} /> Needs Work
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weakTopics.map((t) => (
                    <Badge key={t} variant="red">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
