import { type ReactNode, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

type NavItem = {
  label: string
  href: string
  roles?: Array<"admin" | "professor" | "student">
}

function useUser() {
  const location = useLocation()
  const [user, setUser] = useState<any>(() => {
    const userJson = typeof window !== "undefined" ? localStorage.getItem("user") : null
    return userJson ? JSON.parse(userJson) : null
  })

  useEffect(() => {
    const userJson = typeof window !== "undefined" ? localStorage.getItem("user") : null
    setUser(userJson ? JSON.parse(userJson) : null)
  }, [location.pathname])

  return user
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useUser()
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    const readActive = () => {
      try {
        const id = typeof window !== "undefined" ? sessionStorage.getItem("ems.activeExamId") : null
        setActiveExamId(id)
      } catch {
        setActiveExamId(null)
      }
    }

    readActive()
    intervalRef.current = window.setInterval(readActive, 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  const isStudent = user?.role === "student"
  const isExamLocked = isStudent && !!activeExamId

  const navItems: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "All Courses", href: "/courses" },
    { label: "My Courses", href: "/courses/my", roles: ["student", "professor"] },
    { label: "Exams", href: "/exams", roles: ["admin", "professor", "student"] },
    { label: "Past Exams", href: "/exams/past", roles: ["admin", "professor"] },
    { label: "Grades", href: "/grades", roles: ["student"] },
    { label: "Students", href: "/students/review", roles: ["admin", "professor"] },
    { label: "Admin", href: "/admin/users", roles: ["admin"] },
  ]

  const canSee = (item: NavItem) => {
    if (!item.roles) return true
    const role = user?.role
    return role ? item.roles.includes(role) : false
  }

  const handleLogout = () => {
    if (isExamLocked) return
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r bg-card md:flex md:flex-col">
          <div className="flex h-14 items-center px-4">
            <Link to="/" className="text-sm font-semibold tracking-tight">
              Exam Management System
            </Link>
          </div>
          <Separator />

          <nav className="flex-1 p-2">
            {isExamLocked ? (
              <Link to={`/exams/${activeExamId}/take`} className="block">
                <Button variant="secondary" className="w-full justify-start">
                  Resume Exam
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col gap-1">
                {navItems.filter(canSee).map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link key={item.href} to={item.href} className="block">
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        {item.label}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            )}
          </nav>

          <Separator />
          <div className="p-3">
            {token ? (
              <div className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user?.name ?? "User"}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/login">
                  <Button variant="secondary" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="ghost" size="sm">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen flex-col bg-muted/30">
          <header className="flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="text-sm font-medium md:hidden">
              <Link to="/">EMS</Link>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {token ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 px-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user?.name ? String(user.name).charAt(0).toUpperCase() : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="ml-2 hidden text-sm md:inline">{user?.name ?? "Profile"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {!isExamLocked && (
                      <DropdownMenuItem onSelect={() => navigate("/profile")}>
                        Profile
                      </DropdownMenuItem>
                    )}
                    {!isExamLocked && (
                      <DropdownMenuItem onSelect={handleLogout}>
                        Logout
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login"><Button variant="secondary" size="sm">Login</Button></Link>
                  <Link to="/register"><Button variant="ghost" size="sm">Register</Button></Link>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
