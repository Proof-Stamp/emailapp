const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

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
}

function dbFrom(env) {
  return env?.METRICS_DB || null
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

  const proofstampsCreated = Number(row?.proofstamps_created || 0)
  const emailAppOpened = Number(row?.email_app_opened || 0)
  const totalFiles = Number(row?.total_files || 0)

  return Response.json({
    proofstampsCreated,
    emailAppOpened,
    emailOpenRatePct: proofstampsCreated ? Number(((emailAppOpened / proofstampsCreated) * 100).toFixed(1)) : 0,
    averageFilesPerProofstamp: proofstampsCreated ? Number((totalFiles / proofstampsCreated).toFixed(2)) : 0,
    updatedAt: row?.updated_at || null
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

  if (payload?.event === 'proof_created') {
    const fileCount = Number(payload.fileCount)
    if (!Number.isInteger(fileCount) || fileCount < 1 || fileCount > 5) {
      return Response.json({ error: 'fileCount must be an integer from 1 to 5.' }, { status: 400, headers: JSON_HEADERS })
    }

    await db.prepare(`
      UPDATE proofstamp_metrics
      SET proofstamps_created = proofstamps_created + 1,
          total_files = total_files + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).bind(fileCount).run()
    return new Response(null, { status: 204 })
  }

  if (payload?.event === 'email_opened') {
    await db.prepare(`
      UPDATE proofstamp_metrics
      SET email_app_opened = email_app_opened + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run()
    return new Response(null, { status: 204 })
  }

  return Response.json({ error: 'Unknown event.' }, { status: 400, headers: JSON_HEADERS })
}
