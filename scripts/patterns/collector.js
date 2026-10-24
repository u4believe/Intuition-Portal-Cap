'use strict'

/**
 * Collects Intuition activity into Postgres for pattern measurement:
 * deposits, redemptions, atom creations and claim (triple) creations.
 *
 * Incremental and idempotent: each source keeps a (created_at, id) cursor and
 * rows are inserted with ON CONFLICT DO NOTHING, so overlapping or repeated
 * runs never duplicate. The first run backfills PATTERN_RETENTION_DAYS.
 */

// Metrics look back at most 30 days and all-time history lives in the R2
// archive, so the database keeps only a little more than that window.
const RETENTION_DAYS = Number(process.env.PATTERN_RETENTION_DAYS) || 35
// The indexer caps each response (250 rows today) regardless of the limit asked
// for, so paging continues until an EMPTY page — never on a short one.
const PAGE_SIZE = 1000
const MAX_PAGES_PER_SOURCE = 60 // per run; a backfill catches up over several runs
const BALANCE_BATCH = 50
const BALANCE_PER_RUN = 400
const RPC_URL = process.env.INTUITION_RPC_URL || 'https://rpc.intuition.systems/http'

const SOURCES = {
  deposits: {
    idField: 'id',
    query: `query Deposits($at: timestamptz!, $id: String!, $limit: Int!) {
      rows: deposits(
        where: { _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, id: { _gt: $id } }] }
        order_by: [{ created_at: asc }, { id: asc }]
        limit: $limit
      ) { id created_at block_number transaction_hash sender_id receiver_id term_id vault_type curve_id assets_after_fees shares }
    }`,
    toRow: (r) => ({
      id: r.id, kind: 'deposit', at: r.created_at, block: r.block_number, tx: r.transaction_hash,
      sender: r.sender_id, receiver: r.receiver_id, term: r.term_id, vaultType: r.vault_type,
      curve: r.curve_id, assetsWei: r.assets_after_fees, sharesWei: r.shares,
    }),
  },
  redemptions: {
    idField: 'id',
    query: `query Redemptions($at: timestamptz!, $id: String!, $limit: Int!) {
      rows: redemptions(
        where: { _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, id: { _gt: $id } }] }
        order_by: [{ created_at: asc }, { id: asc }]
        limit: $limit
      ) { id created_at block_number transaction_hash sender_id receiver_id term_id vault_type curve_id assets shares }
    }`,
    toRow: (r) => ({
      id: r.id, kind: 'redemption', at: r.created_at, block: r.block_number, tx: r.transaction_hash,
      // The share owner is the receiver: MultiVault burns the receiver's shares and pays the receiver.
      sender: r.sender_id, receiver: r.receiver_id, term: r.term_id, vaultType: r.vault_type,
      curve: r.curve_id, assetsWei: r.assets, sharesWei: r.shares,
    }),
  },
  atoms: {
    idField: 'term_id',
    query: `query Atoms($at: timestamptz!, $id: String!, $limit: Int!) {
      rows: atoms(
        where: { _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, term_id: { _gt: $id } }] }
        order_by: [{ created_at: asc }, { term_id: asc }]
        limit: $limit
      ) { term_id created_at block_number transaction_hash creator_id }
    }`,
    toRow: (r) => ({
      id: `atom:${r.term_id}`, kind: 'atom_created', at: r.created_at, block: r.block_number, tx: r.transaction_hash,
      sender: r.creator_id, receiver: r.creator_id, term: r.term_id, vaultType: 'Atom',
      curve: null, assetsWei: null, sharesWei: null,
    }),
  },
  triples: {
    idField: 'term_id',
    query: `query Triples($at: timestamptz!, $id: String!, $limit: Int!) {
      rows: triples(
        where: { _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, term_id: { _gt: $id } }] }
        order_by: [{ created_at: asc }, { term_id: asc }]
        limit: $limit
      ) { term_id created_at block_number transaction_hash creator_id }
    }`,
    toRow: (r) => ({
      id: `triple:${r.term_id}`, kind: 'triple_created', at: r.created_at, block: r.block_number, tx: r.transaction_hash,
      sender: r.creator_id, receiver: r.creator_id, term: r.term_id, vaultType: 'Triple',
      curve: null, assetsWei: null, sharesWei: null,
    }),
  },
}

const lower = (v) => String(v || '').toLowerCase()

async function getCursor(pool, source) {
  const { rows } = await pool.query('SELECT last_at, last_id FROM intuition_ingest_cursors WHERE source = $1', [source])
  if (rows[0]) return { at: rows[0].last_at.toISOString(), id: rows[0].last_id }
  return { at: new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString(), id: '' }
}

async function saveCursor(pool, source, at, id) {
  await pool.query(
    `INSERT INTO intuition_ingest_cursors (source, last_at, last_id) VALUES ($1, $2, $3)
     ON CONFLICT (source) DO UPDATE SET last_at = EXCLUDED.last_at, last_id = EXCLUDED.last_id, updated_at = NOW()`,
    [source, at, id]
  )
}

/** One multi-row insert; wei strings are converted to TRUST in SQL to avoid float rounding. */
async function insertRows(pool, rows) {
  if (rows.length === 0) return 0
  const col = (f) => rows.map(f)
  const { rowCount } = await pool.query(
    `INSERT INTO intuition_events
       (id, kind, occurred_at, block_number, tx_hash, sender, receiver, term_id, vault_type, curve_id, assets, shares)
     SELECT id, kind, at, block, tx, sender, receiver, term, vtype, curve,
            assets_wei::numeric / 1e18, shares_wei::numeric / 1e18
       FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::bigint[], $5::text[], $6::text[], $7::text[],
                   $8::text[], $9::text[], $10::smallint[], $11::text[], $12::text[])
         AS t(id, kind, at, block, tx, sender, receiver, term, vtype, curve, assets_wei, shares_wei)
     ON CONFLICT (id) DO NOTHING`,
    [
      col((r) => r.id), col((r) => r.kind), col((r) => r.at), col((r) => r.block), col((r) => r.tx),
      col((r) => lower(r.sender)), col((r) => lower(r.receiver)), col((r) => r.term), col((r) => r.vaultType),
      col((r) => (r.curve == null ? null : Number(r.curve))), col((r) => r.assetsWei), col((r) => r.sharesWei),
    ]
  )
  return rowCount ?? 0
}

