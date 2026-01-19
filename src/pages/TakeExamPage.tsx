import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PASS_PERCENT, computeLetterGrade, computeScorePercent, formatScorePercent } from '@/utils/grading'

type Question = {
  _id: string
  type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload'
  content: string
  options?: string[]
}

type AttemptResponse = {
  attempt: {
    id: string
    startedAt: string
    expiresAt?: string
    submittedAt?: string
    answers: Array<{ question?: string; answer: any }>
    pointsAwarded?: number
    pointsTotal?: number
    needsReview?: boolean
    scorePercent?: number
    grade?: string | null
    passed?: boolean | null
    autoSubmitted?: boolean
  }
  exam: {
    _id: string
    title: string
    description?: string
    date: string
    durationMinutes?: number
    questionIds?: Question[]
  }
}

export function TakeExamPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const user = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<AttemptResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<{ pointsAwarded: number; pointsTotal: number; needsReview: boolean } | null>(null)
  const [submitMeta, setSubmitMeta] = useState<{ scorePercent: number; grade: string | null; passed: boolean | null } | null>(null)

  const autoSubmitRef = useRef(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token ?? ''}` }), [token])

  useEffect(() => {
    async function start() {
      if (!id) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/exams/${id}/attempts`, {
          method: 'POST',
          headers: { ...authHeaders },
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || 'Failed to start exam')
        }
        const payload = (await res.json()) as AttemptResponse
        setData(payload)

        // Immediately lock navigation for students during an active attempt.
        try {
          if (user?.role === 'student' && !payload.attempt.submittedAt) {
            sessionStorage.setItem('ems.activeExamId', payload.exam._id)
          }
          if (payload.attempt.submittedAt) {
            sessionStorage.removeItem('ems.activeExamId')
          }
        } catch {
          // ignore
        }

        if (payload.attempt.submittedAt) {
          setSubmitResult({
            pointsAwarded: Number(payload.attempt.pointsAwarded ?? 0),
            pointsTotal: Number(payload.attempt.pointsTotal ?? 0),
            needsReview: Boolean(payload.attempt.needsReview),
          })

          const pointsAwarded = Number(payload.attempt.pointsAwarded ?? 0)
          const pointsTotal = Number(payload.attempt.pointsTotal ?? 0)
          const fallbackPct = computeScorePercent(pointsAwarded, pointsTotal)
          const scorePercent = typeof payload.attempt.scorePercent === 'number' ? payload.attempt.scorePercent : fallbackPct
          const isFinal = !(payload.attempt.needsReview && !payload.attempt.grade)
          const grade = typeof payload.attempt.grade === 'string'
            ? payload.attempt.grade
            : (isFinal ? computeLetterGrade(scorePercent) : null)
          const passed = typeof payload.attempt.passed === 'boolean'
            ? payload.attempt.passed
            : (isFinal ? scorePercent >= PASS_PERCENT : null)
          setSubmitMeta({ scorePercent, grade, passed })
        }

        const initial: Record<string, any> = {}
        for (const a of payload.attempt.answers ?? []) {
          if (a.question) initial[a.question] = a.answer
        }

        // Merge in local draft (helps survive transient network issues)
        try {
          const key = `ems_attempt_${payload.attempt.id}`
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw) as { answers?: Record<string, any> }
            if (parsed?.answers && typeof parsed.answers === 'object') {
              Object.assign(initial, parsed.answers)
            }
          }
        } catch {
          // ignore
        }

        setAnswers(initial)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start exam')
      } finally {
        setLoading(false)
      }
    }
    void start()
  }, [API_BASE, authHeaders, id])

  // Timer + auto-submit
  useEffect(() => {
    if (!data?.attempt.expiresAt) {
      setTimeLeftMs(null)
      return
    }
    if (data.attempt.submittedAt) {
      setTimeLeftMs(0)
      return
    }

    const expiresAt = new Date(data.attempt.expiresAt).getTime()
    const tick = () => {
      const left = Math.max(0, expiresAt - Date.now())
      setTimeLeftMs(left)
      if (left === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true
        void handleSubmit(true)
      }
    }

    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [data?.attempt.expiresAt, data?.attempt.submittedAt])

  // Persist local draft and autosave to server periodically
  useEffect(() => {
    if (!data?.attempt.id) return
    const key = `ems_attempt_${data.attempt.id}`
    try {
      localStorage.setItem(key, JSON.stringify({ answers, updatedAt: new Date().toISOString() }))
    } catch {
      // ignore
    }
  }, [answers, data?.attempt.id])

  useEffect(() => {
    if (!data?.attempt.id) return
    if (data.attempt.submittedAt) return

    const attemptId = data.attempt.id
    const autosave = async () => {
      setSaving(true)
      setSaveError(null)
      try {
        const questions = data?.exam.questionIds ?? []
        const body = {
          answers: questions.map((q) => ({ question: q._id, answer: answers[q._id] })),
        }

        const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/autosave`, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          let msg = 'Autosave failed'
          try {
            const j = await res.json()
            msg = String(j?.error ?? j?.message ?? msg)
          } catch {
            // ignore
          }
          throw new Error(msg)
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Autosave failed')
      } finally {
        setSaving(false)
      }
    }

    // Save every 10 seconds
    const t = window.setInterval(() => void autosave(), 10_000)
    return () => window.clearInterval(t)
  }, [API_BASE, authHeaders, answers, data])

  const questions = data?.exam.questionIds ?? []

  const handleSubmit = async (isAuto = false) => {
    if (!data) return
    setSubmitting(true)
    setError('')
    setSaveError(null)

    try {
      const body = {
        answers: questions.map((q) => ({
          question: q._id,
          answer: answers[q._id],
        })),
      }

      const res = await fetch(`${API_BASE}/api/exams/attempts/${data.attempt.id}/submit`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Submit failed')
      }

      const result = (await res.json()) as {
        pointsAwarded: number
        pointsTotal: number
        needsReview: boolean
        scorePercent?: number
        grade?: string | null
        passed?: boolean | null
      }
      setSubmitResult({
        pointsAwarded: Number(result.pointsAwarded ?? 0),
        pointsTotal: Number(result.pointsTotal ?? 0),
        needsReview: Boolean(result.needsReview),
      })

      const pointsAwarded = Number(result.pointsAwarded ?? 0)
      const pointsTotal = Number(result.pointsTotal ?? 0)
      const fallbackPct = computeScorePercent(pointsAwarded, pointsTotal)
      const scorePercent = typeof result.scorePercent === 'number' ? result.scorePercent : fallbackPct
      const isFinal = !result.needsReview
      const grade = typeof result.grade === 'string' ? result.grade : (isFinal ? computeLetterGrade(scorePercent) : null)
      const passed = typeof result.passed === 'boolean' ? result.passed : (isFinal ? scorePercent >= PASS_PERCENT : null)
      setSubmitMeta({ scorePercent, grade, passed })

      // Exam finished; unlock navigation for students.
      try {
        if (user?.role === 'student') sessionStorage.removeItem('ems.activeExamId')
      } catch {
        // ignore
      }

      if (!isAuto) {
        // stay on page so student can see outcome
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const uploadImageAnswer = async (attemptId: string, questionId: string, file: File) => {
    const fd = new FormData()
    fd.append('image', file)

    const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/questions/${questionId}/image`, {
      method: 'POST',
      headers: {
        ...authHeaders,
      },
      body: fd,
    })
    if (!res.ok) {
      let msg = 'Image upload failed'
      try {
        const j = await res.json()
        msg = String(j?.error ?? j?.message ?? msg)
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
    const payload = (await res.json()) as { question: string; answer: any }
    setAnswers((prev) => ({ ...prev, [payload.question]: payload.answer }))
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8">Loading...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Take Exam</CardTitle>
              <CardDescription className="text-red-600">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/exams')}>
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{data?.exam.title}</CardTitle>
            <CardDescription>{data?.exam.description || 'Answer all questions and submit.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Start:</strong> {data?.exam.date ? new Date(data.exam.date).toLocaleString() : '—'}
            </div>
            <div>
              <strong>Duration:</strong> {data?.exam.durationMinutes ?? 60} minutes
            </div>
            {timeLeftMs != null && (
              <div>
                <strong>Time left:</strong>{' '}
                {Math.floor(timeLeftMs / 60000)}:{String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')}
              </div>
            )}
            <div>
              <strong>Questions:</strong> {questions.length}
            </div>
            {saving && <div className="text-xs text-gray-600">Saving…</div>}
            {saveError && <div className="text-xs text-red-600">{saveError}</div>}
          </CardContent>
        </Card>

        {submitResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submitted</CardTitle>
              <CardDescription>
                {submitResult.needsReview
                  ? 'Submitted successfully. Some answers require manual review.'
                  : 'Submitted successfully. Your result is available now.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <strong>Result:</strong>{' '}
                {submitMeta
                  ? `${formatScorePercent(submitMeta.scorePercent)}${submitMeta.grade ? ` (${submitMeta.grade})` : ''}${typeof submitMeta.passed === 'boolean' ? (submitMeta.passed ? ' — Pass' : ' — Fail') : ''}`
                  : '—'}
              </div>
              <div>
                <strong>Points:</strong> {submitResult.pointsAwarded}/{submitResult.pointsTotal}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/exams')}>Back to Exams</Button>
                <Button variant="outline" onClick={() => navigate('/grades')}>Grades</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {questions.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-gray-600">
              This exam has no questions yet.
            </CardContent>
          </Card>
        ) : submitResult ? null : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={q._id}>
                <CardHeader>
                  <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                  <CardDescription>{q.type}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">{q.content}</div>

                  {q.type === 'essay' && (
                    <textarea
                      className="w-full border rounded p-2 text-sm"
                      rows={4}
                      value={answers[q._id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))}
                    />
                  )}

                  {q.type === 'tf' && (
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={q._id}
                          checked={answers[q._id] === true}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: true }))}
                        />
                        True
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={q._id}
                          checked={answers[q._id] === false}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: false }))}
                        />
                        False
                      </label>
                    </div>
                  )}

                  {q.type === 'multiple-choice' && (
                    <div className="space-y-2 text-sm">
                      {(q.options ?? []).map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={q._id}
                            checked={answers[q._id] === opt}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: opt }))}
                          />
                          {opt}
                        </label>
                      ))}
                      {(q.options ?? []).length === 0 && <div className="text-gray-600">No options provided.</div>}
                    </div>
                  )}

                  {q.type === 'image-upload' && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          id={`img-${q._id}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file || !data?.attempt.id) return
                            void uploadImageAnswer(data.attempt.id, q._id, file).catch((err) => {
                              setError(err instanceof Error ? err.message : 'Image upload failed')
                            })
                          }}
                        />
                        <Button asChild variant="outline" size="sm">
                          <label htmlFor={`img-${q._id}`} className="cursor-pointer">Upload image</label>
                        </Button>
                        <span className="text-xs text-muted-foreground">PNG/JPG</span>
                      </div>
                      {answers[q._id]?.path && (
                        <div className="text-xs text-gray-600">
                          Uploaded:{' '}
                          <a
                            className="text-blue-600 hover:underline"
                            href={`${API_BASE}${answers[q._id].path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {answers[q._id].originalName ?? 'image'}
                          </a>
                          <img
                            src={`${API_BASE}${answers[q._id].path}`}
                            alt="Uploaded answer"
                            className="mt-2 max-h-56 w-auto rounded border"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/exams')}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmit(false)} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
