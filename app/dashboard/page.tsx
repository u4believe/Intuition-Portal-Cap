'use client'

import { useAuthProtected } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { logout } from '@/hooks/useAuth'
import Link from 'next/link'

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuthProtected()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="border-b border-primary/20 bg-primary/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <h1 className="text-2xl font-bold text-white">Portal Cap</h1>
          </Link>
          <Button
            variant="outline"
            onClick={logout}
            className="border-white/30 text-white hover:bg-white/10 bg-transparent"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-white">Dashboard</h2>
            <p className="text-white/80">Welcome to your Intuition Portal Cap dashboard. More features coming soon.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-3 hover:border-white/40 transition-colors backdrop-blur">
              <h3 className="font-semibold text-white">Watched Claims</h3>
              <p className="text-3xl font-bold text-white">0</p>
              <p className="text-sm text-white/70">Claims you're monitoring</p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-3 hover:border-white/40 transition-colors backdrop-blur">
              <h3 className="font-semibold text-white">Recent Events</h3>
              <p className="text-3xl font-bold text-white">0</p>
              <p className="text-sm text-white/70">Events this week</p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-lg p-6 space-y-3 hover:border-white/40 transition-colors backdrop-blur">
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-3xl font-bold text-white">0</p>
              <p className="text-sm text-white/70">Unread alerts</p>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-lg p-8 text-center space-y-4 backdrop-blur">
            <p className="text-white/80">Full dashboard features coming soon!</p>
            <Link href="/">
              <Button className="bg-white text-primary hover:bg-white/90">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