/** Pulls new rows for one source. Returns { inserted, caughtUp, earliest }. */
/** Retries transient indexer failures (timeouts are common during a backfill). */
async function withRetry(fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= attempts) throw e
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
    }
  }
}

async function syncSource(pool, queryGraphQL, name) {
  const source = SOURCES[name]
  let cursor = await getCursor(pool, name)
  let inserted = 0
  let earliest = null
  for (let page = 0; page < MAX_PAGES_PER_SOURCE; page++) {
    const data = await withRetry(async () => {
      const d = await queryGraphQL(source.query, { at: cursor.at, id: cursor.id, limit: PAGE_SIZE })
      // An overloaded indexer can answer with no data instead of an error; never read that as "caught up".
      if (!d || !Array.isArray(d.rows)) throw new Error(`indexer returned no data for ${name}`)
      return d
    })
    const raw = data.rows
    if (raw.length === 0) return { inserted, caughtUp: true, earliest }
    const rows = raw.map(source.toRow)
    inserted += await insertRows(pool, rows)
    earliest ??= rows[0].at
    const last = raw[raw.length - 1]
    cursor = { at: last.created_at, id: last[source.idField] }
    await saveCursor(pool, name, cursor.at, cursor.id)
  }
  return { inserted, caughtUp: false, earliest }
}

/**
 * Fills deposits' balance_before: the sender's TRUST balance at the block
 * before the trade (Intuition's RPC serves historical state). Newest first.
 * A lookup that fails is marked -1 so it isn't retried forever.
 */
async function enrichBalances(pool) {
  const { rows } = await pool.query(
    `SELECT id, sender, block_number FROM intuition_events
      WHERE kind = 'deposit' AND balance_before IS NULL
      ORDER BY occurred_at DESC LIMIT $1`,
    [BALANCE_PER_RUN]
  )
  let filled = 0
  for (let i = 0; i < rows.length; i += BALANCE_BATCH) {
    const batch = rows.slice(i, i + BALANCE_BATCH)
    const body = batch.map((r, j) => ({
      jsonrpc: '2.0',
      id: j,
      method: 'eth_getBalance',
      params: [r.sender, '0x' + Math.max(Number(r.block_number) - 1, 0).toString(16)],
    }))
    let results = []
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      })
      results = await res.json()
      if (!Array.isArray(results)) results = []
    } catch (e) {
      console.warn('[Patterns] Balance lookup failed:', e.message)
      return filled // try again next run
    }
    const byId = new Map(results.map((r) => [r.id, r]))
    const ids = [], weis = []
    batch.forEach((r, j) => {
      const res = byId.get(j)
      ids.push(r.id)
      weis.push(res?.result ? BigInt(res.result).toString() : '-1000000000000000000') // -1 TRUST = unavailable
    })
    await pool.query(
      `UPDATE intuition_events e SET balance_before = t.wei::numeric / 1e18
         FROM unnest($1::text[], $2::text[]) AS t(id, wei) WHERE e.id = t.id`,
      [ids, weis]
    )
    filled += ids.length
  }
  return filled
}

/** Recomputes the permanent daily summary for every day on or after `since`. */
async function rollupDaily(pool, since) {
  await pool.query(
    `INSERT INTO intuition_daily_stats (day, kind, events, wallets, terms, volume)
     SELECT (occurred_at AT TIME ZONE 'UTC')::date, kind, count(*),
            count(DISTINCT CASE WHEN kind = 'redemption' THEN receiver ELSE sender END),
            count(DISTINCT term_id), COALESCE(sum(assets), 0)
       FROM intuition_events
      WHERE occurred_at >= date_trunc('day', $1::timestamptz)
      GROUP BY 1, 2
     ON CONFLICT (day, kind) DO UPDATE SET
       events = EXCLUDED.events, wallets = EXCLUDED.wallets, terms = EXCLUDED.terms, volume = EXCLUDED.volume`,
    [since]
  )
}

async function pruneOld(pool) {
  const { rowCount } = await pool.query(
    'DELETE FROM intuition_events WHERE occurred_at < NOW() - make_interval(days => $1)',
    [RETENTION_DAYS]
  )
  return rowCount ?? 0
}

/** One collection pass over every source. */
async function collectOnce(pool, queryGraphQL) {
  const summary = { inserted: 0, caughtUp: true, balances: 0, pruned: 0 }
  let earliest = null
  for (const name of Object.keys(SOURCES)) {
    const r = await syncSource(pool, queryGraphQL, name)
    summary.inserted += r.inserted
    summary.caughtUp &&= r.caughtUp
    if (r.earliest && (!earliest || r.earliest < earliest)) earliest = r.earliest
  }
  // Re-summarise from the earliest day that received rows (always at least yesterday).
  const yesterday = new Date(Date.now() - 86400_000).toISOString()
  await rollupDaily(pool, earliest && earliest < yesterday ? earliest : yesterday)
  summary.balances = await enrichBalances(pool)
  summary.pruned = await pruneOld(pool)
  return summary
}

module.exports = { collectOnce, enrichBalances, RETENTION_DAYS }
