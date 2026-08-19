import assert from 'node:assert/strict'
import test from 'node:test'
import { onRequestGet, onRequestPost } from '../functions/api/metrics.js'

class FakeD1 {
  constructor() {
    this.metrics = {
      proofstamps_created: 1,
      email_app_opened: 1,
      total_files: 1,
      updated_at: '2026-08-19 19:33:11'
    }
    this.feedback = {
      yes_count: 0,
      no_count: 1,
      updated_at: '2026-08-19 20:02:00'
    }
    this.events = new Map()
  }

  prepare(sql) {
    const db = this
    let params = []
    const normalized = sql.replace(/\s+/g, ' ').trim()

    return {
      bind(...values) {
        params = values
        return this
      },
      async run() {
        if (normalized.includes('INSERT OR IGNORE INTO proofstamp_metric_events')) {
          const [eventId, eventType, fileCount] = params
          if (db.events.has(eventId)) return { meta: { changes: 0 } }
          db.events.set(eventId, {
            event_id: eventId,
            event_type: eventType,
            file_count: fileCount,
            created_at: '2026-08-19 20:15:00'
          })
          return { meta: { changes: 1 } }
        }
        return { meta: { changes: 0 } }
      },
      async first() {
        if (normalized.includes('FROM proofstamp_metrics')) return { ...db.metrics }
        if (normalized.includes('FROM proofstamp_feedback')) return { ...db.feedback }
        if (normalized.includes('FROM proofstamp_metric_events')) {
          const rows = [...db.events.values()]
          const count = (type) => rows.filter((row) => row.event_type === type).length
          const timestamps = (types) => rows
            .filter((row) => types.includes(row.event_type))
            .map((row) => row.created_at)
            .sort()
          return {
            proofstamps_created: count('proof_created'),
            email_app_opened: count('email_opened'),
            total_files: rows
              .filter((row) => row.event_type === 'proof_created')
              .reduce((sum, row) => sum + Number(row.file_count || 0), 0),
            feedback_yes: count('feedback_yes'),
            feedback_no: count('feedback_no'),
            metrics_updated_at: timestamps(['proof_created', 'email_opened']).at(-1) || null,
            feedback_updated_at: timestamps(['feedback_yes', 'feedback_no']).at(-1) || null
          }
        }
        return null
      }
    }
  }
}

function postContext(db, payload) {
  return {
    env: { METRICS_DB: db },
    request: new Request('https://email.proofstamp.org/api/metrics', {
      method: 'POST',
      headers: {
        origin: 'https://email.proofstamp.org',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }
}

test('retried event IDs increment aggregate metrics only once', async () => {
  const db = new FakeD1()
  const events = [
    { eventId: 'evt-proof-0001', event: 'proof_created', fileCount: 1 },
    { eventId: 'evt-open-00001', event: 'email_opened' },
    { eventId: 'evt-no-0000001', event: 'feedback_no' }
  ]

  for (const event of events) {
    assert.equal((await onRequestPost(postContext(db, event))).status, 204)
    assert.equal((await onRequestPost(postContext(db, event))).status, 204)
  }

  const response = await onRequestGet({
    env: { METRICS_DB: db },
    request: new Request('https://email.proofstamp.org/api/metrics')
  })
  const metrics = await response.json()

  assert.equal(metrics.proofstampsCreated, 2)
  assert.equal(metrics.emailAppOpened, 2)
  assert.equal(metrics.emailOpenRatePct, 100)
  assert.equal(metrics.averageFilesPerProofstamp, 1)
  assert.equal(metrics.feedbackYes, 0)
  assert.equal(metrics.feedbackNo, 2)
  assert.equal(metrics.feedbackTotal, 2)
  assert.equal(metrics.updatedAt, '2026-08-19 20:15:00')
  assert.equal(metrics.metricsUpdatedAt, '2026-08-19 20:15:00')
  assert.equal(metrics.feedbackUpdatedAt, '2026-08-19 20:15:00')
})
