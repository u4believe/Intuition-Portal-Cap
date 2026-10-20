'use strict'

/**
 * Pattern measurements over collected Intuition activity (see collector.js).
 * Each metric is computed per window (7 and 30 days) and stored in
 * pattern_metrics as JSON. Aggregates only: no wallet addresses are stored.
 *
 * Vocabulary: "creation deposit" = the deposit made in the same transaction
 * that created an atom/claim. Trading metrics exclude those.
 */

const WINDOWS = [7, 30]

const num = (v, digits = 4) => (v == null ? null : Number(Number(v).toFixed(digits)))
const pct = (part, whole) => (whole ? num((100 * Number(part)) / Number(whole), 1) : null)
const quantiles = (arr, labels) => (arr ? Object.fromEntries(labels.map((l, i) => [l, num(arr[i])])) : null)

// Shared building blocks. $1 = window in days.
const WINDOW = `occurred_at >= NOW() - make_interval(days => $1)`
const CREATION_TXS = `SELECT tx_hash FROM intuition_events WHERE kind IN ('atom_created', 'triple_created') AND tx_hash IS NOT NULL`
const TRADES = `SELECT * FROM intuition_events
  WHERE ${WINDOW} AND kind = 'deposit' AND (tx_hash IS NULL OR tx_hash NOT IN (${CREATION_TXS}))`

