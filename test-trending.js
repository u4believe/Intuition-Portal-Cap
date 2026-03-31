const fetch = require('node-fetch'); // we might not need node-fetch if Node 18+

async function run() {
  const query = `
  query GetVaults($limit: Int) {
    vaults(limit: $limit, order_by: {market_cap: desc}) {
      term_id
      market_cap
      term {
        atom { label }
        triple { subject { label } predicate { label } object { label } }
      }
      share_price_change_stats_daily {
        difference
        first_share_price
        last_share_price
        change_count
      }
    }
  }
  `;
  const res = await fetch("https://mainnet.intuition.sh/v1/graphql", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { limit: 200 } })
  }).then(r => r.json());
  
  const vaults = res.data.vaults;
  console.log("Vaults fetched:", vaults.length);

  let bestAtom = null;
  let bestAtomScore = -Infinity;
  let bestTriple = null;
  let bestTripleScore = -Infinity;

  for (const v of vaults) {
    const stats = v.share_price_change_stats_daily?.[0];
    if (!stats) continue;

    const first = parseFloat(stats.first_share_price || "0") / 1e18;
    const last = parseFloat(stats.last_share_price || "0") / 1e18;
    
    const marketCap = parseFloat(v.market_cap || "0") / 1e18;
    if (marketCap < 1) continue;

    let pctChange = 0;
    if (first >= 0.001) {
      pctChange = ((last - first) / first) * 100;
    } else {
      continue;
    }

    let momentumScore = (pctChange * 0.3); // ignore volume/adoption for test simulation

    if (v.term?.atom) {
      if (momentumScore > bestAtomScore) {
        bestAtomScore = momentumScore;
        bestAtom = v;
      }
    } else if (v.term?.triple) {
      if (momentumScore > bestTripleScore) {
        bestTripleScore = momentumScore;
        bestTriple = v;
      }
    }
  }
  console.log("Best Atom:", bestAtom ? bestAtom.term.atom.label : "None", "Score:", bestAtomScore);
  console.log("Best Triple:", bestTriple ? "Found" : "None", "Score:", bestTripleScore);
}
run();
