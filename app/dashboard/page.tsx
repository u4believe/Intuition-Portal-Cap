'use client'

import { useState, useEffect } from 'react'
import { useAuthProtected } from '@/hooks/useAuth'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { useAccount } from 'wagmi'
import { useDiscordAuth } from '@/hooks/useDiscordAuth'
import { Button } from '@/components/ui/button'
import { logout } from '@/hooks/useAuth'
import Link from 'next/link'
import AlertsDialog from '@/components/alerts-dialog'
import NotificationPreferencesPanel from '@/components/push-notifications/notification-preferences-panel'
import WalletPositionsLookup from '@/components/dashboard/wallet-positions-lookup'
import { Bell, Star, ArrowRight, Trash2, Eye } from 'lucide-react'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'

type ClaimDetail = {
  label: string
  termId?: string
  marketCap?: string
  positions?: number
  subject?: string
  predicate?: string
  object?: string
}

function parseClaimLabel(label: string): { subject?: string; predicate?: string; object?: string } {
  const parts = label.split(' → ')
  if (parts.length === 3) return { subject: parts[0], predicate: parts[1], object: parts[2] }
  const parts2 = label.split(' — ')
  if (parts2.length === 3) return { subject: parts2[0], predicate: parts2[1], object: parts2[2] }
  return {}
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuthProtected()
  const { getWatchedClaims, removeWatchedClaim } = useUserPreferences()
  const { isConnected, address: connectedAddress } = useAccount()
  const { discordUser } = useDiscordAuth()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [watchedClaims, setWatchedClaims] = useState<string[]>([])
  const [claimDetails, setClaimDetails] = useState<Record<string, ClaimDetail>>({})
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [editingClaim, setEditingClaim] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isSignedIn = isConnected || !!discordUser

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && isSignedIn) {
      setWatchedClaims(getWatchedClaims())
    }
  }, [mounted, isSignedIn, getWatchedClaims])

  // Fetch market cap details for each watched claim
  useEffect(() => {
    if (!watchedClaims.length) return
    setLoadingDetails(true)
    Promise.all(
      watchedClaims.map(async (label) => {
        try {
          const parsed = parseClaimLabel(label)
          if (parsed.subject && parsed.predicate && parsed.object) {
            const params = new URLSearchParams({
              mode: 'triples-fields',
              s: parsed.subject,
              p: parsed.predicate,
              o: parsed.object,
            })
            const res = await fetch(`/api/search-triples?${params}`)
            const data = await res.json()
            const match = data.triples?.[0]
            if (match) {
              return [label, {
                label,
                termId: match.termId,
                marketCap: match.marketCapDisplay,
                positions: match.position_count,
                subject: match.subject,
                predicate: match.predicate,
                object: match.object,
              }] as [string, ClaimDetail]
            }
          }
          return [label, { label, ...parsed }] as [string, ClaimDetail]
        } catch {
          return [label, { label }] as [string, ClaimDetail]
        }
      })
    ).then((entries) => {
      setClaimDetails(Object.fromEntries(entries))
      setLoadingDetails(false)
    })
  }, [watchedClaims])

  const handleUnwatch = (label: string) => {
    removeWatchedClaim(label)
    setWatchedClaims(prev => prev.filter(c => c !== label))
  }

  const handleManageAlerts = (label: string) => {
    setEditingClaim(label)
    setEditDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/logo.jpg" alt="Portal Cap Logo" className="h-10 w-auto rounded-full" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="text-slate-400 hover:text-white">
                Home
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={logout}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">Manage your watched claims and alert preferences</p>
          </div>

          {/* Stat row */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Watched Claims</p>
              <p className="text-3xl font-bold text-cyan-400">{watchedClaims.length}</p>
              <p className="text-sm text-slate-400">Claims you're monitoring</p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">With Market Data</p>
              <p className="text-3xl font-bold text-purple-400">
                {Object.values(claimDetails).filter(d => d.marketCap).length}
              </p>
              <p className="text-sm text-slate-400">Claims with live prices</p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
              <p className="text-3xl font-bold text-green-400">On</p>
              <p className="text-sm text-slate-400">Push alerts active</p>
            </div>
          </div>

          {/* Portfolio lookup */}
          <WalletPositionsLookup defaultAddress={connectedAddress ?? ''} />

          <div className="grid lg:grid-cols-3 gap-6 items-start">
            {/* Watched claims list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  Watched Claims
                </h2>
                <Link href="/#claims">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent text-xs gap-1">
                    <Eye className="w-3 h-3" />
                    Browse all claims
                  </Button>
                </Link>
              </div>

              {!mounted || loadingDetails && watchedClaims.length > 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
                      <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-800 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : watchedClaims.length === 0 ? (
                <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center space-y-3">
                  <Star className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-medium">No watched claims yet</p>
                  <p className="text-sm text-slate-500">Go to the home page, find a claim in the table, and click the star icon to watch it.</p>
                  <Link href="/#claims">
                    <Button className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                      Browse Claims <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {watchedClaims.map((label) => {
                    const detail = claimDetails[label]
                    const parsed = detail || parseClaimLabel(label)
                    const isTriple = !!(parsed.subject && parsed.predicate && parsed.object)
                    return (
                      <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {isTriple ? (
                              <p className="text-sm font-medium text-slate-200 leading-snug flex flex-wrap items-center gap-1">
                                <span className="text-blue-400">{parsed.subject}</span>
                                <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span className="text-orange-400">{parsed.predicate}</span>
                                <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span className="text-teal-400">{parsed.object}</span>
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {detail?.marketCap && (
                                <span className="text-xs text-cyan-400 font-medium">{detail.marketCap}</span>
                              )}
                              {detail?.positions !== undefined && (
                                <span className="text-xs text-slate-500">{detail.positions} position{detail.positions !== 1 ? 's' : ''}</span>
                              )}
                              {!detail?.marketCap && !loadingDetails && (
                                <span className="text-xs text-slate-600 italic">Market data unavailable</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleManageAlerts(label)}
                              title="Manage alerts"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-slate-800 transition-colors"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUnwatch(label)}
                              title="Unwatch"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-xs text-slate-600 text-center pt-1">
                    {watchedClaims.length} watched claim{watchedClaims.length !== 1 ? 's' : ''} · Click the bell icon to manage alert thresholds
                  </p>
                </div>
              )}
            </div>

            {/* Right column: notifications */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <NotificationPreferencesPanel onOpenSettings={() => setAlertsOpen(true)} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <AlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} />
      {editingClaim && (
        <WatchPreferencesDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          claimLabel={editingClaim}
          termId={claimDetails[editingClaim]?.termId ?? ''}
          onConfirm={() => setEditDialogOpen(false)}
        />
      )}
    </div>
  )
}