const METRICS = [
  {
    name: 'activity_heatmap',
    describe: 'When people trade: deposits, redemptions and volume by UTC weekday and hour',
    sql: `SELECT extract(isodow FROM occurred_at)::int AS dow, extract(hour FROM occurred_at)::int AS hour,
                 count(*) FILTER (WHERE kind = 'deposit') AS deposits,
                 count(*) FILTER (WHERE kind = 'redemption') AS redemptions,
                 COALESCE(sum(assets) FILTER (WHERE kind = 'deposit'), 0) AS volume
            FROM intuition_events WHERE ${WINDOW} AND kind IN ('deposit', 'redemption')
           GROUP BY 1, 2`,
    transform(rows) {
      const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const byHour = Array(24).fill(0), byDay = Array(8).fill(0)
      let total = 0
      for (const r of rows) {
        byHour[r.hour] += Number(r.deposits)
        byDay[r.dow] += Number(r.deposits)
        total += Number(r.deposits)
      }
      const rank = (arr, start) => arr.map((v, i) => ({ i, v })).slice(start).sort((a, b) => b.v - a.v)
      const hours = rank(byHour, 0), dayRank = rank(byDay, 1)
      return {
        sample: total + rows.reduce((s, r) => s + Number(r.redemptions), 0),
        data: {
          busiest_hours_utc: hours.slice(0, 3).map((h) => ({ hour: h.i, share_pct: pct(h.v, total) })),
          quietest_hours_utc: hours.slice(-3).reverse().map((h) => ({ hour: h.i, share_pct: pct(h.v, total) })),
          busiest_day: dayRank[0] && { day: days[dayRank[0].i], share_pct: pct(dayRank[0].v, total) },
          quietest_day: dayRank.at(-1) && { day: days[dayRank.at(-1).i], share_pct: pct(dayRank.at(-1).v, total) },
          deposits_by_hour_utc: byHour,
          cells: rows.map((r) => ({ dow: r.dow, hour: r.hour, deposits: Number(r.deposits), redemptions: Number(r.redemptions), volume: num(r.volume, 2) })),
        },
      }
    },
  },
  {
    name: 'trade_sizes',
    describe: 'How much people put in or take out per trade (TRUST), and how often the same amount repeats',
    sql: `WITH t AS (SELECT kind, assets, sender FROM intuition_events WHERE ${WINDOW} AND kind IN ('deposit', 'redemption') AND assets > 0),
               repeats AS (SELECT sender, assets, count(*) AS n FROM t WHERE kind = 'deposit' GROUP BY 1, 2)
          SELECT kind, count(*) AS n,
                 percentile_cont(ARRAY[0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) WITHIN GROUP (ORDER BY assets) AS q,
                 sum(assets) AS volume,
                 (SELECT COALESCE(sum(n), 0) FROM repeats WHERE n >= 5) AS repeated_amount_deposits
            FROM t GROUP BY kind`,
    transform(rows) {
      const out = {}
      let sample = 0
      for (const r of rows) {
        sample += Number(r.n)
        out[r.kind] = {
          count: Number(r.n),
          total_trust: num(r.volume, 2),
          trust_percentiles: quantiles(r.q, ['p10', 'p25', 'median', 'p75', 'p90', 'p99']),
        }
        if (r.kind === 'deposit') {
          out.deposit.same_wallet_same_amount_5x_pct = pct(r.repeated_amount_deposits, r.n)
        }
      }
      if (out.deposit && out.redemption) out.deposits_per_redemption = num(out.deposit.count / out.redemption.count, 1)
      return { sample, data: out }
    },
  },
  {
    name: 'balance_usage',
    describe: 'What share of their TRUST balance people commit per buy (trading vs. creating)',
    sql: `WITH d AS (
            SELECT assets / balance_before AS ratio,
                   (tx_hash IN (${CREATION_TXS})) AS is_creation
              FROM intuition_events
             WHERE ${WINDOW} AND kind = 'deposit' AND balance_before > 0 AND assets > 0)
          SELECT is_creation, count(*) AS n,
                 percentile_cont(ARRAY[0.25, 0.5, 0.75, 0.9]) WITHIN GROUP (ORDER BY LEAST(ratio, 1)) AS q,
                 avg((ratio >= 0.9)::int) AS all_in, avg((ratio < 0.05)::int) AS tiny
            FROM d GROUP BY is_creation`,
    transform(rows) {
      const data = {}
      let sample = 0
      for (const r of rows) {
        sample += Number(r.n)
        const q = quantiles(r.q, ['p25', 'median', 'p75', 'p90'])
        data[r.is_creation ? 'creating' : 'trading'] = {
          buys_measured: Number(r.n),
          balance_used_pct: q && Object.fromEntries(Object.entries(q).map(([k, v]) => [k, num(v * 100, 1)])),
          all_in_pct: num(r.all_in * 100, 1), // used ≥90% of balance
          under_5pct_of_balance_pct: num(r.tiny * 100, 1),
        }
      }
      return { sample, data }
    },
  },
  {
    name: 'new_term_discovery',
    describe: 'How quickly someone other than the creator first buys into a new atom or claim — split into instant (<1 min, usually automated) and organic discovery',
    sql: `WITH created AS (
            SELECT term_id, occurred_at, sender AS creator, kind FROM intuition_events
             WHERE ${WINDOW} AND kind IN ('atom_created', 'triple_created')),
          first_buy AS (
            SELECT c.term_id, c.kind, c.occurred_at, fb.occurred_at AS first_outside, fb.sender AS first_buyer
              FROM created c
              LEFT JOIN LATERAL (
                SELECT d.occurred_at, d.sender FROM intuition_events d
                 WHERE d.term_id = c.term_id AND d.kind = 'deposit' AND d.sender <> c.creator
                   AND d.occurred_at >= c.occurred_at
                 ORDER BY d.occurred_at LIMIT 1) fb ON TRUE),
          timed AS (SELECT *, extract(epoch FROM first_outside - occurred_at) AS secs FROM first_buy)
          SELECT kind, count(*) AS created, count(first_outside) AS bought,
                 count(*) FILTER (WHERE secs < 60) AS instant,
                 count(DISTINCT first_buyer) FILTER (WHERE secs < 60) AS instant_buyers,
                 count(*) FILTER (WHERE secs <= 86400) AS within_24h,
                 percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY secs / 60)
                   FILTER (WHERE secs >= 60) AS organic_minutes_q,
                 count(*) FILTER (WHERE secs >= 60) AS organic
            FROM timed GROUP BY kind`,
    transform(rows) {
      const data = {}
      let sample = 0
      for (const r of rows) {
        sample += Number(r.created)
        data[r.kind === 'atom_created' ? 'atoms' : 'claims'] = {
          created: Number(r.created),
          ever_bought_by_others_pct: pct(r.bought, r.created),
          bought_by_others_within_24h_pct: pct(r.within_24h, r.created),
          instant_first_buy_under_1min_pct: pct(r.instant, r.created),
          wallets_making_instant_first_buys: Number(r.instant_buyers),
          organic_first_buys: Number(r.organic),
          organic_minutes_to_first_buy: quantiles(r.organic_minutes_q, ['p25', 'median', 'p75']),
        }
      }
      return { sample, data }
    },
  },
  {
    name: 'creator_self_support',
    describe: 'How often creators keep buying into what they created (beyond the creation deposit)',
    sql: `WITH created AS (
            SELECT term_id, occurred_at, sender AS creator, tx_hash FROM intuition_events
             WHERE ${WINDOW} AND kind IN ('atom_created', 'triple_created'))
          SELECT count(*) AS created,
                 count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM intuition_events d
                    WHERE d.term_id = c.term_id AND d.kind = 'deposit' AND d.sender = c.creator
                      AND d.tx_hash IS DISTINCT FROM c.tx_hash
                      AND d.occurred_at BETWEEN c.occurred_at AND c.occurred_at + interval '24 hours')) AS self_bought_24h
            FROM created c`,
    transform([r]) {
      return {
        sample: Number(r?.created || 0),
        data: { created: Number(r?.created || 0), creator_bought_again_within_24h_pct: pct(r?.self_bought_24h, r?.created) },
      }
    },
  },
  {
    name: 'holding_periods',
    describe: 'How long positions are held before the first sell, and how many are never sold',
    sql: `WITH buys AS (
            SELECT receiver, term_id, min(occurred_at) AS first_buy FROM intuition_events
             WHERE ${WINDOW} AND kind = 'deposit' GROUP BY 1, 2),
          sells AS (
            SELECT receiver, term_id, min(occurred_at) AS first_sell FROM intuition_events
             WHERE ${WINDOW} AND kind = 'redemption' GROUP BY 1, 2)
          SELECT count(*) AS positions,
                 count(*) FILTER (WHERE s.first_sell > b.first_buy) AS sold,
                 count(*) FILTER (WHERE s.first_sell > b.first_buy AND s.first_sell <= b.first_buy + interval '24 hours') AS sold_24h,
                 percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY extract(epoch FROM s.first_sell - b.first_buy) / 3600)
                   FILTER (WHERE s.first_sell > b.first_buy) AS hours_q
            FROM buys b LEFT JOIN sells s USING (receiver, term_id)`,
    transform([r]) {
      return {
        sample: Number(r?.positions || 0),
        data: {
          positions_opened: Number(r?.positions || 0),
          sold_within_window_pct: pct(r?.sold, r?.positions),
          sold_within_24h_pct: pct(r?.sold_24h, r?.positions),
          hours_held_before_first_sell: quantiles(r?.hours_q, ['p25', 'median', 'p75']),
        },
      }
    },
  },
  {
    name: 'curve_and_side',
    describe: 'Bonding-curve choice (linear vs exponential) and supporting vs opposing claims',
    sql: `SELECT kind, vault_type, curve_id, count(*) AS n, COALESCE(sum(assets), 0) AS volume
            FROM intuition_events WHERE ${WINDOW} AND kind IN ('deposit', 'redemption')
           GROUP BY 1, 2, 3`,
    transform(rows) {
      const dep = rows.filter((r) => r.kind === 'deposit')
      const total = dep.reduce((s, r) => s + Number(r.n), 0)
      const totalVol = dep.reduce((s, r) => s + Number(r.volume), 0)
      const sum = (pred, f) => dep.filter(pred).reduce((s, r) => s + Number(r[f]), 0)
      const curveName = (id) => (Number(id) === 1 ? 'linear' : Number(id) === 2 ? 'exponential' : `curve_${id}`)
      const curves = {}
      for (const r of dep) {
        const k = curveName(r.curve_id)
        curves[k] = (curves[k] || 0) + Number(r.n)
      }
      return {
        sample: total,
        data: {
          deposits_by_curve_pct: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, pct(v, total)])),
          deposits_by_vault_pct: {
            atoms: pct(sum((r) => r.vault_type === 'Atom', 'n'), total),
            claims_support: pct(sum((r) => r.vault_type === 'Triple', 'n'), total),
            claims_oppose: pct(sum((r) => r.vault_type === 'CounterTriple', 'n'), total),
          },
          volume_by_vault_pct: {
            atoms: pct(sum((r) => r.vault_type === 'Atom', 'volume'), totalVol),
            claims_support: pct(sum((r) => r.vault_type === 'Triple', 'volume'), totalVol),
            claims_oppose: pct(sum((r) => r.vault_type === 'CounterTriple', 'volume'), totalVol),
          },
        },
      }
    },
  },
  {
    name: 'wallet_segments',
    describe: 'Kinds of participants (bots, whales, flippers, creators, accumulators, casual) and how concentrated volume is',
    sql: `WITH ev AS (
            SELECT CASE WHEN kind = 'redemption' THEN receiver ELSE sender END AS wallet, kind, assets
              FROM intuition_events WHERE ${WINDOW}),
          top_amount AS (
            SELECT wallet, max(n) AS top_n FROM (
              SELECT wallet, assets, count(*) AS n FROM ev WHERE kind = 'deposit' GROUP BY 1, 2) x GROUP BY 1),
          w AS (
            SELECT ev.wallet,
                   count(*) FILTER (WHERE kind = 'deposit') AS deposits,
                   count(*) FILTER (WHERE kind = 'redemption') AS redemptions,
                   count(*) FILTER (WHERE kind IN ('atom_created', 'triple_created')) AS creations,
                   COALESCE(sum(assets) FILTER (WHERE kind = 'deposit'), 0) AS volume,
                   COALESCE(max(t.top_n), 0) AS top_n
              FROM ev LEFT JOIN top_amount t USING (wallet) GROUP BY ev.wallet),
          cut AS (SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY volume) AS whale FROM w WHERE volume > 0),
          seg AS (
            SELECT w.*, CASE
                     WHEN deposits >= 10 AND top_n >= 0.8 * deposits THEN 'bot_like'
                     WHEN volume >= (SELECT whale FROM cut) AND volume > 0 THEN 'whale'
                     WHEN redemptions >= 2 AND redemptions >= 0.3 * deposits THEN 'flipper'
                     WHEN creations >= 3 THEN 'creator'
                     WHEN deposits >= 5 AND redemptions = 0 THEN 'accumulator'
                     ELSE 'casual' END AS segment,
                   row_number() OVER (ORDER BY volume DESC) AS rnk
              FROM w)
          SELECT segment, count(*) AS wallets, sum(volume) AS volume, avg(deposits + redemptions) AS avg_trades,
                 (SELECT count(*) FROM seg) AS all_wallets, (SELECT sum(volume) FROM seg) AS all_volume,
                 (SELECT sum(volume) FROM seg WHERE rnk <= GREATEST(1, ceil(0.01 * (SELECT count(*) FROM seg)))) AS top1_volume,
                 (SELECT sum(volume) FROM seg WHERE rnk <= GREATEST(1, ceil(0.10 * (SELECT count(*) FROM seg)))) AS top10_volume
            FROM seg GROUP BY segment`,
    transform(rows) {
      const r0 = rows[0]
      return {
        sample: Number(r0?.all_wallets || 0),
        data: {
          active_wallets: Number(r0?.all_wallets || 0),
          volume_share_top_1pct_wallets: pct(r0?.top1_volume, r0?.all_volume),
          volume_share_top_10pct_wallets: pct(r0?.top10_volume, r0?.all_volume),
          segments: Object.fromEntries(
            rows
              .sort((a, b) => Number(b.volume) - Number(a.volume))
              .map((r) => [r.segment, {
                wallets: Number(r.wallets),
                wallets_pct: pct(r.wallets, r.all_wallets),
                volume_pct: pct(r.volume, r.all_volume),
                avg_trades: num(r.avg_trades, 1),
              }])
          ),
          definitions: {
            bot_like: '≥10 buys and ≥80% of them the exact same amount',
            whale: 'top 1% of wallets by TRUST deposited',
            flipper: '≥2 sells and sells ≥30% of buys',
            creator: '≥3 atoms/claims created',
            accumulator: '≥5 buys, no sells',
          },
        },
      }
    },
  },
  {
    name: 'whale_followthrough',
    describe: 'Whether a large buy attracts other buyers into the same atom/claim in the next 6 hours',
    sql: `WITH trades AS (${TRADES}),
          cut AS (SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY assets) AS big FROM trades),
          big AS (SELECT * FROM trades WHERE assets >= (SELECT big FROM cut)),
          cmp AS (
            SELECT b.id,
                   (SELECT count(DISTINCT t.sender) FROM intuition_events t
                     WHERE t.kind = 'deposit' AND t.term_id = b.term_id AND t.sender <> b.sender
                       AND t.occurred_at > b.occurred_at AND t.occurred_at <= b.occurred_at + interval '6 hours') AS after_6h,
                   (SELECT count(DISTINCT t.sender) FROM intuition_events t
                     WHERE t.kind = 'deposit' AND t.term_id = b.term_id AND t.sender <> b.sender
                       AND t.occurred_at >= b.occurred_at - interval '6 hours' AND t.occurred_at < b.occurred_at) AS before_6h
              FROM big b)
          SELECT (SELECT big FROM cut) AS threshold, count(*) AS n,
                 avg(after_6h) AS avg_after, avg(before_6h) AS avg_before,
                 avg((after_6h > before_6h)::int) AS more_after
            FROM cmp`,
    transform([r]) {
      return {
        sample: Number(r?.n || 0),
        data: {
          large_buy_threshold_trust: num(r?.threshold, 2),
          large_buys: Number(r?.n || 0),
          avg_other_buyers_6h_before: num(r?.avg_before, 2),
          avg_other_buyers_6h_after: num(r?.avg_after, 2),
          more_buyers_after_than_before_pct: num(Number(r?.more_after || 0) * 100, 1),
        },
      }
    },
  },
  {
    name: 'coordinated_wallets',
    describe: 'Groups of wallets that repeatedly buy the same atom/claim within 2 minutes of each other',
    sql: `WITH trades AS (${TRADES})
          SELECT a.sender AS w1, b.sender AS w2, count(DISTINCT a.term_id) AS shared_terms
            FROM trades a JOIN trades b
              ON a.term_id = b.term_id AND a.sender < b.sender
             AND b.occurred_at BETWEEN a.occurred_at - interval '2 minutes' AND a.occurred_at + interval '2 minutes'
           GROUP BY 1, 2 HAVING count(DISTINCT a.term_id) >= 3`,
    transform(rows) {
      // Connected components over the pair graph → clusters. Addresses never leave this function.
      const parent = new Map()
      const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
      for (const { w1, w2 } of rows) {
        if (!parent.has(w1)) parent.set(w1, w1)
        if (!parent.has(w2)) parent.set(w2, w2)
        parent.set(find(w1), find(w2))
      }
      const sizes = new Map()
      for (const w of parent.keys()) sizes.set(find(w), (sizes.get(find(w)) || 0) + 1)
      const s = [...sizes.values()].sort((a, b) => b - a)
      return {
        sample: rows.length,
        data: {
          linked_pairs: rows.length,
          clusters: s.length,
          wallets_in_clusters: s.reduce((a, b) => a + b, 0),
          largest_cluster_sizes: s.slice(0, 5),
          rule: 'two wallets are linked if they bought ≥3 of the same atoms/claims within 2 minutes of each other',
        },
      }
    },
  },
  {
    name: 'trading_rhythm',
    describe: 'Wallets that trade on a clock-like schedule (very regular gaps between buys)',
    sql: `WITH t AS (
            SELECT sender, assets, extract(epoch FROM occurred_at - lag(occurred_at) OVER (PARTITION BY sender ORDER BY occurred_at)) AS gap
              FROM intuition_events WHERE ${WINDOW} AND kind = 'deposit'),
          w AS (
            SELECT sender, count(*) AS n, avg(gap) AS mean_gap, stddev_samp(gap) AS sd_gap, sum(assets) AS volume
              FROM t WHERE gap IS NOT NULL GROUP BY sender HAVING count(*) >= 20)
          SELECT count(*) AS frequent_wallets,
                 count(*) FILTER (WHERE sd_gap / NULLIF(mean_gap, 0) < 0.25) AS clockwork,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY mean_gap / 60) FILTER (WHERE sd_gap / NULLIF(mean_gap, 0) < 0.25) AS median_interval_min,
                 COALESCE(sum(volume) FILTER (WHERE sd_gap / NULLIF(mean_gap, 0) < 0.25), 0) AS clockwork_volume,
                 (SELECT COALESCE(sum(assets), 0) FROM intuition_events WHERE ${WINDOW} AND kind = 'deposit') AS all_volume
            FROM w`,
    transform([r]) {
      return {
        sample: Number(r?.frequent_wallets || 0),
        data: {
          wallets_with_20plus_buys: Number(r?.frequent_wallets || 0),
          clockwork_wallets: Number(r?.clockwork || 0),
          clockwork_median_interval_minutes: num(r?.median_interval_min, 1),
          clockwork_volume_pct: pct(r?.clockwork_volume, r?.all_volume),
          rule: 'gaps between buys vary by less than 25% (coefficient of variation < 0.25)',
        },
      }
    },
  },
  {
    name: 'daily_trend',
    describe: 'Day-by-day activity and how the last 7 days compare with the 7 before',
    sql: `SELECT day, kind, events, wallets, volume FROM intuition_daily_stats
           WHERE day >= (NOW() AT TIME ZONE 'UTC')::date - $1::int ORDER BY day`,
    transform(rows) {
      const days = {}
      for (const r of rows) {
        const d = (days[r.day.toISOString().slice(0, 10)] ||= {})
        d[r.kind] = { events: Number(r.events), wallets: Number(r.wallets), volume: num(r.volume, 2) }
      }
      const list = Object.entries(days).map(([day, v]) => ({ day, ...v }))
      const dep = (slice) => slice.reduce((s, d) => s + (d.deposit?.events || 0), 0)
      const vol = (slice) => slice.reduce((s, d) => s + (d.deposit?.volume || 0), 0)
      const last7 = list.slice(-7), prev7 = list.slice(-14, -7)
      const change = (a, b) => (b ? num(((a - b) / b) * 100, 1) : null)
      return {
        sample: list.length,
        data: {
          deposits_change_vs_previous_week_pct: prev7.length === 7 ? change(dep(last7), dep(prev7)) : null,
          volume_change_vs_previous_week_pct: prev7.length === 7 ? change(vol(last7), vol(prev7)) : null,
          days: list,
        },
      }
    },
  },
]

/** Computes every metric for every window. Failures are isolated per metric. */
async function computeMetrics(pool) {
  const results = []
  for (const window of WINDOWS) {
    for (const m of METRICS) {
      const started = Date.now()
      try {
        const { rows } = await pool.query(m.sql, [window])
        const { sample, data } = m.transform(rows)
        await pool.query(
          `INSERT INTO pattern_metrics (metric, window_days, computed_at, sample_size, data)
           VALUES ($1, $2, NOW(), $3, $4)
           ON CONFLICT (metric, window_days) DO UPDATE SET
             computed_at = NOW(), sample_size = EXCLUDED.sample_size, data = EXCLUDED.data`,
          [m.name, window, sample, JSON.stringify({ description: m.describe, ...data })]
        )
        results.push({ metric: m.name, window, ok: true, ms: Date.now() - started, sample })
      } catch (e) {
        console.error(`[Patterns] ${m.name} (${window}d) failed:`, e.message)
        results.push({ metric: m.name, window, ok: false, error: e.message })
      }
    }
  }
  return results
}

module.exports = { computeMetrics, METRICS, WINDOWS }
