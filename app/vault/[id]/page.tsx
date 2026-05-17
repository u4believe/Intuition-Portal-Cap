'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'
import type { ClaimAlertPref } from '@/lib/push-notifications'

type SideMode = 'support' | 'oppose'

function fmt(n: number, decimals = 2) {
  if (!n && n !== 0) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function shortAddr(addr: string) {
  if (!addr) return '—'
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 space-y-1 ${
      accent === 'green'
        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
        : accent === 'red'
        ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    }`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg sm:text-2xl font-bold break-all ${
        accent === 'green' ? 'text-emerald-600 dark:text-emerald-400'
        : accent === 'red' ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-white'
      }`}>{value}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mt-6 mb-3">{children}</h2>
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">{msg}</td>
    </tr>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Td({ children, center, mono }: { children: React.ReactNode; center?: boolean; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 ${center ? 'text-center' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
      {children}
    </td>
  )
}

export default function VaultDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const { removeClaimAlertPref, getClaimAlertPrefs } = usePushNotifications()
  const [claim, setClaim] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [termId, setTermId] = useState<string | null>(null)
  const [sideMode, setSideMode] = useState<SideMode>('support')
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [existingPrefs, setExistingPrefs] = useState<Partial<ClaimAlertPref> | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    params.then(p => { if (mounted) setTermId(p.id) }).catch(() => { if (mounted) setError('Failed to load') })
    return () => { mounted = false }
  }, [params])

  useEffect(() => {
    if (!termId) return
    let mounted = true
    setIsLoading(true)
    setError(null)
    fetch(`/api/vault?termId=${termId}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error || 'Failed')))
      .then(d => { if (mounted) setClaim(d.claim) })
      .catch(e => { if (mounted) setError(String(e)) })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [termId])

  useEffect(() => {
    if (!termId) return
    getClaimAlertPrefs().then(prefs => {
      if (prefs[termId]) setExistingPrefs(prefs[termId])
    }).catch(() => {})
  }, [termId, getClaimAlertPrefs])

  const watchedClaims = getWatchedClaims()
  const isWatched = claim
    ? (existingPrefs !== undefined || watchedClaims.includes(claim.label))
    : false

  const handleWatchClick = () => {
    if (!claim) return
    if (isWatched) {
      removeWatchedClaim(claim.label)
      if (termId) removeClaimAlertPref(termId)
      setExistingPrefs(undefined)
    } else {
      setWatchDialogOpen(true)
    }
  }

  if (isLoading || !termId) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 dark:text-slate-500">Loading claim details…</p>
      </div>
    )
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 p-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/"><Button variant="ghost" className="mb-6 text-slate-700 dark:text-slate-300"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button></Link>
          <p className="text-red-500 dark:text-red-400">{error || 'Claim not found'}</p>
        </div>
      </div>
    )
  }

  const side = sideMode === 'support' ? claim.support : claim.oppose
  const hasOppose = !!claim.oppose

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Claims</span>
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {claim.type}
            </span>
            <button onClick={handleWatchClick} className="cursor-pointer p-1.5 hover:scale-110 transition-transform">
              <Star className={`w-5 h-5 ${isWatched ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Title */}
        <div className="flex items-center gap-3">
          {claim.image && <img src={claim.image} alt={claim.label} className="w-10 h-10 rounded-full flex-shrink-0 border border-slate-200 dark:border-slate-700" />}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{claim.label}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono truncate">{claim.termId}</p>
          </div>
        </div>

        {/* Atom Identity info */}
        {claim.type === 'Atom' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {(claim.emoji || claim.atomType) && (
              <div className="flex items-center gap-6 px-5 py-4 flex-wrap">
                {claim.emoji && (
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Emoji</p>
                    <p className="text-2xl">{claim.emoji}</p>
                  </div>
                )}
                {claim.atomType && (
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Atom Type</p>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">{claim.atomType}</span>
                  </div>
                )}
                {claim.createdAt && (
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Created</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{fmtDate(claim.createdAt)}</p>
                  </div>
                )}
              </div>
            )}
            {claim.creator?.label && (
              <div className="px-5 py-4 flex items-center gap-3">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Creator</p>
                  <div className="flex items-center gap-2">
                    {claim.creator.image && <img src={claim.creator.image} alt={claim.creator.label} className="w-6 h-6 rounded-full" />}
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{claim.creator.label}</p>
                    {claim.creator.id && <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{shortAddr(claim.creator.id)}</p>}
                  </div>
                </div>
              </div>
            )}
            {claim.data && (
              <div className="px-5 py-4">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Data</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 break-all font-mono">{claim.data}</p>
              </div>
            )}
          </div>
        )}

        {/* Triple info */}
        {claim.type === 'Triple' && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { role: 'Subject', label: claim.subjectLabel, image: claim.subjectImage },
              { role: 'Predicate', label: claim.predicateLabel, image: claim.predicateImage },
              { role: 'Object', label: claim.objectLabel, image: claim.objectImage },
            ].map(({ role, label, image }) => (
              <div key={role} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 sm:p-4">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{role}</p>
                <div className="flex items-center gap-2">
                  {image && <img src={image} alt={label} className="w-6 h-6 rounded-full flex-shrink-0" />}
                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Support / Oppose toggle */}
        {hasOppose && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Viewing:</span>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm font-semibold">
              <button
                onClick={() => setSideMode('support')}
                className={`px-5 py-2 transition-colors cursor-pointer ${
                  sideMode === 'support'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
                }`}
              >
                Support
              </button>
              <button
                onClick={() => setSideMode('oppose')}
                className={`px-5 py-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${
                  sideMode === 'oppose'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600'
                }`}
              >
                Oppose
              </button>
            </div>
            {side?.type && (
              <span className="text-xs text-slate-400 dark:text-slate-500">Type: {side.type}</span>
            )}
          </div>
        )}

        {/* No oppose data notice */}
        {!hasOppose && claim.type === 'Triple' && (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">No opposing vault data available for this claim.</p>
        )}

        {/* Market overview */}
        {side && (
          <>
            <SectionTitle>{sideMode === 'support' ? 'Support' : 'Oppose'} — Market Overview</SectionTitle>
            {/* Term-level totals (Linear + Exponential combined) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Total Mkt Cap — Lin+Exp (TRUST)" value={fmt(side.totalMarketCap)} />
              <StatCard label="Total Assets — Lin+Exp (TRUST)" value={fmt(side.totalAssets)} />
              {/* Linear vault (vaults[0] — always present) */}
              <StatCard label="Market Cap — Linear (TRUST)" value={fmt(side.linMarketCap)} />
              <StatCard label="Total Assets — Linear (TRUST)" value={fmt(side.linTotalAssets)} />
              <StatCard label="Total Shares — Linear" value={fmt(side.linTotalShares)} />
              <StatCard label="Share Price — Linear (TRUST)" value={fmt(side.linSharePrice, 6)} />
              <StatCard label="Positions — Linear" value={String(side.linPositionCount ?? 0)} />
              {/* Exponential vault (vaults[1] — shown when present) */}
              {side.expMarketCap !== null && side.expMarketCap !== undefined && (
                <>
                  <StatCard label="Market Cap — Exponential (TRUST)" value={fmt(side.expMarketCap)} />
                  <StatCard label="Total Assets — Exponential (TRUST)" value={fmt(side.expTotalAssets ?? 0)} />
                  <StatCard label="Total Shares — Exponential" value={fmt(side.expTotalShares ?? 0)} />
                  <StatCard label="Share Price — Exponential (TRUST)" value={fmt(side.expSharePrice ?? 0, 6)} />
                  <StatCard label="Positions — Exponential" value={String(side.expPositionCount ?? 0)} />
                  <StatCard
                    label="24h Price Change — Exponential"
                    value={`${side.sharePriceChange24h >= 0 ? '+' : ''}${side.sharePriceChange24h.toFixed(3)}%`}
                    accent={side.sharePriceChange24h >= 0 ? 'green' : 'red'}
                  />
                  {side.sharePriceStats && (
                    <StatCard label="24h Change Count — Exponential" value={String(side.sharePriceStats.changeCount)} />
                  )}
                </>
              )}
            </div>

            {side.sharePriceStats && (
              <>
                <SectionTitle>Share Price Statistics (24h)</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="First Price" value={fmt(side.sharePriceStats.firstSharePrice, 6)} />
                  <StatCard label="Last Price" value={fmt(side.sharePriceStats.lastSharePrice, 6)} />
                  <StatCard
                    label="Difference"
                    value={fmt(side.sharePriceStats.difference, 6)}
                    accent={side.sharePriceStats.difference >= 0 ? 'green' : 'red'}
                  />
                  <StatCard label="Change Count" value={String(side.sharePriceStats.changeCount)} />
                </div>
              </>
            )}

            {/* Positions by Curve — source differs by type and side:
                Atoms:           term.vaults[0/1].positions (linVaultPositions / expVaultPositions)
                Claims support:  claim.triplePositions  — fetched via root positions query, vault.curve_id
                Claims oppose:   claim.opposePositions  — same query for counter_term */}
            {claim.type === 'Triple' ? (() => {
              const src = sideMode === 'support'
                ? (claim.triplePositions || [])
                : (claim.opposePositions || [])
              const linPos = src.filter((p: any) => p.curveId === 1)
              const expPos = src.filter((p: any) => p.curveId === 2)
              const otherPos = src.filter((p: any) => p.curveId !== 1 && p.curveId !== 2)
              const PosTbl = ({ rows, label }: { rows: any[]; label: string }) => (
                <>
                  <SectionTitle>{label} ({rows.length})</SectionTitle>
                  <TableWrap>
                    <thead><tr>
                      <Th>Wallet Address</Th>
                      <Th center>Shares</Th>
                      <Th center>Deposited (TRUST)</Th>
                      <Th center>Redeemed (TRUST)</Th>
                    </tr></thead>
                    <tbody>
                      {rows.length === 0
                        ? <EmptyRow cols={4} msg={`No ${label.toLowerCase()}`} />
                        : rows.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <Td mono><span className="select-all">{p.accountId}</span></Td>
                            <Td center><span className="text-sky-600 dark:text-sky-400 font-semibold">{fmt(p.shares, 6)}</span></Td>
                            <Td center><span className="text-emerald-600 dark:text-emerald-400">{fmt(p.totalDepositAssetsAfterTotalFees, 6)}</span></Td>
                            <Td center><span className="text-orange-600 dark:text-orange-400">{fmt(p.totalRedeemAssetsForReceiver, 6)}</span></Td>
                          </tr>
                        ))}
                    </tbody>
                  </TableWrap>
                </>
              )
              return (
                <>
                  <PosTbl rows={linPos} label="Positions — Linear Curve" />
                  <PosTbl rows={expPos} label="Positions — Exponential Curve" />
                  {otherPos.length > 0 && <PosTbl rows={otherPos} label="Positions — Other Curve" />}
                </>
              )
            })() : (
              <>
                {/* Atom: vault-level positions per curve */}
                <SectionTitle>Positions — Linear Curve ({side.linVaultPositions?.length ?? 0})</SectionTitle>
                <TableWrap>
                  <thead><tr>
                    <Th>Wallet Address</Th>
                    <Th center>Shares</Th>
                    <Th center>Deposited (TRUST)</Th>
                    <Th center>Redeemed (TRUST)</Th>
                  </tr></thead>
                  <tbody>
                    {(side.linVaultPositions?.length ?? 0) === 0
                      ? <EmptyRow cols={4} msg="No linear curve positions" />
                      : side.linVaultPositions.map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <Td mono><span className="select-all">{p.accountId}</span></Td>
                          <Td center><span className="text-sky-600 dark:text-sky-400 font-semibold">{fmt(p.shares, 6)}</span></Td>
                          <Td center><span className="text-emerald-600 dark:text-emerald-400">{fmt(p.totalDepositAssetsAfterTotalFees, 6)}</span></Td>
                          <Td center><span className="text-orange-600 dark:text-orange-400">{fmt(p.totalRedeemAssetsForReceiver, 6)}</span></Td>
                        </tr>
                      ))}
                  </tbody>
                </TableWrap>
                <SectionTitle>Positions — Exponential Curve ({side.expVaultPositions?.length ?? 0})</SectionTitle>
                <TableWrap>
                  <thead><tr>
                    <Th>Wallet Address</Th>
                    <Th center>Shares</Th>
                    <Th center>Deposited (TRUST)</Th>
                    <Th center>Redeemed (TRUST)</Th>
                  </tr></thead>
                  <tbody>
                    {(side.expVaultPositions?.length ?? 0) === 0
                      ? <EmptyRow cols={4} msg="No exponential curve positions" />
                      : side.expVaultPositions.map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <Td mono><span className="select-all">{p.accountId}</span></Td>
                          <Td center><span className="text-sky-600 dark:text-sky-400 font-semibold">{fmt(p.shares, 6)}</span></Td>
                          <Td center><span className="text-emerald-600 dark:text-emerald-400">{fmt(p.totalDepositAssetsAfterTotalFees, 6)}</span></Td>
                          <Td center><span className="text-orange-600 dark:text-orange-400">{fmt(p.totalRedeemAssetsForReceiver, 6)}</span></Td>
                        </tr>
                      ))}
                  </tbody>
                </TableWrap>
              </>
            )}

            {/* Vault Deposits */}
            <SectionTitle>Vault Deposits ({side.vaultDeposits.length})</SectionTitle>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Deposit ID</Th>
                  <Th center>Shares</Th>
                  <Th center>Date</Th>
                </tr>
              </thead>
              <tbody>
                {side.vaultDeposits.length === 0
                  ? <EmptyRow cols={3} msg="No vault deposits" />
                  : [...side.vaultDeposits].sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <Td mono>{shortAddr(d.id)}</Td>
                      <Td center><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(d.shares, 6)}</span></Td>
                      <Td center>{fmtDate(d.createdAt)}</Td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>

            {/* Vault Redemptions */}
            <SectionTitle>Vault Redemptions ({side.vaultRedemptions.length})</SectionTitle>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Redemption ID</Th>
                  <Th center>Shares</Th>
                  <Th center>Date</Th>
                </tr>
              </thead>
              <tbody>
                {side.vaultRedemptions.length === 0
                  ? <EmptyRow cols={3} msg="No vault redemptions" />
                  : [...side.vaultRedemptions].sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <Td mono>{shortAddr(r.id)}</Td>
                      <Td center><span className="text-rose-600 dark:text-rose-400 font-semibold">{fmt(r.shares, 6)}</span></Td>
                      <Td center>{fmtDate(r.createdAt)}</Td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>

            {/* Term-level Deposits */}
            {side.termDeposits.length > 0 && (
              <>
                <SectionTitle>Term Deposits ({side.termDeposits.length})</SectionTitle>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>ID</Th>
                      <Th>Sender</Th>
                      <Th center>Assets (TRUST)</Th>
                      <Th center>Total Shares</Th>
                      <Th center>Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...side.termDeposits].sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <Td mono>{shortAddr(d.id)}</Td>
                        <Td mono>{shortAddr(d.senderId)}</Td>
                        <Td center><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(d.assets, 4)}</span></Td>
                        <Td center>{fmt(d.totalShares, 4)}</Td>
                        <Td center>{fmtDate(d.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </>
            )}

            {/* Term-level Redemptions */}
            {side.termRedemptions.length > 0 && (
              <>
                <SectionTitle>Term Redemptions ({side.termRedemptions.length})</SectionTitle>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>ID</Th>
                      <Th>Receiver</Th>
                      <Th center>Assets (TRUST)</Th>
                      <Th center>Total Shares</Th>
                      <Th center>Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...side.termRedemptions].sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <Td mono>{shortAddr(r.id)}</Td>
                        <Td mono>{shortAddr(r.receiverId)}</Td>
                        <Td center><span className="text-rose-600 dark:text-rose-400 font-semibold">{fmt(r.assets, 4)}</span></Td>
                        <Td center>{fmt(r.totalShares, 4)}</Td>
                        <Td center>{fmtDate(r.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </>
            )}

            {/* Term-level Positions */}
            {side.termPositions.length > 0 && (
              <>
                <SectionTitle>Term Positions ({side.termPositions.length})</SectionTitle>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Wallet Address</Th>
                      <Th center>Shares</Th>
                      <Th center>Deposited (TRUST)</Th>
                      <Th center>Redeemed (TRUST)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {side.termPositions.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <Td mono><span className="select-all">{p.accountId}</span></Td>
                        <Td center><span className="text-sky-600 dark:text-sky-400 font-semibold">{fmt(p.shares, 6)}</span></Td>
                        <Td center><span className="text-emerald-600 dark:text-emerald-400">{fmt(p.totalDepositAssetsAfterTotalFees, 6)}</span></Td>
                        <Td center><span className="text-orange-600 dark:text-orange-400">{fmt(p.totalRedeemAssetsForReceiver, 6)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </>
            )}
          </>
        )}

        {/* Atom-level positions */}
        {claim.type === 'Atom' && claim.atomPositions?.length > 0 && (
          <>
            <SectionTitle>Atom Positions ({claim.atomPositions.length})</SectionTitle>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Wallet Address</Th>
                  <Th center>Shares</Th>
                  <Th center>Deposited (TRUST)</Th>
                  <Th center>Redeemed (TRUST)</Th>
                </tr>
              </thead>
              <tbody>
                {claim.atomPositions.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <Td mono><span className="select-all">{p.accountId}</span></Td>
                    <Td center><span className="text-sky-600 dark:text-sky-400 font-semibold">{fmt(p.shares, 6)}</span></Td>
                    <Td center><span className="text-emerald-600 dark:text-emerald-400">{fmt(p.totalDepositAssetsAfterTotalFees, 6)}</span></Td>
                    <Td center><span className="text-orange-600 dark:text-orange-400">{fmt(p.totalRedeemAssetsForReceiver, 6)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}


        <div className="h-8" />
      </div>

      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        claimLabel={claim?.label || ''}
        termId={termId || ''}
        mode={existingPrefs ? 'edit' : 'add'}
        initialPrefs={existingPrefs}
        onConfirm={(claimLabel) => {
          addWatchedClaim(claimLabel)
          getClaimAlertPrefs().then(prefs => {
            if (termId && prefs[termId]) setExistingPrefs(prefs[termId])
          }).catch(() => {})
        }}
      />
    </div>
  )
}
