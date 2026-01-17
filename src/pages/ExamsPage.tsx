import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ExamsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [exams, setExams] = useState<any[]>([])
  const [availableExams, setAvailableExams] = useState<any[]>([])
  const [submittedExamIds, setSubmittedExamIds] = useState<string[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [courseId, setCourseId] = useState('')
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [questionSelectionMode, setQuestionSelectionMode] = useState<'manual' | 'random'>('manual')
  const [randomConfig, setRandomConfig] = useState<{ mcCount: number; tfCount: number; imageCount: number; essayCount: number; shuffleOrder: boolean }>(
    { mcCount: 0, tfCount: 0, imageCount: 0, essayCount: 0, shuffleOrder: true }
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState<number | ''>(60)
  const [examType, setExamType] = useState('midterm')
  const [numQuestions, setNumQuestions] = useState<number | ''>(10)
  const skipNextCourseResetRef = useRef(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const user = userRaw ? JSON.parse(userRaw) : null
  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const API_BASE = import.meta.env.VITE_API_URL ?? ''

  const draftKey = 'ems.createExamDraft'

  const saveDraft = (next?: Partial<any>) => {
    try {
      const current = {
        title,
        description,
        date,
        duration,
        examType,
        numQuestions,
        courseId,
      }
      sessionStorage.setItem(draftKey, JSON.stringify({ ...current, ...(next ?? {}) }))
    } catch {
      // ignore storage errors
    }
  }

  const restoreDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      if (!d || typeof d !== 'object') return

      if (typeof d.title === 'string') setTitle(d.title)
      if (typeof d.description === 'string') setDescription(d.description)
      if (typeof d.date === 'string') setDate(d.date)
      if (typeof d.duration === 'number' || d.duration === '') setDuration(d.duration)
      if (typeof d.examType === 'string') setExamType(d.examType)
      if (typeof d.numQuestions === 'number' || d.numQuestions === '') setNumQuestions(d.numQuestions)

      if (typeof d.courseId === 'string' && d.courseId) {
        skipNextCourseResetRef.current = true
        setCourseId(d.courseId)
      }
    } catch {
      // ignore
    }
  }

  const applyExamQuestionConfig = (cfg: any) => {
    if (!cfg) return

    if (cfg.courseId && typeof cfg.courseId === 'string' && cfg.courseId !== courseId) {
      skipNextCourseResetRef.current = true
      setCourseId(cfg.courseId)
    }

    if (cfg.mode === 'manual') {
      setQuestionSelectionMode('manual')
      setSelectedQuestionIds(Array.isArray(cfg.selectedQuestionIds) ? cfg.selectedQuestionIds : [])
      if (typeof cfg.totalQuestions === 'number' && Number.isFinite(cfg.totalQuestions)) setNumQuestions(cfg.totalQuestions)
      return
    }

    if (cfg.mode === 'random') {
      setQuestionSelectionMode('random')
      setSelectedQuestionIds([])
      if (typeof cfg.totalQuestions === 'number' && Number.isFinite(cfg.totalQuestions)) setNumQuestions(cfg.totalQuestions)
      const rc = cfg.randomConfig ?? {}
      setRandomConfig({
        mcCount: Number(rc.mcCount ?? 0),
        tfCount: Number(rc.tfCount ?? 0),
        imageCount: Number(rc.imageCount ?? 0),
        essayCount: Number(rc.essayCount ?? 0),
        shuffleOrder: rc.shuffleOrder !== false,
      })
    }
  }

  const nowMs = Date.now()
  const isPastExam = (exam: any) => {
    const start = new Date(exam?.date).getTime()
    const duration = Number.isFinite(Number(exam?.durationMinutes)) ? Number(exam.durationMinutes) : 60
    const end = start + duration * 60_000
    return Number.isFinite(end) && end < nowMs
  }

  const isUpcomingExam = (exam: any) => {
    const start = new Date(exam?.date).getTime()
    return Number.isFinite(start) && start > nowMs
  }

  const studentUpcoming = exams.filter((e) => e?.published && !isPastExam(e) && isUpcomingExam(e))
  const activeOrUpcomingForStaff = exams.filter((e) => !isPastExam(e))

  useEffect(() => {
    fetchExams()
    if (token) fetchAvailable()
    if (token && isStudent) fetchSubmitted()
    if (token && isProfessorOrAdmin) fetchCourses()

    // Restore draft create-exam form values after navigation.
    restoreDraft()
  }, [])

  useEffect(() => {
    saveDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, date, duration, examType, numQuestions, courseId])

  useEffect(() => {
    const cfg = (location.state as any)?.examQuestionConfig
    if (cfg) applyExamQuestionConfig(cfg)
  }, [courseId, location.state])

  useEffect(() => {
    // Reset question configuration when course changes
    if (skipNextCourseResetRef.current) {
      skipNextCourseResetRef.current = false
      return
    }

    // If we have a saved config for this course, restore it instead of wiping.
    if (courseId) {
      try {
        const raw = sessionStorage.getItem(`ems.examQuestionConfig:${courseId}`)
        if (raw) {
          const saved = JSON.parse(raw)
          if (saved && saved.courseId === courseId) {
            applyExamQuestionConfig(saved)
            return
          }
        }
      } catch {
        // ignore
      }
    }

    setSelectedQuestionIds([])
    setQuestionSelectionMode('manual')
    setRandomConfig({ mcCount: 0, tfCount: 0, imageCount: 0, essayCount: 0, shuffleOrder: true })
  }, [courseId])

  const fetchExams = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/exams`)
      if (!res.ok) throw new Error('Failed to fetch exams')
      const data = await res.json()
      setExams(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailable = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/exams/available`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch available exams')
      const data = await res.json()
      setAvailableExams(Array.isArray(data) ? data : [])
    } catch (err) {
      // keep exams page usable even if this fails
      console.warn(err)
    }
  }

  const fetchSubmitted = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/grades`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch submitted exams')
      const data = await res.json()
      const ids = (Array.isArray(data) ? data : [])
        .map((g: any) => g?.exam?._id)
        .filter((id: any) => typeof id === 'string' && id.length > 0)
      setSubmittedExamIds(Array.from(new Set(ids)))
    } catch (err) {
      console.warn(err)
      setSubmittedExamIds([])
    }
  }

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/courses`)
      if (!res.ok) throw new Error('Failed to fetch courses')
      const data = await res.json()
      setCourses(Array.isArray(data) ? data : [])
    } catch (e) {
      console.warn(e)
      setCourses([])
    }
  }

  if (loading) return <div className="text-center mt-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Exams</h1>
          <div className="flex items-center gap-3">
            {token && isProfessorOrAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!token) return alert('Please log in')
                  if (!title || !date || !examType || numQuestions === '') return alert('Please fill required fields')
                  if (courseId && questionSelectionMode === 'manual' && selectedQuestionIds.length === 0) {
                    return alert('Configure questions (manual select) or use random selection')
                  }
                  setCreating(true)
                  try {
                    const normalizedDate = (() => {
                      // `datetime-local` provides a local-time string without timezone.
                      // Convert to an absolute instant so backend stores/display consistently across timezones.
                      const d = new Date(date)
                      return Number.isFinite(d.getTime()) ? d.toISOString() : date
                    })()
                    const res = await fetch(`${API_BASE}/api/exams`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        title,
                        description,
                        date: normalizedDate,
                        durationMinutes: duration || 60,
                        examType,
                        numQuestions,
                        courseId: courseId || undefined,
                        questionIds:
                          questionSelectionMode === 'manual' && selectedQuestionIds.length > 0 ? selectedQuestionIds : undefined,
                        questionSelectionMode: courseId ? questionSelectionMode : undefined,
                        randomQuestionConfig:
                          courseId && questionSelectionMode === 'random'
                            ? {
                                mcCount: randomConfig.mcCount,
                                tfCount: randomConfig.tfCount,
                                imageCount: randomConfig.imageCount,
                                essayCount: randomConfig.essayCount,
                                randomizePerStudent: true,
                                shuffleOrder: randomConfig.shuffleOrder,
                              }
                            : undefined,
                      }),
                    })
                    if (!res.ok) throw new Error('Failed to create exam')
                    const created = await res.json()
                    setExams((prev) => [created, ...prev])
                    setTitle('')
                    setDescription('')
                    setDate('')
                    setDuration(60)
                    setNumQuestions(10)
                    setCourseId('')
                    setSelectedQuestionIds([])
                    setQuestionSelectionMode('manual')
                    setRandomConfig({ mcCount: 0, tfCount: 0, imageCount: 0, essayCount: 0, shuffleOrder: true })

                    try {
                      sessionStorage.removeItem('ems.createExamDraft')
                    } catch {
                      // ignore
                    }
                  } catch (err) {
                    console.error(err)
                    alert('Create exam failed')
                  } finally {
                    setCreating(false)
                  }
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="border rounded p-2" required />
                  <input value={date} onChange={(e) => setDate(e.target.value)} type="datetime-local" className="border rounded p-2" required />
                  <input
                    value={duration}
                    onChange={(e) => {
                      const v = e.target.value
                      setDuration(v === '' ? '' : Number(v))
                    }}
                    type="number"
                    min={1}
                    className="border rounded p-2 w-28"
                    placeholder="Minutes"
                    title="Duration (minutes)"
                    required
                  />
                  <select value={examType} onChange={(e) => setExamType(e.target.value)} className="border rounded p-2">
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                    <option value="quiz">Quiz</option>
                  </select>
                  <input
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    type="number"
                    min={1}
                    className="border rounded p-2 w-24"
                    required
                  />
                  <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="border rounded p-2">
                    <option value="">Select course (optional)</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.title} ({c.courseCode})
                      </option>
                    ))}
                  </select>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="border rounded p-2 flex-1"
                  />
                </div>

                {courseId && (
                  <div className="border rounded p-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Questions</div>
                        <div className="text-xs text-gray-600">
                          {questionSelectionMode === 'manual'
                            ? selectedQuestionIds.length > 0
                              ? `Manual selection: ${selectedQuestionIds.length} selected`
                              : 'Manual selection: not configured'
                            : `Random selection: total ${numQuestions} (MC ${randomConfig.mcCount}, T/F ${randomConfig.tfCount}, IMG ${randomConfig.imageCount}, Essay ${randomConfig.essayCount})`}
                        </div>
                        {questionSelectionMode === 'random' && (
                          <div className="text-xs text-gray-600">Each student gets a randomized set and order.</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          (() => {
                            // Persist draft so coming back doesn't reset the form.
                            saveDraft()
                            navigate('/exams/questions', {
                              state: {
                                courseId,
                                mode: questionSelectionMode,
                                selectedQuestionIds,
                                randomConfig: {
                                  totalQuestions: typeof numQuestions === 'number' ? numQuestions : 10,
                                  mcCount: randomConfig.mcCount,
                                  tfCount: randomConfig.tfCount,
                                  imageCount: randomConfig.imageCount,
                                  essayCount: randomConfig.essayCount,
                                  shuffleOrder: randomConfig.shuffleOrder,
                                },
                              },
                            })
                          })()
                        }
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {!isProfessorOrAdmin && token && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Active Exams</h2>
            {availableExams.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600">No available exams right now.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {availableExams.map((exam) => (
                  <Card key={exam._id}>
                    <CardHeader>
                      <CardTitle>{exam.title}</CardTitle>
                      <CardDescription>
                        {exam.course?.title ? (
                          <span>
                            {exam.course.title}
                            {exam.course.courseCode ? ` (${exam.course.courseCode})` : ''}
                          </span>
                        ) : (
                          <span>{exam.description || 'No description'}</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">
                        <strong>Start:</strong> {new Date(exam.date).toLocaleString()}
                      </p>
                      <p className="text-sm">
                        <strong>Duration:</strong> {exam.durationMinutes} minutes
                      </p>
                      <p className="text-sm">
                        <strong>Status:</strong> {submittedExamIds.includes(exam._id) ? 'Submitted' : 'Active'}
                      </p>
                      <Button
                        disabled={submittedExamIds.includes(exam._id)}
                        onClick={() => navigate(`/exams/${exam._id}/take`)}
                      >
                        {submittedExamIds.includes(exam._id) ? 'Submitted' : 'Take Exam'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {!isProfessorOrAdmin && token && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Upcoming Exams</h2>
            {studentUpcoming.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600">No upcoming exams.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {studentUpcoming.map((exam) => (
                  <Card key={exam._id}>
                    <CardHeader>
                      <CardTitle>{exam.title}</CardTitle>
                      <CardDescription>
                        {exam.course?.title ? (
                          <span>
                            {exam.course.title}
                            {exam.course.courseCode ? ` (${exam.course.courseCode})` : ''}
                          </span>
                        ) : (
                          <span>{exam.description || 'No description'}</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">
                        <strong>Start:</strong> {new Date(exam.date).toLocaleString()}
                      </p>
                      <p className="text-sm">
                        <strong>Duration:</strong> {exam.durationMinutes} minutes
                      </p>
                      <p className="text-sm">
                        <strong>Status:</strong> {submittedExamIds.includes(exam._id) ? 'Submitted' : 'Upcoming'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {isProfessorOrAdmin && activeOrUpcomingForStaff.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600">No active or upcoming exams.</p>
            </CardContent>
          </Card>
        )}

        {isProfessorOrAdmin && activeOrUpcomingForStaff.length > 0 && (
          <div className="grid gap-4">
            {activeOrUpcomingForStaff.map((exam) => (
              <Card key={exam._id}>
                <CardHeader>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {exam.course?.title ? (
                      <span>
                        {exam.course.title}
                        {exam.course.courseCode ? ` (${exam.course.courseCode})` : ''}
                      </span>
                    ) : (
                      <span>{exam.description || 'No description'}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <strong>Date:</strong> {new Date(exam.date).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    <strong>Type:</strong> {exam.examType}
                  </p>
                  <p className="text-sm">
                    <strong># Questions:</strong> {exam.numQuestions}
                  </p>
                  <p className="text-sm">
                    <strong>Duration:</strong> {exam.durationMinutes} minutes
                  </p>
                  <p className="text-sm">
                    <strong>Created by:</strong> {exam.createdBy?.name || 'Unknown'}
                  </p>
                  <p className="text-sm">
                    <strong>Published:</strong> {exam.published ? 'Yes' : 'No'}
                  </p>
                  <Button variant="outline" onClick={() => navigate(`/exams/${exam._id}/results`)}>
                    Results
                  </Button>
                  {!exam.published && token && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/api/exams/${exam._id}/publish`, {
                            method: 'PATCH',
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          if (!res.ok) {
                            let msg = 'Publish failed'
                            try {
                              const body = await res.json()
                              msg = String(body?.error ?? body?.message ?? msg)
                            } catch {
                              // ignore
                            }
                            throw new Error(msg)
                          }

                          // Publish endpoint returns an unpopulated exam; refetch for consistent UI.
                          await res.json().catch(() => null)
                          await fetchExams()
                          if (token) await fetchAvailable()
                        } catch (e) {
                          alert(e instanceof Error ? e.message : 'Publish failed')
                        }
                      }}
                    >
                      Publish
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
