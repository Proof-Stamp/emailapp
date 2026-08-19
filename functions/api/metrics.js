const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

const VALID_EVENTS = new Set(['proof_created', 'email_opened', 'feedback_yes', 'feedback_no'])
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/

async function ensureSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS proofstamp_metrics (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      proofstamps_created INTEGER NOT NULL DEFAULT 0,
      email_app_opened INTEGER NOT NULL DEFAULT 0,
      total_files INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await db.prepare(`
    INSERT OR IGNORE INTO proofstamp_metrics
      (id, proofstamps_created, email_app_opened, total_files)
    VALUES (1, 0, 0, 0)
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS proofstamp_feedback (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      yes_count INTEGER NOT NULL DEFAULT 0,
      no_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await db.prepare(`
    INSERT OR IGNORE INTO proofstamp_feedback (id, yes_count, no_count)
    VALUES (1, 0, 0)
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS proofstamp_metric_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      file_count INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

function dbFrom(env) {
  return env?.METRICS_DB || null
}

function latestTimestamp(...values) {
  const timestamps = values.filter(Boolean)
  return timestamps.length ? timestamps.sort().at(-1) : null
}

function validateEvent(payload) {
  const event = payload?.event
  if (!VALID_EVENTS.has(event)) return { error: 'Unknown event.' }

  let fileCount = null
  if (event === 'proof_created') {
    fileCount = Number(payload.fileCount)
    if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > 5) {
      return { error: 'fileCount must be an integer from 1 to 5.' }
    }
  }

  return { event, fileCount }
}

export async function onRequestGet(context) {
  const db = dbFrom(context.env)
  if (!db) {
    return Response.json({ error: 'Metrics database is not configured.' }, { status: 503, headers: JSON_HEADERS })
  }

  await ensureSchema(db)
  const row = await db.prepare(`
    SELECT proofstamps_created, email_app_opened, total_files, updated_at
    FROM proofstamp_metrics
    WHERE id = 1
  `).first()
  const feedback = await db.prepare(`
    SELECT yes_count, no_count, updated_at
    FROM proofstamp_feedback
    WHERE id = 1
  `).first()
  const queuedEvents = await db.prepare(`
    SELECT
      SUM(CASE WHEN event_type = 'proof_created' THEN 1 ELSE 0 END) AS proofstamps_created,
      SUM(CASE WHEN event_type = 'email_opened' THEN 1 ELSE 0 END) AS email_app_opened,
      SUM(CASE WHEN event_type = 'proof_created' THEN COALESCE(file_count, 0) ELSE 0 END) AS total_files,
      SUM(CASE WHEN event_type = 'feedback_yes' THEN 1 ELSE 0 END) AS feedback_yes,
      SUM(CASE WHEN event_type = 'feedback_no' THEN 1 ELSE 0 END) AS feedback_no,
      MAX(CASE WHEN event_type IN ('proof_created', 'email_opened') THEN created_at END) AS metrics_updated_at,
      MAX(CASE WHEN event_type IN ('feedback_yes', 'feedback_no') THEN created_at END) AS feedback_updated_at
    FROM proofstamp_metric_events
  `).first()

  const proofstampsCreated = Number(row?.proofstamps_created || 0) + Number(queuedEvents?.proofstamps_created || 0)
  const emailAppOpened = Number(row?.email_app_opened || 0) + Number(queuedEvents?.email_app_opened || 0)
  const totalFiles = Number(row?.total_files || 0) + Number(queuedEvents?.total_files || 0)
  const feedbackYes = Number(feedback?.yes_count || 0) + Number(queuedEvents?.feedback_yes || 0)
  const feedbackNo = Number(feedback?.no_count || 0) + Number(queuedEvents?.feedback_no || 0)
  const feedbackTotal = feedbackYes + feedbackNo
  const metricsUpdatedAt = latestTimestamp(row?.updated_at, queuedEvents?.metrics_updated_at)
  const feedbackUpdatedAt = latestTimestamp(feedback?.updated_at, queuedEvents?.feedback_updated_at)

  return Response.json({
    proofstampsCreated,
    emailAppOpened,
    emailOpenRatePct: proofstampsCreated ? Number(((emailAppOpened / proofstampsCreated) * 100).toFixed(1)) : 0,
    averageFilesPerProofstamp: proofstampsCreated ? Number((totalFiles / proofstampsCreated).toFixed(2)) : 0,
    feedbackYes,
    feedbackNo,
    feedbackTotal,
    feedbackPositivePct: feedbackTotal ? Number(((feedbackYes / feedbackTotal) * 100).toFixed(1)) : 0,
    updatedAt: latestTimestamp(metricsUpdatedAt, feedbackUpdatedAt),
    metricsUpdatedAt,
    feedbackUpdatedAt
  }, { headers: JSON_HEADERS })
}

export async function onRequestPost(context) {
  const db = dbFrom(context.env)
  if (!db) return new Response(null, { status: 204 })

  const origin = context.request.headers.get('origin')
  if (origin && origin !== new URL(context.request.url).origin) {
    return new Response(null, { status: 403 })
  }

  let payload
  try {
    payload = await context.request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers: JSON_HEADERS })
  }

  await ensureSchema(db)

  const validated = validateEvent(payload)
  if (validated.error) {
    return Response.json({ error: validated.error }, { status: 400, headers: JSON_HEADERS })
  }

  const { event, fileCount } = validated
  if (payload.eventId != null) {
    const eventId = String(payload.eventId)
    if (!EVENT_ID_PATTERN.test(eventId)) {
      return Response.json({ error: 'Invalid eventId.' }, { status: 400, headers: JSON_HEADERS })
    }

    await db.prepare(`
      INSERT OR IGNORE INTO proofstamp_metric_events (event_id, event_type, file_count)
      VALUES (?, ?, ?)
    `).bind(eventId, event, fileCount).run()
    return new Response(null, { status: 204 })
  }

  // Backward compatibility for clients loaded before reliable queued metrics shipped.
  if (event === 'proof_created') {
    await db.prepare(`
      UPDATE proofstamp_metrics
      SET proofstamps_created = proofstamps_created + 1,
          total_files = total_files + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).bind(fileCount).run()
    return new Response(null, { status: 204 })
  }

  if (event === 'email_opened') {
    await db.prepare(`
      UPDATE proofstamp_metrics
      SET email_app_opened = email_app_opened + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run()
    return new Response(null, { status: 204 })
  }

  const column = event === 'feedback_yes' ? 'yes_count' : 'no_count'
  await db.prepare(`
    UPDATE proofstamp_feedback
    SET ${column} = ${column} + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run()
  return new Response(null, { status: 204 })
}
