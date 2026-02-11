import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const termId = url.searchParams.get("termId")

    if (!termId) {
      return NextResponse.json({ error: "termId parameter required" }, { status: 400 })
    }

    const VAULT_QUERY = `
      query GetVault($id: String!) {
        terms(where: {id: {_eq: $id}}) {
          id
          atom {
            label
            image
          }
          triple {
            subject {
              label
              image
            }
            predicate {
              label
            }
            object {
              label
              image
            }
          }
          vaults {
            market_cap
            position_count
            total_assets
            total_shares
            current_share_price
            positions {
              account_id
              shares
              total_deposit_assets_after_total_fees
              total_redeem_assets_for_receiver
            }
            share_price_change_stats_daily {
              difference
              first_share_price
              last_share_price
              change_count
            }
          }
        }
      }
    `

    const data = await queryIntuitionGraphQL(VAULT_QUERY, { id: termId })

    if (!data?.terms || data.terms.length === 0) {
      return NextResponse.json({ error: "Vault not found", termId }, { status: 404 })
    }

    const term = data.terms[0]
    const triple = term.triple
    const atom = term.atom
    const vault = term.vaults?.[0]

    // Determine if it's a triple or atom
    const isTriple = !!triple
    const isAtom = !!atom

    let claim: any = {
      termId: term.id,
      type: isTriple ? "Triple" : isAtom ? "Atom" : "Unknown",
    }

    if (isTriple) {
      claim.label = `${triple.subject?.label || "Unknown"} - ${triple.predicate?.label || "Unknown"} - ${triple.object?.label || "Unknown"}`
      claim.subjectLabel = triple.subject?.label || "Unknown"
      claim.subjectType = ""
      claim.predicateLabel = triple.predicate?.label || "Unknown"
      claim.predicateType = ""
      claim.objectLabel = triple.object?.label || "Unknown"
      claim.objectType = ""
      claim.image = triple.subject?.image || null
    } else if (isAtom) {
      claim.label = atom.label || "Unknown"
      claim.subjectLabel = ""
      claim.subjectType = ""
      claim.predicateLabel = ""
      claim.predicateType = ""
      claim.objectLabel = ""
      claim.objectType = ""
      claim.image = atom.image || null
    }

    if (vault) {
      claim.marketCap = vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
      claim.totalAssets = vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
      claim.totalShares = vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
      claim.currentSharePrice = vault.current_share_price ? parseFloat(vault.current_share_price) / 1e18 : 0
      claim.positionCount = vault.position_count || 0

      const sharePriceChange = vault.share_price_change_stats_daily?.[0]
      if (sharePriceChange) {
        const lastPrice = parseFloat(sharePriceChange.last_share_price || "0") / 1e18
        const firstPrice = parseFloat(sharePriceChange.first_share_price || "0") / 1e18
        if (firstPrice > 0) {
          claim.sharePriceChange24h = ((lastPrice - firstPrice) / firstPrice) * 100
        } else {
          claim.sharePriceChange24h = 0
        }
      }

      claim.positions = (vault.positions || []).map((pos: any) => ({
        accountId: pos.account_id,
        shares: pos.shares ? parseFloat(pos.shares) / 1e18 : 0,
        totalDepositAssetsAfterTotalFees: pos.total_deposit_assets_after_total_fees ? parseFloat(pos.total_deposit_assets_after_total_fees) / 1e18 : 0,
        totalRedeemAssetsForReceiver: pos.total_redeem_assets_for_receiver ? parseFloat(pos.total_redeem_assets_for_receiver) / 1e18 : 0,
      }))
    } else {
      claim.marketCap = 0
      claim.totalAssets = 0
      claim.totalShares = 0
      claim.currentSharePrice = 0
      claim.positionCount = 0
      claim.sharePriceChange24h = 0
      claim.positions = []
    }

    claim.deposits = []
    claim.redemptions = []

    return NextResponse.json({ claim })
  } catch (error) {
    console.error("[v0] Error fetching vault:", error)
    return NextResponse.json({ error: "Failed to fetch vault" }, { status: 500 })
  }
}
