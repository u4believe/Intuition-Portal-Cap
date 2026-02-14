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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img 
              src="/logo.jpg" 
              alt="Portal Cap Logo" 
              className="h-10 w-auto rounded-full"
            />
          </Link>
          <Button
            variant="outline"
            onClick={logout}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
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
            <p className="text-slate-400">Welcome to your Intuition Portal Cap dashboard. More features coming soon.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-3 hover:border-cyan-500/50 transition-colors">
              <h3 className="font-semibold text-white">Watched Claims</h3>
              <p className="text-3xl font-bold text-cyan-400">0</p>
              <p className="text-sm text-slate-400">Claims you're monitoring</p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-3 hover:border-cyan-500/50 transition-colors">
              <h3 className="font-semibold text-white">Recent Events</h3>
              <p className="text-3xl font-bold text-cyan-400">0</p>
              <p className="text-sm text-slate-400">Events this week</p>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-3 hover:border-cyan-500/50 transition-colors">
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-3xl font-bold text-cyan-400">0</p>
              <p className="text-sm text-slate-400">Unread alerts</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center space-y-4">
            <p className="text-slate-400">Full dashboard features coming soon!</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
