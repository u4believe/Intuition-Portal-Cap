'use strict'

/**
 * All-time archive of Intuition activity in Cloudflare R2 (S3-compatible).
 *
 * Layout (all gzipped newline-delimited JSON, one object per line):
 *   events/date=YYYY-MM-DD/<kind>-NNNNN.ndjson.gz   that day's deposits / redemptions / creations, ≤25k per part
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

const FORMAT_VERSION = 2 // v2: each day split into parts per kind
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

const PART_SIZE = 25_000 // events per part file, so even the 2M-event launch day streams through in pieces
const KINDS = Object.keys(DAY_QUERIES)

/** The indexer sometimes answers an overloaded query with no data instead of an error: treat that as a failure (retried). */
function requireData(data, what) {
  if (!data || typeof data !== 'object') throw new Error(`indexer returned no data for ${what}`)
  return data
}

async function getJson(cfg, key) {
  const res = await cfg.client.fetch(cfg.base + PREFIX + key)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 GET ${key} failed: ${res.status}`)
  return res.json()
}

async function listKeys(cfg, prefix) {
  const keys = []
  let token = ''
  for (;;) {
    const url = `${cfg.base.replace(/\/$/, '')}?list-type=2&prefix=${encodeURIComponent(PREFIX + prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const xml = await (await cfg.client.fetch(url)).text()
    keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]))
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
    if (!next) return keys
    token = next[1]
  }
}

async function deleteKeys(cfg, keys) {
  for (const k of keys) await cfg.client.fetch(cfg.base + k, { method: 'DELETE' })
}

const progressKey = (day) => `progress/date=${day}.json`
const freshProgress = () => Object.fromEntries(KINDS.map((k) => [k, { at: null, id: '', parts: 0, events: 0, bytes: 0, done: false }]))

async function indexerCounts(queryGraphQL, day) {
  const { from, to } = dayBounds(day)
  const data = await withRetry(async () => requireData(await queryGraphQL(DAY_COUNTS, { from, to }), `counts ${day}`))
  return Object.fromEntries(KINDS.map((k) => [k, Number(data[k].aggregate.count)]))
}

/**
 * Archives one UTC day in parts (events/date=D/<kind>-NNNNN.ndjson.gz),
 * resuming from progress/date=D.json. Stops at `deadline` after flushing what
 * it has, so a huge day spreads across many runs. Returns { done, ... }.
 */
async function archiveDay(pool, queryGraphQL, cfg, day, deadline = Infinity) {
  const { from, to } = dayBounds(day)
  const progress = (await getJson(cfg, progressKey(day))) || freshProgress()

  for (const kind of KINDS) {
    const p = progress[kind]
    if (p.done) continue
    let buffer = []
    let at = p.at || from, id = p.id
    const flush = async () => {
      if (!buffer.length) return
      const body = gzipLines(buffer)
      const part = String(p.parts + 1).padStart(5, '0')
      await withRetry(() => put(cfg, `events/date=${day}/${kind}-${part}.ndjson.gz`, body, 'application/gzip'))
      p.parts += 1
      p.events += buffer.length
      p.bytes += body.length
      p.at = at
      p.id = id
      buffer = []
      await withRetry(() => put(cfg, progressKey(day), JSON.stringify(progress), 'application/json'))
    }
    for (;;) {
      const data = await withRetry(async () =>
        requireData(await queryGraphQL(DAY_QUERIES[kind], { from, to, at, id, limit: PAGE }), `${kind} ${day}`)
      )
      const rows = Array.isArray(data.rows) ? data.rows : null
      if (!rows) throw new Error(`indexer returned no rows array for ${kind} ${day}`)
      if (rows.length === 0) {
        await flush()
        p.done = true
        await withRetry(() => put(cfg, progressKey(day), JSON.stringify(progress), 'application/json'))
        break
      }
      for (const r of rows) buffer.push({ kind, ...r })
      at = rows[rows.length - 1].created_at
      id = rows[rows.length - 1].id
      if (buffer.length >= PART_SIZE) await flush()
      if (Date.now() > deadline) {
        await flush()
        return { day, done: false, events: KINDS.reduce((s, k) => s + progress[k].events, 0) }
      }
    }
  }

  // Every kind exhausted: verify against the indexer's own totals.
  const expected = await indexerCounts(queryGraphQL, day)
  const got = Object.fromEntries(KINDS.map((k) => [k, progress[k].events]))
  const verified = KINDS.every((k) => expected[k] === got[k])
  const events = KINDS.reduce((s, k) => s + progress[k].events, 0)
  const bytes = KINDS.reduce((s, k) => s + progress[k].bytes, 0)
  if (!verified) {
    // Start the day over next time: remove its parts and progress.
    console.warn(`[Archive] ${day}: counts differ from indexer — will redo`, { got, expected })
    await deleteKeys(cfg, await listKeys(cfg, `events/date=${day}/`))
    await deleteKeys(cfg, [PREFIX + progressKey(day)])
  }
  await pool.query(
    `INSERT INTO archive_days (day, events, bytes, verified) VALUES ($1, $2, $3, $4)
     ON CONFLICT (day) DO UPDATE SET events = EXCLUDED.events, bytes = EXCLUDED.bytes,
       verified = EXCLUDED.verified, exported_at = NOW()`,
    [day, events, bytes, verified]
  )
  return { day, done: true, events, bytes, verified }
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
      events: 'events/date=YYYY-MM-DD/<kind>-NNNNN.ndjson.gz — kinds: deposit, redemption, atom_created, triple_created; up to 25,000 events per part; amounts in wei strings',
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
  let inProgress = null
  for (const { day } of todo) {
    if (Date.now() > deadline) break
    const r = await archiveDay(pool, queryGraphQL, cfg, day, deadline)
    if (!r.done) { inProgress = r; break }
    done.push(r)
  }

  // Pattern snapshots for days that just completed (cheap; rewrite the last 2).
  for (const offset of [1, 2]) {
    const day = new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10)
    await archivePatterns(pool, cfg, day)
  }
  const manifest = await writeSummaryAndManifest(pool, cfg)
  return { archived: done, inProgress, remaining: Math.max(todo.length - done.length, 0), manifest }
}

module.exports = { archiveOnce, archiveDay, indexerCounts, listKeys, deleteKeys, config }
