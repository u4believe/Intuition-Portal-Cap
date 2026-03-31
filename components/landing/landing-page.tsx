"use client"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import { useUserPreferences } from "@/hooks/useUserPreferences"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { useAccount } from "wagmi"
import { useDiscordAuth } from "@/hooks/useDiscordAuth"
import { Star, Pencil, X, Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { TrendingUp, Zap, Lock, ArrowRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserAccountInfo } from "@/components/user-account-info"
import { PushNotificationBanner } from "@/components/push-notification-banner"
import WatchPreferencesDialog from "@/components/watch-preferences-dialog"
import AlertsDialog from "@/components/alerts-dialog"
import NotificationPreferencesPanel from "@/components/push-notifications/notification-preferences-panel"
import RecentEvents from "./recent-events"
import LiveEvents from "./live-events"
import ClaimsTable from "./claims-table"
import TriplesTable from "./triples-table"
import AtomsTable from "./atoms-table"
import TrendingSection from "./trending-section"

export default function LandingPage() {
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'vaults' | 'claims' | 'atoms'>('claims')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingClaim, setEditingClaim] = useState<string | null>(null)
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [watchedClaims, setWatchedClaims] = useState<string[]>([])
  const watchlistRef = useRef<HTMLDivElement>(null)

  const { getWatchedClaims, removeWatchedClaim } = useUserPreferences()
  const { syncWatchedClaimsToServer } = usePushNotifications()
  const { isConnected } = useAccount()
  const { discordUser } = useDiscordAuth()
  const [mounted, setMounted] = useState(false)
  const isSignedIn = isConnected || !!discordUser

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) setWatchedClaims(getWatchedClaims())
  }, [mounted, isSignedIn, getWatchedClaims])

  // Close watchlist when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (watchlistRef.current && !watchlistRef.current.contains(e.target as Node)) {
        setWatchlistOpen(false)
      }
    }
    if (watchlistOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [watchlistOpen])

  const handleUnwatch = (claimLabel: string) => {
    removeWatchedClaim(claimLabel)
    setWatchedClaims(prev => prev.filter(c => c !== claimLabel))
    syncWatchedClaimsToServer()
  }

  const handleEditClaim = (claimLabel: string) => {
    setEditingClaim(claimLabel)
    setEditDialogOpen(true)
    setWatchlistOpen(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:to-slate-900 overflow-x-hidden transition-colors">
      <PushNotificationBanner />
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/80 dark:backdrop-blur-md backdrop-blur-lg sticky top-0 z-50">
        <div className="w-full px-4 py-2 flex items-center justify-between relative">
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0">
              <img 
                src="/logo.jpg" 
                alt="Portal Cap Logo" 
                className="h-12 w-auto rounded-full"
              />
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <div className="relative" ref={watchlistRef}>
              <button
                onClick={() => setWatchlistOpen(!watchlistOpen)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm text-black dark:text-white hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                <Star className="w-4 h-4" />
                <span>Watchlist</span>
                {watchedClaims.length > 0 && (
                  <span
                    suppressHydrationWarning
                    className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    {watchedClaims.length}
                  </span>
                )}
              </button>

              {watchlistOpen && (
                <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                      Watchlist {watchedClaims.length > 0 && <span className="text-slate-400 font-normal">({watchedClaims.length})</span>}
                    </h3>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {watchedClaims.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {watchedClaims.map((claim, idx) => (
                          <div
                            key={idx}
                            className="group flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">{claim}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleEditClaim(claim)}
                                title="Edit preferences"
                                className="p-1.5 rounded-md text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleUnwatch(claim)}
                                title="Unwatch"
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">No claims in your watchlist</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click the star icon on any claim to start watching</p>
                      </div>
                    )}
                  </div>

                  {watchedClaims.length > 0 && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Hover over a claim to edit or unwatch
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <a href="#features" className="text-sm text-black dark:text-white hover:text-primary transition-colors">
              Features
            </a>
            
            <Link href="/dashboard" className="text-sm text-black dark:text-white hover:text-primary transition-colors font-medium">
              Dashboard
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {mounted && isSignedIn ? (
                <UserAccountInfo />
              ) : (
                <Link href="/auth/login">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </nav>
          <div className="md:hidden flex gap-2 items-center">
            {mounted && isSignedIn && (
              <>
                <button
                  onClick={() => { setWatchlistOpen(!watchlistOpen); setNotifOpen(false) }}
                  className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-black dark:text-white cursor-pointer"
                  title="Watchlist"
                >
                  <Star className="w-5 h-5" />
                  {watchedClaims.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {watchedClaims.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setWatchlistOpen(false) }}
                  className={`relative p-2 rounded-lg transition-colors cursor-pointer ${notifOpen ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-black dark:text-white'}`}
                  title="Notification Preferences"
                >
                  <Bell className="w-5 h-5" />
                </button>
              </>
            )}
            <ThemeToggle />
            {mounted && isSignedIn ? (
              <UserAccountInfo />
            ) : (
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="text-black dark:text-white hover:text-primary">
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile notification preferences panel */}
          {notifOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl z-50 max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  Notification Preferences
                </h3>
                <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <NotificationPreferencesPanel onOpenSettings={() => { setNotifOpen(false); setAlertsDialogOpen(true) }} />
              </div>
            </div>
          )}

          {/* Mobile watchlist panel */}
          {watchlistOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl z-50 max-h-[60vh] overflow-y-auto">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Watchlist {watchedClaims.length > 0 && <span className="text-slate-400 font-normal">({watchedClaims.length})</span>}
                </h3>
                <button onClick={() => setWatchlistOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {watchedClaims.length > 0 ? (
                <div className="p-2 space-y-1">
                  {watchedClaims.map((claim, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">{claim}</span>
                      <button
                        onClick={() => handleEditClaim(claim)}
                        className="p-2 rounded-md text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors cursor-pointer"
                        title="Edit preferences"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUnwatch(claim)}
                        className="p-2 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                        title="Unwatch"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No claims in your watchlist</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Live Events Carousel - Only visible on mobile */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <LiveEvents />
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white leading-tight">
              Monitor Claims in{" "}
              <span className="bg-gradient-to-r from-primary to-primary/80 dark:from-cyan-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Real-Time
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Get instant signals on market cap changes, price movements, and position updates for your favorite claims
              and identities on Intuition.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={() => setAlertsDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Bell className="w-4 h-4" />
              Alerts
            </Button>
            <Link href="#claims">
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary dark:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 bg-transparent"
              >
                View Claims
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">24/7</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Monitoring</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">Instant</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Alerts</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">Custom</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Triggers</p>
            </div>
          </div>
        </div>

        {/* Visual Element - Animated Card */}
        <div className="hidden md:block">
          <RecentEvents />
        </div>
      </section>

      {/* Trending Section */}
      <TrendingSection />

      {/* All Claims Table Section */}
      <section id="claims" className="w-full bg-gradient-to-b from-slate-50 dark:from-slate-900 to-white dark:to-slate-950 border-t border-slate-200 dark:border-slate-800/50 py-20">
        <div className="w-full px-0 space-y-8">
          {/* Tab Toggle Buttons */}
          <div className="flex justify-center gap-4 px-4">
            <button
              onClick={() => setActiveTab('vaults')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'vaults'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Vaults
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'claims'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Claims
            </button>
            <button
              onClick={() => setActiveTab('atoms')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'atoms'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Identities
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'vaults' && <ClaimsTable />}
          {activeTab === 'claims' && <TriplesTable targetPage={null} highlightTermId={null} onClearHighlight={() => {}} />}
          {activeTab === 'atoms' && <AtomsTable targetPage={null} highlightTermId={null} onClearHighlight={() => {}} />}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
            Powerful Features for <br/>
            <span className="bg-gradient-to-r from-primary to-primary/60 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
              Smart Monitoring
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Everything you need to stay on top of your claims and positions.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: 'Real-Time Updates',
              description: 'Get instant notifications about market cap changes and price movements',
            },
            {
              icon: Zap,
              title: 'Custom Alerts',
              description: 'Set up triggers based on your specific monitoring preferences',
            },
            {
              icon: Lock,
              title: 'Web3 Native',
              description: 'Seamless wallet integration with no email required',
            },
          ].map((feature, i) => {
            const Icon = feature.icon
            return (
              <Card key={i} className="bg-white dark:bg-slate-900/50 dark:backdrop-blur-sm border-slate-200 dark:border-slate-800/50 hover:border-primary dark:hover:border-cyan-400/50 transition-all shadow-sm dark:shadow-lg">
                <CardHeader>
                  <Icon className="w-8 h-8 text-primary dark:text-cyan-400 mb-2" />
                  <CardTitle className="text-slate-900 dark:text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-200 dark:border-slate-800/50">
        <div className="bg-gradient-to-r from-primary/10 dark:from-cyan-500/20 to-primary/5 dark:to-purple-500/20 border border-primary/20 dark:border-cyan-400/30 rounded-2xl p-12 text-center space-y-6 dark:backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Ready to monitor your claims?</h2>
          <p className="text-slate-600 dark:text-slate-300">Connect your wallet and start tracking claims in real-time.</p>
          <Link href="/auth/login">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-600 dark:text-slate-400 text-sm">
          <p>Intuition Portal Cap © 2025. Built to monitor the Intuition Portal.</p>
        </div>
      </footer>

      {/* Alerts dialog */}
      <AlertsDialog open={alertsDialogOpen} onOpenChange={setAlertsDialogOpen} />

      {/* Edit preferences dialog (from watchlist) */}
      {editingClaim && (
        <WatchPreferencesDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          claimLabel={editingClaim}
          termId=""
          mode="edit"
          onConfirm={() => {
            setEditDialogOpen(false)
            setEditingClaim(null)
            setTimeout(() => syncWatchedClaimsToServer(), 200)
          }}
        />
      )}
    </div>
  )
}
