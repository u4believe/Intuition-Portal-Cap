'use strict'

/**
 * All-time archive of Intuition activity in Cloudflare R2 (S3-compatible).
 *
 * Layout (all gzipped newline-delimited JSON, one object per line):
 *   events/date=YYYY-MM-DD.ndjson.gz     every deposit, redemption, atom and claim creation that day
 *   patterns/date=YYYY-MM-DD.ndjson.gz   every hourly pattern snapshot computed that day
 *   summaries/daily_stats.ndjson.gz      the permanent per-day summary (rewritten daily)
 *   manifest.json                        what is archived, with counts and the format version
 *
 * Event files are pulled straight from the indexer (not from Postgres), so the
 * archive reaches back to mainnet launch regardless of the 90-day database
 * window. A day is marked verified only when its row counts equal the
 * indexer's own aggregates for that day. Re-exporting a day overwrites the
 * same key, so every step is idempotent.
 */

const zlib = require('zlib')
// aws4fetch signs with the Web Crypto API, which Node only exposes as a global
// from v19/20. Railway's runtime is older, so provide it from node:crypto.
if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto
const { AwsClient } = require('aws4fetch')

const FORMAT_VERSION = 1
const ARCHIVE_START = process.env.ARCHIVE_START_DATE || '2025-11-01' // Intuition mainnet's first deposit
const PREFIX = process.env.ARCHIVE_PREFIX || ''
const SETTLE_MS = 2 * 60 * 60 * 1000 // export a day only 2h after it ends, so late indexing is included
const PAGE = 1000 // the indexer caps responses (250 today); paging continues until an empty page

const DAY_QUERIES = {
  deposit: `query($from: timestamptz!, $to: timestamptz!, $at: timestamptz!, $id: String!, $limit: Int!) {
    rows: deposits(
      where: { created_at: { _gte: $from, _lt: $to }, _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, id: { _gt: $id } }] }
      order_by: [{ created_at: asc }, { id: asc }] limit: $limit
    ) { id created_at block_number log_index transaction_hash sender_id receiver_id term_id vault_type curve_id assets_after_fees shares total_shares }
  }`,
  redemption: `query($from: timestamptz!, $to: timestamptz!, $at: timestamptz!, $id: String!, $limit: Int!) {
    rows: redemptions(
      where: { created_at: { _gte: $from, _lt: $to }, _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, id: { _gt: $id } }] }
      order_by: [{ created_at: asc }, { id: asc }] limit: $limit
    ) { id created_at block_number log_index transaction_hash sender_id receiver_id term_id vault_type curve_id assets fees shares total_shares }
  }`,
  atom_created: `query($from: timestamptz!, $to: timestamptz!, $at: timestamptz!, $id: String!, $limit: Int!) {
    rows: atoms(
      where: { created_at: { _gte: $from, _lt: $to }, _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, term_id: { _gt: $id } }] }
      order_by: [{ created_at: asc }, { term_id: asc }] limit: $limit
    ) { id: term_id created_at block_number transaction_hash creator_id type label }
  }`,
  triple_created: `query($from: timestamptz!, $to: timestamptz!, $at: timestamptz!, $id: String!, $limit: Int!) {
    rows: triples(
      where: { created_at: { _gte: $from, _lt: $to }, _or: [{ created_at: { _gt: $at } }, { created_at: { _eq: $at }, term_id: { _gt: $id } }] }
      order_by: [{ created_at: asc }, { term_id: asc }] limit: $limit
    ) { id: term_id created_at block_number transaction_hash creator_id subject_id predicate_id object_id counter_term_id }
  }`,
}

const DAY_COUNTS = `query($from: timestamptz!, $to: timestamptz!) {
  deposit: deposits_aggregate(where: { created_at: { _gte: $from, _lt: $to } }) { aggregate { count } }
  redemption: redemptions_aggregate(where: { created_at: { _gte: $from, _lt: $to } }) { aggregate { count } }
  atom_created: atoms_aggregate(where: { created_at: { _gte: $from, _lt: $to } }) { aggregate { count } }
  triple_created: triples_aggregate(where: { created_at: { _gte: $from, _lt: $to } }) { aggregate { count } }
}`

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null
  return {
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' }),
    base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/`,
  }
}

async function put(cfg, key, body, contentType) {
  const res = await cfg.client.fetch(cfg.base + PREFIX + key, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType },
  })
  if (!res.ok) throw new Error(`R2 PUT ${key} failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
}

const gzipLines = (rows) => zlib.gzipSync(rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''))
const dayBounds = (day) => {
  const from = new Date(`${day}T00:00:00Z`)
  return { from: from.toISOString(), to: new Date(from.getTime() + 86400_000).toISOString() }
}

/** Retries transient network/indexer failures: a backfill makes thousands of requests. */
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

/** Every event of one UTC day, straight from the indexer, in a stable order. */
async function fetchDay(queryGraphQL, day) {
  const { from, to } = dayBounds(day)
  const out = []
  const counts = {}
  for (const [kind, query] of Object.entries(DAY_QUERIES)) {
    let at = from, id = '', n = 0
    for (;;) {
      const data = await withRetry(() => queryGraphQL(query, { from, to, at, id, limit: PAGE }))
      const rows = data?.rows || []
      if (rows.length === 0) break
      for (const r of rows) out.push({ kind, ...r })
      n += rows.length
      at = rows[rows.length - 1].created_at
      id = rows[rows.length - 1].id
    }
    counts[kind] = n
  }
  return { rows: out, counts }
}

