"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, X, TrendingUp } from "lucide-react"
import { toast } from "sonner"

interface Triple {
  id: string
  label: string
  image: string
  type: "claim" | "identity" | "atom"
  market_cap: number
  position_count: number
}

interface WatchedTriple extends Triple {
  created_at: string
}

interface TripleAtomSelectorProps {
  userId: string
  preferences: any
}

export default function TripleAtomSelector({ userId, preferences }: TripleAtomSelectorProps) {
  const [availableTriples, setAvailableTriples] = useState<Triple[]>([])
  const [watchedTriples, setWatchedTriples] = useState<WatchedTriple[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Fetch watched triples
  useEffect(() => {
    async function fetchWatchedTriples() {
      try {
        if (!preferences?.id) {
          setFetching(false)
          return
        }

        const { data, error } = await supabase
          .from("watched_triples")
          .select("*")
          .eq("preference_id", preferences.id)
          .order("created_at", { ascending: false })

        if (error && error.code !== "PGRST116") {
          console.error("[v0] Error fetching watched triples:", error)
        }

        setWatchedTriples(data || [])
      } catch (error) {
        console.error("[v0] Error:", error)
      } finally {
        setFetching(false)
      }
    }

    fetchWatchedTriples()
  }, [preferences?.id, supabase])

  // Search triples
  async function handleSearch() {
    if (!searchQuery.trim()) {
      setAvailableTriples([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/search-triples?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error("Search failed")
      const data = await response.json()
      setAvailableTriples(data.triples || [])
    } catch (error) {
      console.error("[v0] Search error:", error)
      toast.error("Failed to search triples")
    } finally {
      setLoading(false)
    }
  }

  // Add triple to watch list
  async function addToWatch(triple: Triple) {
    if (!preferences?.id) {
      toast.error("Please save preferences first")
      return
    }

    try {
      const { error } = await supabase.from("watched_triples").insert([
        {
          preference_id: preferences.id,
          triple_id: triple.id,
          label: triple.label,
          image: triple.image,
          type: triple.type,
          market_cap: triple.market_cap,
          position_count: triple.position_count,
        },
      ])

      if (error) throw error

      setWatchedTriples([
        ...watchedTriples,
        {
          ...triple,
          created_at: new Date().toISOString(),
        },
      ])

      toast.success(`Added ${triple.label} to watch list`)
      setSearchQuery("")
      setAvailableTriples([])
    } catch (error: any) {
      console.error("[v0] Error adding triple:", error)
      toast.error("Failed to add triple")
    }
  }

  // Remove triple from watch list
  async function removeFromWatch(tripleId: string) {
    try {
      const { error } = await supabase
        .from("watched_triples")
        .delete()
        .eq("triple_id", tripleId)
        .eq("preference_id", preferences?.id)

      if (error) throw error

      setWatchedTriples(watchedTriples.filter((t) => t.id !== tripleId))
      toast.success("Removed from watch list")
    } catch (error: any) {
      console.error("[v0] Error removing triple:", error)
      toast.error("Failed to remove triple")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Claims & Atoms</CardTitle>
        <CardDescription>
          Select specific claims or atoms to monitor for market cap, price, and position changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search claims, atoms, identities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Search Results */}
          {availableTriples.length > 0 && (
            <ScrollArea className="h-64 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="space-y-2">
                {availableTriples.map((triple) => (
                  <div
                    key={triple.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {triple.image && (
                        <img
                          src={triple.image || "/placeholder.svg"}
                          alt={triple.label}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = "https://via.placeholder.com/32"
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{triple.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {(triple.market_cap / 1e9).toFixed(2)}B • {triple.position_count} positions
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addToWatch(triple)}
                      className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Watched Triples */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Watching ({watchedTriples.length})</h3>

          {watchedTriples.length === 0 ? (
            <div className="p-6 text-center rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
              <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No claims added yet. Search and add your first one above.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {watchedTriples.map((triple) => (
                <div
                  key={triple.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {triple.image && (
                      <img
                        src={triple.image || "/placeholder.svg"}
                        alt={triple.label}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/32"
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{triple.label}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {triple.type}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFromWatch(triple.id)}
                    className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
