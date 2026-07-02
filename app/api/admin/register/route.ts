import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { upsertAdmin, createSchool } from '@/lib/admin-queries'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const { name, email, password, schoolName } = await req.json()
  if (!name || !email || !password || !schoolName) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Sign up failed' }, { status: 400 })
  }

  const ac = createAdminClient()
  const schoolId = randomUUID()
  const adminId = data.user.id
  const now = new Date().toISOString()

  try {
    await createSchool({
      id: schoolId,
      name: schoolName,
      joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdBy: adminId,
      createdAt: now,
    }, ac)

    await upsertAdmin({
      id: adminId,
      userId: adminId,
      name,
      email,
      schoolId,
      createdAt: now,
    }, ac)
  } catch (err) {
    // Rollback: remove school row and Supabase auth user to avoid orphaned state
    await ac.from('schools').delete().eq('id', schoolId)
    await ac.auth.admin.deleteUser(adminId)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  // If email confirmation is enabled, Supabase won't create a session on signUp.
  // In that case skip the auto-login and ask the user to confirm their email first.
  if (!data.session) {
    return NextResponse.json({ requiresEmailConfirmation: true })
  }

  // Email confirmation disabled — sign in immediately
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError || !signInData.user) {
    return NextResponse.json({ error: 'Registered but sign-in failed. Please log in manually.' }, { status: 500 })
  }

  const res = NextResponse.json({ adminId, schoolId })
  res.cookies.set('edu-role', 'admin', { path: '/', sameSite: 'strict', maxAge: 60 * 60 * 24 * 7 })
  res.cookies.set('edu-session', '1', { path: '/', sameSite: 'strict', maxAge: 60 * 60 * 24 * 7 })
  return res
}
