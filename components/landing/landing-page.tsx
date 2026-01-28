"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { TrendingUp, Zap, Lock, ArrowRight } from "lucide-react"
import TopClaimsDisplay from "./top-claims-display"
import RecentEvents from "./recent-events"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Lore</h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#claims" className="text-sm text-slate-400 hover:text-white transition-colors">
              Top Claims
            </a>
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">
              Features
            </a>
            <Link href="/auth/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/auth/signup">
              <Button
                size="sm"
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
              >
                Get Started
              </Button>
            </Link>
          </nav>
          <div className="md:hidden flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-cyan-400">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              Monitor Claims in{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Real-Time
              </span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Get instant signals on market cap changes, price movements, and position updates for your favorite claims
              and identities on Intuition.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 gap-2"
              >
                Start Watching <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#claims">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 bg-transparent"
              >
                View Claims
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800">
            <div>
              <div className="text-2xl font-bold text-white">24/7</div>
              <p className="text-sm text-slate-400">Monitoring</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Instant</div>
              <p className="text-sm text-slate-400">Alerts</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Custom</div>
              <p className="text-sm text-slate-400">Triggers</p>
            </div>
          </div>
        </div>

        {/* Visual Element - Animated Card */}
        <div className="hidden md:block">
          <RecentEvents />
        </div>
      </section>

      {/* Top Claims Section */}
      <section id="claims" className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-800">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl font-bold text-white">Top 10 Claims by Market Cap</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Watch the most active claims and identities. Sign up to get personalized email alerts.
          </p>
        </div>

        <TopClaimsDisplay />
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-800">
        <h2 className="text-4xl font-bold text-white text-center mb-12">Powerful Features</h2>

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
              <Card key={i} className="bg-slate-900 border-slate-700 hover:border-cyan-500/50 transition-colors">
                <CardHeader>
                  <Icon className="w-8 h-8 text-cyan-400 mb-2" />
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-800">
        <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-2xl p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">Ready to monitor your claims?</h2>
          <p className="text-slate-400">Subscribe to email alerts and stay informed about market movements.</p>
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
            >
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>Lore © 2025. Built to monitor the Intuition Portal.</p>
        </div>
      </footer>
    </div>
  )
}
