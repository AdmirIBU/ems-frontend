import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { computeLetterGrade, computeScorePercent, formatScorePercent } from '@/utils/grading'

type Question = {
  _id: string
  type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload'
  content: string
  options?: string[]
  points?: number
}

type AttemptAnswer = {
  question?: string
  answer: any
  isCorrect?: boolean
  pointsAwarded?: number
  maxPoints?: number
}

type Payload = {
  attempt: {
    _id: string
    submittedAt?: string
    pointsAwarded?: number
    pointsTotal?: number
    needsReview?: boolean
    reviewRequested?: boolean
    reviewRequestedAt?: string
    reviewRequestMessage?: string
    reviewResponseMessage?: string
    reviewAppointmentAt?: string
    reviewRespondedAt?: string
    gradedAt?: string
    scorePercent?: number
    grade?: string | null
    passed?: boolean | null
    answers?: AttemptAnswer[]
  }
  exam: {
    _id: string
    title: string
    course?: { title?: string; courseCode?: string }
    questionIds?: Question[]
  }
}

export function StudentAttemptReviewPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestingReview, setRequestingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token ?? ''}` }), [token])

  useEffect(() => {
    async function load() {
      if (!attemptId || !token) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}`, {
          headers: authHeaders,
        })
        if (!res.ok) {
          let msg = 'Failed to load attempt'
          try {
            const j = await res.json()
            msg = String(j?.error ?? j?.message ?? msg)
          } catch {
            // ignore
          }
          throw new Error(msg)
        }
        const payload = (await res.json()) as Payload
        setData(payload)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load attempt')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [API_BASE, attemptId, authHeaders, token])

  const questions = data?.exam?.questionIds ?? []
  const answers = Array.isArray(data?.attempt?.answers) ? data!.attempt.answers! : []
  const answerByQuestionId = new Map(
    answers
      .filter((a) => a.question)
      .map((a) => [String(a.question), a])
  )

  const courseLine = data?.exam?.course?.title
    ? `${data.exam.course.title}${data.exam.course.courseCode ? ` (${data.exam.course.courseCode})` : ''}`
    : undefined

  const status = (() => {
    if (!data?.attempt?.submittedAt) return 'Not submitted'
    if (data.attempt.needsReview && !data.attempt.gradedAt) return 'Pending review'
    return 'Reviewed'
  })()

  const canRequestReview = Boolean(
    data?.attempt?.submittedAt && !(data?.attempt?.reviewRequested ?? false)
  )

  const requestReview = async () => {
    if (!attemptId || !token) return
    setRequestingReview(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/request-review`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: reviewMessage.trim() ? reviewMessage : undefined }),
      })
      if (!res.ok) {
        let msg = 'Failed to request review'
        try {
          const j = await res.json()
          msg = String(j?.error ?? j?.message ?? msg)
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      const j = (await res.json()) as { reviewRequested?: boolean; reviewRequestedAt?: string }
      setData((prev) =>
        prev
          ? {
              ...prev,
              attempt: {
                ...prev.attempt,
                reviewRequested: j.reviewRequested ?? true,
                reviewRequestedAt: j.reviewRequestedAt,
                reviewRequestMessage: reviewMessage.trim() ? reviewMessage.trim() : prev.attempt.reviewRequestMessage,
              },
            }
          : prev
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to request review')
    } finally {
      setRequestingReview(false)
    }
  }

  const resultLine = (() => {
    if (!data?.attempt) return ''
    const pointsAwarded = Number(data.attempt.pointsAwarded ?? 0)
    const pointsTotal = Number(data.attempt.pointsTotal ?? 0)
    const fallbackPct = computeScorePercent(pointsAwarded, pointsTotal)
    const scorePercent = typeof data.attempt.scorePercent === 'number' ? data.attempt.scorePercent : fallbackPct
    const isFinal = !(data.attempt.needsReview && !data.attempt.gradedAt)
    const grade = typeof data.attempt.grade === 'string' ? data.attempt.grade : (isFinal ? computeLetterGrade(scorePercent) : null)
    const passed = typeof data.attempt.passed === 'boolean' ? data.attempt.passed : (isFinal ? scorePercent >= 55 : null)
    return `${formatScorePercent(scorePercent)}${grade ? ` (${grade})` : ''}${typeof passed === 'boolean' ? (passed ? ' — Pass' : ' — Fail') : ''}`
  })()

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Exam Review</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={requestReview}
              disabled={!canRequestReview || requestingReview || loading}
            >
              {requestingReview ? 'Requesting...' : (data?.attempt?.reviewRequested ? 'Review Requested' : 'Request Review')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/grades')}>Back to Grades</Button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !data ? null : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{data.exam.title}</CardTitle>
                <CardDescription>
                  {courseLine ? <span>{courseLine} — </span> : null}
                  {status}{resultLine ? ` — ${resultLine}` : ''} — {Number(data.attempt.pointsAwarded ?? 0)}/{Number(data.attempt.pointsTotal ?? 0)}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>
                  <strong>Submitted:</strong>{' '}
                  {data.attempt.submittedAt ? new Date(data.attempt.submittedAt).toLocaleString() : '—'}
                </div>
                <div>
                  <strong>Reviewed:</strong>{' '}
                  {data.attempt.gradedAt ? new Date(data.attempt.gradedAt).toLocaleString() : '—'}
                </div>
                <div>
                  <strong>Review requested:</strong>{' '}
                  {data.attempt.reviewRequestedAt ? new Date(data.attempt.reviewRequestedAt).toLocaleString() : (data.attempt.reviewRequested ? 'Yes' : 'No')}
                </div>
                {data.attempt.reviewRequestMessage ? (
                  <div>
                    <strong>Your message:</strong>{' '}
                    <span className="text-muted-foreground">{data.attempt.reviewRequestMessage}</span>
                  </div>
                ) : null}

                {(data.attempt.reviewAppointmentAt || data.attempt.reviewResponseMessage) ? (
                  <div className="pt-2">
                    <div className="font-medium">Professor response</div>
                    {data.attempt.reviewAppointmentAt ? (
                      <div>
                        <strong>Appointment:</strong>{' '}
                        {new Date(data.attempt.reviewAppointmentAt).toLocaleString()}
                      </div>
                    ) : null}
                    {data.attempt.reviewResponseMessage ? (
                      <div>
                        <strong>Message:</strong>{' '}
                        <span className="text-muted-foreground">{data.attempt.reviewResponseMessage}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {!data.attempt.reviewRequested ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request a review</CardTitle>
                  <CardDescription>Optionally include a short message to the professor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <textarea
                    className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Message (optional)"
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                  />
                  <Button onClick={requestReview} disabled={!canRequestReview || requestingReview || loading}>
                    {requestingReview ? 'Requesting...' : 'Request Review'}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <div className="space-y-4">
              {questions.map((q, idx) => {
                const a = answerByQuestionId.get(q._id)
                const maxPoints = typeof a?.maxPoints === 'number' ? a.maxPoints : (typeof q.points === 'number' ? q.points : 1)
                const pointsAwarded = typeof a?.pointsAwarded === 'number' ? a.pointsAwarded : 0
                const isCorrect = a?.isCorrect

                const renderAnswer = () => {
                  if (!a) return <span className="text-gray-600">No answer</span>

                  if (q.type === 'image-upload') {
                    const ans = a.answer
                    if (ans && typeof ans === 'object' && ans.path) {
                      return (
                        <a className="text-blue-600 hover:underline" href={`${API_BASE}${ans.path}`} target="_blank" rel="noreferrer">
                          View uploaded image
                        </a>
                      )
                    }
                    if (ans && typeof ans === 'object') {
                      return (
                        <div className="text-xs text-gray-700">
                          {'note' in ans && ans.note ? <div className="text-gray-600">{String(ans.note)}</div> : null}
                          <pre className="whitespace-pre-wrap bg-gray-50 border rounded p-2 overflow-auto">{JSON.stringify(ans, null, 2)}</pre>
                        </div>
                      )
                    }
                    return <span>{String(ans ?? '')}</span>
                  }

                  if (q.type === 'essay') {
                    return <div className="whitespace-pre-wrap">{String(a.answer ?? '')}</div>
                  }

                  return <span>{String(a.answer ?? '')}</span>
                }

                return (
                  <Card key={q._id}>
                    <CardHeader>
                      <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                      <CardDescription>{q.type}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="font-medium">{q.content}</div>

                      <div>
                        <strong>Your answer:</strong>
                        <div className="mt-1 border rounded p-2 bg-white">{renderAnswer()}</div>
                      </div>

                      {(q.type === 'multiple-choice' || q.type === 'tf') && (
                        <div>
                          <strong>Result:</strong>{' '}
                          {typeof isCorrect === 'boolean' ? (isCorrect ? 'Correct' : 'Incorrect') : '—'}
                        </div>
                      )}

                      <div>
                        <strong>Points:</strong> {pointsAwarded}/{maxPoints}
                      </div>

                      {(q.type === 'essay' || q.type === 'image-upload') && data.attempt.needsReview && !data.attempt.gradedAt && (
                        <div className="text-gray-600">Pending manual review</div>
                      )}
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
