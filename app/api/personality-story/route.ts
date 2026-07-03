import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'

const VALID_TRAITS = [
  'patience', 'kindness', 'honesty', 'courage', 'perseverance',
  'responsibility', 'respect', 'gratitude', 'empathy', 'fairness',
  'creativity', 'helpfulness',
] as const

const TRAIT_DESCRIPTIONS: Record<string, string> = {
  patience:       'staying calm and waiting without giving up when things take time',
  kindness:       'being warm and caring towards others through small acts of generosity',
  honesty:        'telling the truth even when it is hard, being trustworthy',
  courage:        'being brave, facing fears, trying new things even when scared',
  perseverance:   'not giving up even when something is very hard, trying again and again',
  responsibility: 'doing your duties, keeping promises, taking care of your things',
  respect:        'treating elders, classmates and surroundings with care and politeness',
  gratitude:      'being thankful for what you have, appreciating others around you',
  empathy:        'understanding how others feel, being kind when someone is sad',
  fairness:       'treating everyone equally, sharing, playing by the rules',
  creativity:     'using imagination to solve problems or make something new',
  helpfulness:    'helping others without expecting something in return',
}

// GET /api/personality-story?trait=patience&grade=5&name=Arjun
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const studentId = req.cookies.get('edu-student-id')?.value
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const trait       = searchParams.get('trait')?.trim().toLowerCase() ?? ''
  const grade       = searchParams.get('grade')?.trim() ?? '5'
  const studentName = searchParams.get('name')?.trim() ?? 'Student'

  if (!VALID_TRAITS.includes(trait as typeof VALID_TRAITS[number])) {
    return NextResponse.json({ error: 'Invalid trait' }, { status: 400 })
  }

  const t = Date.now()
  try {
    const { value, fromCache } = await withCache(
      ck('personality-story-v1', trait, grade),
      604800, // 7 days
      async () => {
        const prompt = buildStoryPrompt(trait, grade, studentName)
        const text = await callAI([{ role: 'user', content: prompt }], { maxTokens: 700 })
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const match = cleaned.match(/\{[\s\S]*\}/)
        return JSON.parse(match?.[0] ?? cleaned)
      },
    )
    apiLog({ route: 'personality-story', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json({
      trait,
      title:              typeof value.title === 'string' ? value.title : '',
      story:              typeof value.story === 'string' ? value.story : '',
      reflectionQuestion: typeof value.reflectionQuestion === 'string' ? value.reflectionQuestion : '',
    })
  } catch (err) {
    console.error('[personality-story] generation failed:', err)
    apiLog({ route: 'personality-story', ip, fromCache: false, durationMs: Date.now() - t, status: 'error' })
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 })
  }
}

function buildStoryPrompt(trait: string, grade: string, studentName: string): string {
  return `You are writing a short character-building story for a Grade ${grade} student in an Indian school. The story teaches the value of "${trait}" — ${TRAIT_DESCRIPTIONS[trait] ?? trait}.

Rules:
- Setting: Indian village, town, or school — use familiar scenes (cricket field, market, kitchen, classroom, farm, street).
- Characters: Indian children or family members. Give them common Indian names (like Arjun, Priya, Ravi, Meena, etc.).
- Length: exactly 3 short paragraphs, about 180 words total. Simple vocabulary for Grade ${grade}.
- Teach the value through ACTIONS, not explanation. Show the character doing something that demonstrates "${trait}".
- End with a warm, positive outcome.
- The reflection question must be personal — ask the reader (${studentName}) about a time they showed this quality.
- Do NOT state the moral explicitly. No "The lesson is..." or "This shows that..." sentences.

Return ONLY valid JSON with exactly these 3 fields:
{
  "title": "a short engaging story title (max 8 words)",
  "story": "the full 3-paragraph story here",
  "reflectionQuestion": "a warm open-ended question asking the reader about their own experience with ${trait}"
}`
}
