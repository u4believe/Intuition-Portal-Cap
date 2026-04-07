import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

// Fetches positions for a term via the root positions table.
// curve_id lives on the vault, not the position row — this is the canonical pattern
// from graphql-queries.md ("Positions by Account").
const POSITIONS_QUERY = `
  query GetTermPositions($termId: String!) {
    positions(
      where: { vault: { term: { id: { _eq: $termId } } } }
      order_by: { shares: desc }
    ) {
      account_id
      shares
      total_deposit_assets_after_total_fees
      total_redeem_assets_for_receiver
      vault { curve_id }
    }
  }
`

const VAULT_QUERY = `
  query GetVault($id: String!) {
    terms(where: {id: {_eq: $id}}) {
      id
      type
      total_market_cap
      total_assets
      atom {
        label
        image
        emoji
        type
        data
        created_at
        creator {
          id
          label
          image
        }
        positions {
          id
          account_id
          shares
          total_deposit_assets_after_total_fees
          total_redeem_assets_for_receiver
        }
      }
      triple {
        subject { label image }
        predicate { label image }
        object { label image }
        counter_term {
          id
          type
          total_market_cap
          total_assets
          vaults {
            total_shares
            market_cap
            total_assets
            position_count
            current_share_price
            share_price_change_stats_daily {
              difference
              first_share_price
              last_share_price
              change_count
            }
            deposits { id created_at shares }
            redemptions { id created_at shares }
          }
          deposits {
            id
            assets_after_fees
            created_at
            total_shares
            sender_id
          }
          redemptions {
            id
            assets
            created_at
            total_shares
            receiver_id
          }
        }
      }
      vaults {
        total_shares
        market_cap
        total_assets
        position_count
        current_share_price
        share_price_change_stats_daily {
          difference
          first_share_price
          last_share_price
          change_count
        }
        deposits { id created_at shares }
        redemptions { id created_at shares }
        positions {
          account_id
          shares
          total_deposit_assets_after_total_fees
          total_redeem_assets_for_receiver
        }
      }
      positions {
        account_id
        shares
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
      }
      deposits {
        id
        assets_after_fees
        created_at
        total_shares
        sender_id
      }
      redemptions {
        id
        assets
        created_at
        total_shares
        receiver_id
      }
    }
  }
`

function parseAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 0
  return n / 1e18
}

function buildSide(termData: any) {
  if (!termData) return null
  // vaults[0] = Linear bonding curve (primary/first created vault)
  // vaults[1] = Exponential bonding curve (secondary vault, may not always be present in results)
  const linVault = termData.vaults?.[0] ?? null
  const expVault = termData.vaults?.[1] ?? null
  // Deposits/redemptions/positions tables use the Exponential vault (vaults[1])
  // Share price change stats come from the Exponential vault
  const vault = expVault ?? linVault  // prefer Exponential; fall back to Linear if only one vault returned
  const spc = vault?.share_price_change_stats_daily?.[0] ?? null
  let sharePriceChange24h = 0
  if (spc) {
    const last = parseAmount(spc.last_share_price)
    const first = parseAmount(spc.first_share_price)
    if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
  }

  return {
    type: termData.type || '',
    // Term-level totals (Exponential + Linear combined)
    totalMarketCap: parseAmount(termData.total_market_cap),
    totalAssets: parseAmount(termData.total_assets),
    // Exponential vault metrics (vault[1])
    expMarketCap: expVault ? parseAmount(expVault.market_cap) : null,
    expTotalAssets: expVault ? parseAmount(expVault.total_assets) : null,
    expTotalShares: expVault ? parseAmount(expVault.total_shares) : null,
    expSharePrice: expVault ? parseAmount(expVault.current_share_price) : null,
    expPositionCount: expVault ? (expVault.position_count || 0) : null,
    // Linear vault metrics (vault[0])
    linMarketCap: parseAmount(linVault?.market_cap),
    linTotalAssets: parseAmount(linVault?.total_assets),
    linTotalShares: parseAmount(linVault?.total_shares),
    linSharePrice: parseAmount(linVault?.current_share_price),
    linPositionCount: linVault?.position_count || 0,
    // Legacy aliases (prefer Exponential; fall back to Linear) — kept for existing consumers
    marketCap: parseAmount((expVault ?? linVault)?.market_cap),
    vaultTotalAssets: parseAmount((expVault ?? linVault)?.total_assets),
    totalShares: parseAmount((expVault ?? linVault)?.total_shares),
    currentSharePrice: parseAmount((expVault ?? linVault)?.current_share_price),
    positionCount: (expVault ?? linVault)?.position_count || 0,
    sharePriceChange24h,
    sharePriceStats: spc ? {
      difference: parseAmount(spc.difference),
      firstSharePrice: parseAmount(spc.first_share_price),
      lastSharePrice: parseAmount(spc.last_share_price),
      changeCount: spc.change_count || 0,
    } : null,
    vaultDeposits: (vault?.deposits || []).map((d: any) => ({
      id: d.id,
      shares: parseAmount(d.shares),
      createdAt: d.created_at,
    })),
    vaultRedemptions: (vault?.redemptions || []).map((r: any) => ({
      id: r.id,
      shares: parseAmount(r.shares),
      createdAt: r.created_at,
    })),
    vaultPositions: (vault?.positions || []).map((p: any) => ({
      accountId: p.account_id,
      shares: parseAmount(p.shares),
      totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
      totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    })),
    linVaultPositions: (linVault?.positions || []).map((p: any) => ({
      accountId: p.account_id,
      shares: parseAmount(p.shares),
      totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
      totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    })),
    expVaultPositions: expVault ? (expVault.positions || []).map((p: any) => ({
      accountId: p.account_id,
      shares: parseAmount(p.shares),
      totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
      totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    })) : [],
    termDeposits: (termData.deposits || []).map((d: any) => ({
      id: d.id,
      assets: parseAmount(d.assets_after_fees),
      totalShares: parseAmount(d.total_shares),
      senderId: d.sender_id,
      createdAt: d.created_at,
    })),
    termRedemptions: (termData.redemptions || []).map((r: any) => ({
      id: r.id,
      assets: parseAmount(r.assets),
      totalShares: parseAmount(r.total_shares),
      receiverId: r.receiver_id,
      createdAt: r.created_at,
    })),
    termPositions: (termData.positions || []).map((p: any) => ({
      accountId: p.account_id,
      shares: parseAmount(p.shares),
      totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
      totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    })),
  }
}

