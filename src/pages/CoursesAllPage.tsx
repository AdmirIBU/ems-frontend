

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Course = {
  _id: string
  title: string
  courseCode?: string
  ects?: number
  description?: string
  students?: Array<{ _id: string; name?: string }>
  enrollmentRequests?: Array<{ student: any; requestedAt: string }>
  syllabus?: { path?: string }
  professors?: Array<{ _id: string; name?: string; email?: string }>
}

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'student' | 'professor' | 'admin'
}

export function CoursesAllPage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [ects, setEcts] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [toast, setToast] = useState<string | null>(null)

  // admin professor assignment state
  const [professors, setProfessors] = useState<AdminUser[]>([])
  const [assigningFor, setAssigningFor] = useState<string | null>(null)
  const [selectedProfessorIds, setSelectedProfessorIds] = useState<string[]>([])
  const [savingProfessors, setSavingProfessors] = useState(false)

  // edit course UI state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCourseCode, setEditCourseCode] = useState('')
  const [editEcts, setEditEcts] = useState<number | ''>('')
  const [editDescription, setEditDescription] = useState('')
  const [editSyllabusFile, setEditSyllabusFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const user = userRaw ? JSON.parse(userRaw) : null
  const role = (user?.role as string | undefined) ?? 'student'
  const userId = user?.id ?? user?._id
  const canManage = role === 'professor' || role === 'admin'

  const authHeaders = useMemo(() => {
    return { Authorization: `Bearer ${token ?? ''}` }
  }, [token])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/courses`)
      if (!res.ok) throw new Error('Failed to load courses')
      const data = await res.json()
      setCourses(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    const loadProfessors = async () => {
      if (role !== 'admin' || !token) return
      try {
        const res = await fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders })
        if (!res.ok) throw new Error('Failed to load users')
        const data = (await res.json()) as AdminUser[]
        const profs = (Array.isArray(data) ? data : []).filter((u) => u.role === 'professor')
        setProfessors(profs)
      } catch (e) {
        console.error(e)
      }
    }
    void loadProfessors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, token])

  const startAssignProfessors = (c: Course) => {
    setAssigningFor(c._id)
    const current = Array.isArray(c.professors) ? c.professors.map((p) => p._id) : []
    setSelectedProfessorIds(current)
  }

  const saveAssignedProfessors = async (courseId: string) => {
    if (!token) return alert('Please log in')
    setSavingProfessors(true)
    try {
      const res = await fetch(`${API_BASE}/api/courses/${courseId}/professors`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ professorIds: selectedProfessorIds }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Failed to assign professors')
      }
      const updated = (await res.json()) as Course
      setCourses((prev) => prev.map((x) => (x._id === updated._id ? updated : x)))
      setAssigningFor(null)
      showToast('Professors assigned')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to assign professors')
    } finally {
      setSavingProfessors(false)
    }
  }

  const handleEnroll = async (id: string) => {
    if (!token) return alert('Please log in to enroll')
    try {
      const res = await fetch(`${API_BASE}/api/courses/${id}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let msg = 'Enroll failed'
        try {
          const body = await res.json()
          msg = String(body?.error ?? body?.message ?? msg)
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      const updated = await res.json()
      setCourses((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      showToast(`Enrollment requested for ${updated.title}`)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Enroll failed')
    }
  }

  const handleApprove = async (courseId: string, studentId: string) => {
    if (!token) return alert('Please log in')
    try {
      const res = await fetch(`${API_BASE}/api/courses/${courseId}/enrollments/${studentId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to approve')
      const updated = await res.json()
      setCourses((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      showToast('Enrollment approved')
    } catch (err) {
      console.error(err)
      alert('Approve failed')
    }
  }

  const handleReject = async (courseId: string, studentId: string) => {
    if (!token) return alert('Please log in')
    try {
      const res = await fetch(`${API_BASE}/api/courses/${courseId}/enrollments/${studentId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to reject')
      const updated = await res.json()
      setCourses((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      showToast('Enrollment rejected')
    } catch (err) {
      console.error(err)
      alert('Reject failed')
    }
  }

  const startEdit = (c: Course) => {
    setEditingCourseId(c._id)
    setEditTitle(c.title ?? '')
    setEditCourseCode((c as any).courseCode ?? '')
    setEditEcts((c as any).ects ?? '')
    setEditDescription(c.description ?? '')
    setEditSyllabusFile(null)
  }

  const saveEdit = async (courseId: string) => {
    if (!token) return alert('Please log in')
    setSavingEdit(true)
    try {
      const fd = new FormData()
      if (editTitle) fd.append('title', editTitle)
      if (editCourseCode) fd.append('courseCode', editCourseCode)
      if (editEcts !== '') fd.append('ects', String(editEcts))
      fd.append('description', editDescription)
      if (editSyllabusFile) fd.append('syllabus', editSyllabusFile)

      const res = await fetch(`${API_BASE}/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) throw new Error('Failed to update course')
      const updated = await res.json()
      setCourses((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
      setEditingCourseId(null)
      showToast('Course updated')
    } catch (err) {
      console.error(err)
      alert('Update failed')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return alert('Please log in to create a course')
    if (!title || !courseCode || ects === '') return alert('Please fill required fields')
    setCreating(true)
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('courseCode', courseCode)
      fd.append('ects', String(ects))
      fd.append('description', description)
      if (syllabusFile) fd.append('syllabus', syllabusFile)

      const res = await fetch(`${API_BASE}/api/courses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // don't set Content-Type for FormData
        body: fd,
      })
      if (!res.ok) throw new Error('Failed to create')
      const created = await res.json()
      setCourses((prev) => [created, ...prev])
      setTitle('')
      setDescription('')
      setCourseCode('')
      setEcts('')
      setSyllabusFile(null)
      showToast(`Created ${created.title}`)
    } catch (err) {
      console.error(err)
      alert('Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">All Courses</h1>

        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-green-600 text-white px-4 py-2 rounded shadow" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        {token && canManage && (
          <form onSubmit={handleCreate} className="mb-6 grid gap-2 grid-cols-1 sm:grid-cols-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" required />
            <Input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="Course code" required />
            <Input value={ects} onChange={(e) => setEcts(e.target.value ? Number(e.target.value) : '')} type="number" placeholder="ECTS" required />
            <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
              <Label htmlFor="create-syllabus" className="sr-only">Syllabus (optional)</Label>
              <input
                id="create-syllabus"
                type="file"
                className="sr-only"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] ?? null)}
              />
              <Button asChild variant="outline" size="sm">
                <label htmlFor="create-syllabus" className="cursor-pointer">Choose</label>
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {syllabusFile ? syllabusFile.name : 'Syllabus (optional)'}
              </span>
            </div>
            <input className="hidden" />
            <Button type="submit" className="w-full col-span-1 sm:col-auto" disabled={creating}>
              {creating ? 'Creating...' : 'Create Course'}
            </Button>
          </form>
        )}

        <div className="grid gap-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            courses.map((c) => {
              const enrolled = !!c.students?.some((s: any) => {
                const sid = typeof s === 'string' ? s : s._id ?? s.id
                return sid === userId
              })
              const requested = !!c.enrollmentRequests?.some((r: any) => {
                const sid = typeof r?.student === 'string' ? r.student : r?.student?._id ?? r?.student?.id
                return sid === userId
              })
              const isEditing = editingCourseId === c._id

              return (
                <Card key={c._id} className="w-full">
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="text-base">
                          <span className="truncate">{c.title}</span>{' '}
                          {(c as any).courseCode ? (
                            <span className="text-xs text-muted-foreground">({String((c as any).courseCode)})</span>
                          ) : null}
                        </CardTitle>
                        {c.description ? <CardDescription className="mt-1">{c.description}</CardDescription> : null}

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Students: {c.students?.length ?? 0}</span>
                          {typeof (c as any).ects === 'number' ? <span>ECTS: {(c as any).ects}</span> : null}
                        </div>

                        {(c as any).syllabus?.path ? (
                          <div className="mt-2 text-xs">
                            <a
                              href={(c as any).syllabus.path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              Download syllabus
                            </a>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => navigate(`/courses/${c._id}`)}>
                          Open course
                        </Button>

                        {role === 'student' && (
                          <Button
                            onClick={() => handleEnroll(c._id)}
                            disabled={enrolled || requested}
                            aria-disabled={enrolled || requested}
                            className={enrolled || requested ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            {enrolled ? 'Enrolled' : requested ? 'Requested' : 'Request enrollment'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-0">
                    {role === 'admin' && (
                      <div className="mt-2 w-full rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Assigned professors</div>
                          {assigningFor === c._id ? (
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setAssigningFor(null)}>
                                Cancel
                              </Button>
                              <Button type="button" onClick={() => void saveAssignedProfessors(c._id)} disabled={savingProfessors}>
                                {savingProfessors ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" onClick={() => startAssignProfessors(c)}>
                              Assign professors
                            </Button>
                          )}
                        </div>

                        {assigningFor === c._id ? (
                          <div className="mt-3 grid gap-2">
                            {professors.length === 0 ? (
                              <div className="text-xs text-muted-foreground">No professors found.</div>
                            ) : (
                              professors.map((p) => {
                                const checked = selectedProfessorIds.includes(p.id)
                                return (
                                  <label key={p.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? Array.from(new Set([...selectedProfessorIds, p.id]))
                                          : selectedProfessorIds.filter((x) => x !== p.id)
                                        setSelectedProfessorIds(next)
                                      }}
                                    />
                                    <span className="font-medium">{p.name}</span>
                                    <span className="text-muted-foreground text-xs">({p.email})</span>
                                  </label>
                                )
                              })
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm">
                            {(c.professors ?? []).length === 0 ? (
                              <span className="text-muted-foreground">No professors assigned.</span>
                            ) : (
                              (c.professors ?? []).map((p) => p.name ?? p.email ?? p._id).join(', ')
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button type="button" variant="outline" onClick={() => setEditingCourseId(null)}>
                              Cancel edit
                            </Button>
                            <Button type="button" onClick={() => saveEdit(c._id)} disabled={savingEdit}>
                              {savingEdit ? 'Saving...' : 'Save changes'}
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="outline" onClick={() => startEdit(c)}>
                            Edit course
                          </Button>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
                        <Input value={editCourseCode} onChange={(e) => setEditCourseCode(e.target.value)} placeholder="Course code" />
                        <Input value={editEcts} onChange={(e) => setEditEcts(e.target.value ? Number(e.target.value) : '')} type="number" placeholder="ECTS" />
                        <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" />
                        <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 sm:col-span-2">
                          <Label htmlFor={`edit-syllabus-${c._id}`} className="sr-only">Replace syllabus (optional)</Label>
                          <input
                            id={`edit-syllabus-${c._id}`}
                            type="file"
                            className="sr-only"
                            onChange={(e) => setEditSyllabusFile(e.target.files?.[0] ?? null)}
                          />
                          <Button asChild variant="outline" size="sm">
                            <label htmlFor={`edit-syllabus-${c._id}`} className="cursor-pointer">Choose</label>
                          </Button>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                            {editSyllabusFile ? editSyllabusFile.name : 'Replace syllabus (optional)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {canManage && (c.enrollmentRequests?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold">Pending enrollment requests</h3>
                        <div className="mt-2 space-y-2">
                          {(c.enrollmentRequests ?? []).map((r: any) => {
                            const sid = typeof r?.student === 'string' ? r.student : r?.student?._id ?? r?.student?.id
                            const name = typeof r?.student === 'string' ? r.student : r?.student?.name ?? r?.student?.email ?? 'Student'
                            return (
                              <div key={sid} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-2">
                                <div className="text-sm">{name}</div>
                                <div className="flex gap-2">
                                  <Button type="button" className="text-sm" onClick={() => handleApprove(c._id, sid)}>
                                    Approve
                                  </Button>
                                  <Button type="button" variant="outline" className="text-sm" onClick={() => handleReject(c._id, sid)}>
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
