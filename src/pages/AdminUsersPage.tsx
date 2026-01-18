import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'student' | 'professor' | 'admin'
  createdAt?: string
}

type UsersResponse =
  | AdminUser[]
  | {
      items: AdminUser[]
      total: number
      page: number
      limit: number
      totalPages: number
    }

export function AdminUsersPage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'professor'>('student')
  const [creating, setCreating] = useState(false)

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const authHeaders = useMemo(() => {
    return {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [token])

  const loadUsers = async (pageToLoad: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?page=${pageToLoad}&limit=${PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('Failed to load users')
      const data = (await res.json()) as UsersResponse

      if (Array.isArray(data)) {
        // Backward-compatible fallback (if server returns a plain array)
        setUsers(data)
        setTotal(data.length)
        setTotalPages(Math.max(1, Math.ceil(data.length / PAGE_SIZE)))
        setPage(1)
      } else {
        setUsers(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total ?? 0) || 0)
        setTotalPages(Math.max(1, Number(data.totalPages ?? 1) || 1))
        setPage(Number(data.page ?? pageToLoad) || pageToLoad)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const startIndex = total === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE
  const endIndexExclusive = Math.min(startIndex + users.length, total)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    if (password.trim().length < 6) {
      setCreating(false)
      setError('Password must be at least 6 characters')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name, email, password, role }),
      })

      if (!res.ok) {
        let msg = 'Failed to create user'
        try {
          const body = await res.json()
          if (Array.isArray(body?.errors) && body.errors.length > 0) {
            msg = String(body.errors[0]?.msg ?? msg)
          } else if (body?.error) {
            msg = String(body.error)
          } else if (body?.message) {
            msg = String(body.message)
          }
        } catch {
          const txt = await res.text().catch(() => '')
          if (txt) msg = txt
        }
        throw new Error(msg)
      }

      setName('')
      setEmail('')
      setPassword('')
      setRole('student')
      setPage(1)
      await loadUsers(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin: Create User</CardTitle>
            <CardDescription>Create student or professor accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="grid gap-2">
                <Label htmlFor="admin-create-name">Full name</Label>
                <Input
                  id="admin-create-name"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-create-email">Email</Label>
                <Input
                  id="admin-create-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-create-password">Temporary password</Label>
                <Input
                  id="admin-create-password"
                  type="password"
                  placeholder="Temporary password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-create-role">Role</Label>
                <select
                  id="admin-create-role"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'student' | 'professor')}
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                </select>
              </div>

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${users.length} total`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => void loadUsers(pageSafe)} disabled={loading}>
                  Refresh
                </Button>

                <div className="text-xs text-muted-foreground">
                  {total === 0 ? 'Showing 0 of 0' : `Showing ${startIndex + 1}–${endIndexExclusive} of ${total}`}
                </div>
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2 font-medium">{u.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.role}</td>
                      </tr>
                    ))}
                    {!loading && users.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const nextPage = Math.max(1, pageSafe - 1)
                    setPage(nextPage)
                    void loadUsers(nextPage)
                  }}
                  disabled={loading || pageSafe <= 1}
                >
                  Previous
                </Button>

                <div className="text-xs text-muted-foreground">
                  Page {pageSafe} of {totalPages}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const nextPage = Math.min(totalPages, pageSafe + 1)
                    setPage(nextPage)
                    void loadUsers(nextPage)
                  }}
                  disabled={loading || pageSafe >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