async function indexerCounts(queryGraphQL, day) {
  const { from, to } = dayBounds(day)
  const data = await withRetry(() => queryGraphQL(DAY_COUNTS, { from, to }))
  return Object.fromEntries(Object.keys(DAY_QUERIES).map((k) => [k, Number(data[k].aggregate.count)]))
}

async function archiveDay(pool, queryGraphQL, cfg, day) {
  const { rows, counts } = await fetchDay(queryGraphQL, day)
  const expected = await indexerCounts(queryGraphQL, day)
  const verified = Object.keys(expected).every((k) => expected[k] === counts[k])
  const body = gzipLines(rows)
  await withRetry(() => put(cfg, `events/date=${day}.ndjson.gz`, body, 'application/gzip'))
  await pool.query(
    `INSERT INTO archive_days (day, events, bytes, verified) VALUES ($1, $2, $3, $4)
     ON CONFLICT (day) DO UPDATE SET events = EXCLUDED.events, bytes = EXCLUDED.bytes,
       verified = EXCLUDED.verified, exported_at = NOW()`,
    [day, rows.length, body.length, verified]
  )
  if (!verified) console.warn(`[Archive] ${day}: counts differ from indexer`, { got: counts, expected })
  return { day, events: rows.length, bytes: body.length, verified }
}

/** Pattern snapshots computed on `day` (from the append-only history table). */
async function archivePatterns(pool, cfg, day) {
  const { from, to } = dayBounds(day)
  const { rows } = await pool.query(
    `SELECT metric, window_days, computed_at, sample_size, data FROM pattern_metrics_history
      WHERE computed_at >= $1 AND computed_at < $2 ORDER BY computed_at, metric, window_days`,
    [from, to]
  )
  if (rows.length) await put(cfg, `patterns/date=${day}.ndjson.gz`, gzipLines(rows), 'application/gzip')
  return rows.length
}

async function writeSummaryAndManifest(pool, cfg) {
  const stats = (await pool.query('SELECT * FROM intuition_daily_stats ORDER BY day, kind')).rows
  await put(cfg, 'summaries/daily_stats.ndjson.gz', gzipLines(stats), 'application/gzip')
  const days = (await pool.query('SELECT day, events, bytes, verified FROM archive_days ORDER BY day')).rows
  const manifest = {
    format_version: FORMAT_VERSION,
    generated_at: new Date().toISOString(),
    source: 'Intuition mainnet indexer (https://mainnet.intuition.sh/v1/graphql), chain 1155',
    layout: {
      events: 'events/date=YYYY-MM-DD.ndjson.gz — kinds: deposit, redemption, atom_created, triple_created; amounts in wei strings',
      patterns: 'patterns/date=YYYY-MM-DD.ndjson.gz — hourly pattern snapshots (aggregates only)',
      daily_stats: 'summaries/daily_stats.ndjson.gz',
    },
    first_day: days[0]?.day ?? null,
    last_day: days.at(-1)?.day ?? null,
    days_archived: days.length,
    days_unverified: days.filter((d) => !d.verified).map((d) => d.day),
    total_events: days.reduce((s, d) => s + d.events, 0),
    total_bytes: days.reduce((s, d) => s + d.bytes, 0),
  }
  await put(cfg, 'manifest.json', JSON.stringify(manifest, null, 2), 'application/json')
  return manifest
}

/**
 * One archive pass within a time budget: (1) re-check unverified days,
 * (2) backfill missing days oldest-first, (3) export pattern snapshots and
 * the manifest. Returns null when R2 isn't configured.
 */
async function archiveOnce(pool, queryGraphQL, { budgetMs = 3 * 60 * 1000 } = {}) {
  const cfg = config()
  if (!cfg) return null
  const deadline = Date.now() + budgetMs
  const lastComplete = new Date(Date.now() - SETTLE_MS - 86400_000).toISOString().slice(0, 10)

  // Days not yet archived, plus unverified ones (retried), oldest first.
  const { rows: todo } = await pool.query(
    `SELECT d::date::text AS day FROM generate_series($1::date, $2::date, interval '1 day') d
      WHERE NOT EXISTS (SELECT 1 FROM archive_days a WHERE a.day = d::date AND a.verified)
      ORDER BY d`,
    [ARCHIVE_START, lastComplete]
  )
  const done = []
  for (const { day } of todo) {
    if (Date.now() > deadline) break
    done.push(await archiveDay(pool, queryGraphQL, cfg, day))
  }

  // Pattern snapshots for days that just completed (cheap; rewrite the last 2).
  for (const offset of [1, 2]) {
    const day = new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10)
    await archivePatterns(pool, cfg, day)
  }
  const manifest = await writeSummaryAndManifest(pool, cfg)
  return { archived: done, remaining: Math.max(todo.length - done.length, 0), manifest }
}

module.exports = { archiveOnce, archiveDay, fetchDay, indexerCounts, config }
