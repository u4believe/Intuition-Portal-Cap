"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AlertPreferences from "./alert-preferences"
import AlertHistory from "./alert-history"
import { Bell, LogOut, Settings } from "lucide-react"

interface DashboardClientProps {
  userId: string
  email: string
}

export default function DashboardClient({ userId, email }: DashboardClientProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    setUser({ id: userId, email })
    setLoading(false)
  }, [userId, email])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <Bell className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold whitespace-nowrap">Signal App</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[200px]">{email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preferences">
              <Settings className="w-4 h-4 mr-2" />
              Alert Preferences
            </TabsTrigger>
            <TabsTrigger value="history">
              <Bell className="w-4 h-4 mr-2" />
              Alert History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-4 mt-6">
            <AlertPreferences userId={userId} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-6">
            <AlertHistory userId={userId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
