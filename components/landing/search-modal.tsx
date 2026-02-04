'use client'

import { useEffect, useState } from 'react'
import { Search, X, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface SearchResult {
  id: string
  label: string
  image?: string
  type: 'vault' | 'triple' | 'atom'
  marketCap?: number
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/search-claims?q=${encodeURIComponent(searchQuery)}`
        )
        const data = await response.json()
        setResults(data.results || [])
      } catch (error) {
        console.error('[v0] Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(handleSearch, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Search Input */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vaults, triples, or atoms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-lg"
                  autoFocus
                />
                <button
                  onClick={onClose}
                  className="absolute right-3 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {results.map((result) => (
                    <Link key={`${result.type}-${result.id}`} href={`/vault/${result.id}`}>
                      <div
                        onClick={onClose}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-4"
                      >
                        {result.image && (
                          <img
                            src={result.image || "/placeholder.svg"}
                            alt={result.label}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {result.label}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium capitalize">
                              {result.type}
                            </span>
                            {result.marketCap && (
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                Market Cap: {result.marketCap.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  Start typing to search...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
