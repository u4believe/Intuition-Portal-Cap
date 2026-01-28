import { NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const ATOMS_QUERY = `
  query TopAtoms {
    atoms {
      label
      image
      creator_id
      wallet_id
      positions {
        account_id
        shares
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
        term {
          total_market_cap
          total_assets
        }
      }
    }
  }
`

export async function GET() {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ATOMS_QUERY,
      }),
    })

    if (!response.ok) {
      throw new Error(`Intuition API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.error("[v0] GraphQL errors:", data.errors)
      return NextResponse.json({ atoms: [] })
    }

    const atoms = (data.data?.atoms || [])
      .map((atom: any, index: number) => {
        // Calculate total market cap from positions
        const totalMarketCapWei =
          atom.positions?.reduce((sum: number, pos: any) => {
            return sum + (pos.term?.total_market_cap || 0)
          }, 0) || 0

        const totalMarketCapEther = totalMarketCapWei / 1e18

        return {
          id: `atom-${index}`,
          label: atom.label || `Atom ${index + 1}`,
          image: atom.image || "",
          creator_id: atom.creator_id || "",
          wallet_id: atom.wallet_id || "",
          market_cap: totalMarketCapEther,
          total_assets: atom.positions?.[0]?.term?.total_assets || 0,
          position_count: atom.positions?.length || 0,
        }
      })
      .sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0))
      .slice(0, 10)
      .map((atom: any, index: number) => ({
        ...atom,
        rank: index + 1,
      }))

    return NextResponse.json({ atoms, success: true })
  } catch (error: any) {
    console.error("[v0] Error fetching top atoms:", error)
    return NextResponse.json({ atoms: [], error: error.message }, { status: 500 })
  }
}