function mapPositions(rows: any[]) {
  return rows.map((p: any) => ({
    accountId: p.account_id,
    shares: parseAmount(p.shares),
    totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
    totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    // curve_id lives on vault, not position — accessed via vault { curve_id }
    curveId: p.vault?.curve_id != null ? Number(p.vault.curve_id) : null,
  }))
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const termId = url.searchParams.get("termId")

    if (!termId) {
      return NextResponse.json({ error: "termId parameter required" }, { status: 400 })
    }

    const data = await queryIntuitionGraphQL(VAULT_QUERY, { id: termId })

    if (!data?.terms || data.terms.length === 0) {
      return NextResponse.json({ error: "Vault not found", termId }, { status: 404 })
    }

    const term = data.terms[0]
    const triple = term.triple
    const atom = term.atom
    const isTriple = !!triple
    const isAtom = !!atom

    const claim: any = {
      termId: term.id,
      type: isTriple ? "Triple" : isAtom ? "Atom" : "Unknown",
    }

    if (isTriple) {
      claim.label = `${triple.subject?.label || "Unknown"} - ${triple.predicate?.label || "Unknown"} - ${triple.object?.label || "Unknown"}`
      claim.subjectLabel = triple.subject?.label || "Unknown"
      claim.subjectImage = triple.subject?.image && triple.subject.image !== 'null' ? triple.subject.image : null
      claim.predicateLabel = triple.predicate?.label || "Unknown"
      claim.predicateImage = triple.predicate?.image && triple.predicate.image !== 'null' ? triple.predicate.image : null
      claim.objectLabel = triple.object?.label || "Unknown"
      claim.objectImage = triple.object?.image && triple.object.image !== 'null' ? triple.object.image : null
      claim.image = claim.subjectImage
      claim.support = buildSide(term)
      claim.oppose = buildSide(triple.counter_term) || null

      // Fetch positions via root positions table — curve_id is on vault, not position row
      const counterTermId = triple.counter_term?.id || null
      const [supportPosData, opposePosData] = await Promise.all([
        queryIntuitionGraphQL(POSITIONS_QUERY, { termId }),
        counterTermId
          ? queryIntuitionGraphQL(POSITIONS_QUERY, { termId: counterTermId })
          : Promise.resolve(null),
      ])
      claim.triplePositions = mapPositions(supportPosData?.positions || [])
      claim.opposePositions = mapPositions(opposePosData?.positions || [])
    } else {
      claim.label = atom?.label || "Unknown"
      claim.image = atom?.image && atom.image !== 'null' ? atom.image : null
      claim.emoji = atom?.emoji || ''
      claim.atomType = atom?.type || ''
      claim.data = atom?.data || ''
      claim.createdAt = atom?.created_at || ''
      claim.creator = atom?.creator ? {
        id: atom.creator.id || '',
        label: atom.creator.label || '',
        image: atom.creator.image && atom.creator.image !== 'null' ? atom.creator.image : null,
      } : null
      claim.atomPositions = (atom?.positions || []).map((p: any) => ({
        id: p.id,
        accountId: p.account_id,
        shares: parseAmount(p.shares),
        totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
        totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
      }))
      claim.subjectLabel = ""
      claim.predicateLabel = ""
      claim.objectLabel = ""
      claim.support = buildSide(term)
      claim.oppose = null
      claim.triplePositions = []
    }

    // Legacy flat fields for any existing consumers
    claim.marketCap = claim.support?.marketCap ?? 0
    claim.totalAssets = claim.support?.vaultTotalAssets ?? 0
    claim.totalShares = claim.support?.totalShares ?? 0
    claim.currentSharePrice = claim.support?.currentSharePrice ?? 0
    claim.positionCount = claim.support?.positionCount ?? 0
    claim.sharePriceChange24h = claim.support?.sharePriceChange24h ?? 0
    claim.positions = claim.support?.vaultPositions ?? []
    claim.deposits = claim.support?.vaultDeposits ?? []
    claim.redemptions = claim.support?.vaultRedemptions ?? []

    return NextResponse.json({ claim })
  } catch (error) {
    console.error("[v0] Error fetching vault:", error)
    return NextResponse.json({ error: "Failed to fetch vault" }, { status: 500 })
  }
}
