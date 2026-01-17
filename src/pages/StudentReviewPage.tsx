import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { computeLetterGrade, computeScorePercent, formatScorePercent } from '@/utils/grading'

type StudentListItem = {
  id: string
  name: string
  email: string
  role?: string
  createdAt?: string
}

type ReviewPayload = {
  student: { _id: string; name: string; email: string; role?: string }
  breakdown: Array<{
    course: { _id: string; title: string; courseCode: string; ects: number }
    attempts: Array<{
      attemptId: string
      exam: { _id: string; title: string; date: string }
      submittedAt: string
      pointsAwarded: number
      pointsTotal: number
      needsReview: boolean
      gradedAt?: string
      scorePercent?: number
      grade?: string | null
      passed?: boolean | null
    }>
    stats: { passed: number; failed: number; total: number; passRatioThreshold: number }
  }>
}

export function StudentReviewPage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [students, setStudents] = useState<StudentListItem[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReviewPayload | null>(null)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token ?? ''}` }), [token])

  const loadById = async (studentId: string) => {
    setLoading(true)
    setError('')
    setData(null)

    try {
      const res = await fetch(`${API_BASE}/api/students/${studentId}/review`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to load student review')
      const payload = (await res.json()) as ReviewPayload
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student review')
    } finally {
      setLoading(false)
    }
  }

  const loadByEmail = async () => {
    setLoading(true)
    setError('')
    setData(null)

    try {
      const lookup = await fetch(`${API_BASE}/api/students/lookup?email=${encodeURIComponent(email)}`, {
        headers: authHeaders,
      })
      if (!lookup.ok) throw new Error('Student not found')
      const u = await lookup.json()
      const id = String(u.id ?? '')
      if (!id) throw new Error('Student not found')
      setSelectedStudentId(id)
      await loadById(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student review')
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setStudentsLoading(true)
      setStudentsError('')
      try {
        const res = await fetch(`${API_BASE}/api/students`, { headers: authHeaders })
        if (!res.ok) throw new Error('Failed to load students')
        const payload = (await res.json()) as StudentListItem[]
        if (!cancelled) setStudents(Array.isArray(payload) ? payload : [])
      } catch (err) {
        if (!cancelled) {
          setStudentsError(err instanceof Error ? err.message : 'Failed to load students')
          setStudents([])
        }
      } finally {
        if (!cancelled) setStudentsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [API_BASE, authHeaders])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Student Review</h1>

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Click a student to open their detailed review.</CardDescription>
          </CardHeader>
          <CardContent>
            {studentsError && <div className="text-red-600 mb-3">{studentsError}</div>}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b cursor-pointer hover:bg-gray-50 ${selectedStudentId === s.id ? 'bg-gray-50' : ''}`}
                      onClick={() => {
                        setSelectedStudentId(s.id)
                        setEmail(s.email)
                        void loadById(s.id)
                      }}
                    >
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="py-2">{s.email}</td>
                      <td className="py-2">{s.role ?? 'student'}</td>
                    </tr>
                  ))}

                  {!studentsLoading && students.length === 0 && (
                    <tr>
                      <td className="py-3 text-gray-600" colSpan={3}>
                        No students found.
                      </td>
                    </tr>
                  )}
                  {studentsLoading && (
                    <tr>
                      <td className="py-3 text-gray-600" colSpan={3}>
                        Loading students...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Find Student</CardTitle>
            <CardDescription>Enter student email to load profile and grades.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@email.com" />
            <Button onClick={() => void loadByEmail()} disabled={loading || !email}>
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </CardContent>
        </Card>

        {error && <div className="text-red-600">{error}</div>}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{data.student.name}</CardTitle>
                <CardDescription>{data.student.email}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <div>
                  <strong>Role:</strong> {data.student.role ?? 'student'}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {data.breakdown.map((b) => {
                const total = b.stats.total || 0
                const passedPct = total ? Math.round((b.stats.passed / total) * 100) : 0
                const failedPct = total ? 100 - passedPct : 0

                return (
                  <Card key={b.course._id}>
                    <CardHeader>
                      <CardTitle>{b.course.title} ({b.course.courseCode})</CardTitle>
                      <CardDescription>
                        ECTS: {b.course.ects} — Passed/Failed (threshold {Math.round(b.stats.passRatioThreshold * 100)}%)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm">Statistics</div>
                        <div className="h-3 w-full bg-gray-200 rounded overflow-hidden flex">
                          <div className="h-3 bg-primary" style={{ width: `${passedPct}%` }} />
                          <div className="h-3 bg-gray-400" style={{ width: `${failedPct}%` }} />
                        </div>
                        <div className="text-sm text-gray-600">
                          Passed: {b.stats.passed} — Failed: {b.stats.failed} — Total: {b.stats.total}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="py-2">Exam</th>
                              <th className="py-2">Date taken</th>
                              <th className="py-2">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.attempts.map((a) => (
                              <tr key={a.attemptId} className="border-b">
                                <td className="py-2">{a.exam?.title}</td>
                                <td className="py-2">{new Date(a.submittedAt).toLocaleString()}</td>
                                <td className="py-2">
                                  {(() => {
                                    const fallbackPct = computeScorePercent(a.pointsAwarded, a.pointsTotal)
                                    const scorePercent = typeof a.scorePercent === 'number' ? a.scorePercent : fallbackPct
                                    const isFinal = !(a.needsReview && !a.gradedAt)
                                    const grade = typeof a.grade === 'string' ? a.grade : (isFinal ? computeLetterGrade(scorePercent) : null)
                                    const passed = typeof a.passed === 'boolean' ? a.passed : (isFinal ? scorePercent >= 55 : null)
                                    const pending = !isFinal ? ' (pending)' : ''
                                    return `${formatScorePercent(scorePercent)}${grade ? ` (${grade})` : ''}${typeof passed === 'boolean' ? (passed ? ' — Pass' : ' — Fail') : ''}${pending}`
                                  })()}
                                </td>
                              </tr>
                            ))}
                            {b.attempts.length === 0 && (
                              <tr>
                                <td className="py-3 text-gray-600" colSpan={3}>No exams taken for this course.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
