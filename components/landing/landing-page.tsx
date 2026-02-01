"use client"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useUserPreferences } from "@/hooks/useUserPreferences" // Import useUserPreferences hook
import { Search, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { TrendingUp, Zap, Lock, ArrowRight } from "lucide-react"
import RecentEvents from "./recent-events"
import LiveEvents from "./live-events"
import ClaimsTable from "./claims-table"
import TriplesTable from "./triples-table"
import AtomsTable from "./atoms-table"

export default function LandingPage() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'vaults' | 'tripples' | 'atoms'>('vaults')
  const { getWatchedClaims } = useUserPreferences() // Declare useUserPreferences hook
  const watchedClaims = getWatchedClaims()

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-lg sticky top-0 z-50">
        <div className="w-full px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-[5.625rem]">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0">
              <img 
                src="/logo.jpg" 
                alt="Portal Cap Logo" 
                className="h-12 w-auto rounded-full"
              />
            </Link>
            <Link href="/dashboard" className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-all">
              Dashboard
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-sm text-black"
              >
                <Search className="w-4 h-4" />
                <span>Search Claims</span>
              </button>
              {searchOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50">
                  <input
                    type="text"
                    placeholder="Search claims..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => setWatchlistOpen(!watchlistOpen)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-black hover:text-slate-900"
            >
              <Star className="w-4 h-4" />
              <span>Watchlist</span>
              {watchedClaims.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {watchedClaims.length}
                </span>
              )}
            </button>

            {watchlistOpen && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50 max-h-[400px] overflow-y-auto">
                {watchedClaims.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 mb-4">Your Watchlist ({watchedClaims.length})</h3>
                    {watchedClaims.map((claim, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm text-slate-700">{claim}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-8">
                    No claims in your watchlist yet
                  </div>
                )}
              </div>
            )}

            <a href="#features" className="text-sm text-black hover:text-primary transition-colors">
              Features
            </a>
            
            {/* Sign In Dropdown */}
            <div className="relative group">
              <button className="text-sm text-black hover:text-primary transition-colors font-medium">
                Sign In
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link href="/auth/login?method=email" className="block px-4 py-2 text-sm text-black hover:bg-slate-100 rounded transition-colors">
                  Sign In with Email
                </Link>
                <Link href="/auth/login?method=wallet" className="block px-4 py-2 text-sm text-black hover:bg-slate-100 rounded transition-colors">
                  Sign In with Wallet
                </Link>
              </div>
            </div>

            <Link href="/auth/signup">
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Get Started
              </Button>
            </Link>
          </nav>
          <div className="md:hidden flex gap-2">
            <div className="relative group">
              <Button variant="ghost" size="sm" className="text-black hover:text-primary">
                Sign In
              </Button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link href="/auth/login?method=email" className="block px-4 py-2 text-sm text-black hover:bg-slate-100 rounded transition-colors">
                  Email
                </Link>
                <Link href="/auth/login?method=wallet" className="block px-4 py-2 text-sm text-black hover:bg-slate-100 rounded transition-colors">
                  Wallet
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
              Monitor Claims in{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Real-Time
              </span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Get instant signals on market cap changes, price movements, and position updates for your favorite claims
              and identities on Intuition.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link href="#claims">
              <Button
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white gap-2"
              >
                Start Watching <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#claims">
              <Button
                size="lg"
                variant="outline"
                className="border-teal-200 text-teal-700 hover:bg-teal-50 bg-transparent"
              >
                View Claims
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200">
            <div>
              <div className="text-2xl font-bold text-slate-900">24/7</div>
              <p className="text-sm text-slate-600">Monitoring</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">Instant</div>
              <p className="text-sm text-slate-600">Alerts</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">Custom</div>
              <p className="text-sm text-slate-600">Triggers</p>
            </div>
          </div>
        </div>

        {/* Visual Element - Animated Card */}
        <div className="hidden md:block">
          <RecentEvents />
        </div>
      </section>

      {/* All Claims Table Section */}
      <section id="claims" className="w-full bg-gradient-to-b from-slate-50 to-white border-t border-slate-200 py-20">
        <div className="w-full px-0 space-y-8">
          {/* Tab Toggle Buttons */}
          <div className="flex justify-center gap-4 px-4">
            <button
              onClick={() => setActiveTab('vaults')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'vaults'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Vaults
            </button>
            <button
              onClick={() => setActiveTab('tripples')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'tripples'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Tripples
            </button>
            <button
              onClick={() => setActiveTab('atoms')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'atoms'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Atoms
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'vaults' && <ClaimsTable />}
          {activeTab === 'tripples' && <TriplesTable />}
          {activeTab === 'atoms' && <AtomsTable />}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-200">
        <h2 className="text-4xl font-bold text-slate-900 text-center mb-12">Powerful Features</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: "Real-Time Monitoring",
              description: "Get instant updates on market cap, share price, and position changes across all claims.",
            },
            {
              icon: Zap,
              title: "Custom Alerts",
              description: "Set up personalized triggers for price changes, market cap shifts, and position updates.",
            },
            {
              icon: Lock,
              title: "Secure & Private",
              description: "Your data is encrypted and secure. We never share your information with third parties.",
            },
          ].map((feature, i) => {
            const Icon = feature.icon
            return (
              <Card key={i} className="bg-white border-slate-200 hover:border-teal-400 transition-colors shadow-sm">
                <CardHeader>
                  <Icon className="w-8 h-8 text-teal-600 mb-2" />
                  <CardTitle className="text-slate-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-200">
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-slate-900">Ready to monitor your claims?</h2>
          <p className="text-slate-600">Subscribe to email alerts and stay informed about market movements.</p>
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white"
            >
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-600 text-sm">
          <p>Intuition Portal Cap © 2025. Built to monitor the Intuition Portal.</p>
        </div>
      </footer>
    </div>
  )
}
