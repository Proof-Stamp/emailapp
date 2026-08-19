const created = document.querySelector('#stat-created')
const openRate = document.querySelector('#stat-open-rate')
const averageFiles = document.querySelector('#stat-average-files')
const feedbackYes = document.querySelector('#feedback-yes')
const feedbackNo = document.querySelector('#feedback-no')
const status = document.querySelector('#stats-status')
const updated = document.querySelector('#stats-updated')

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0)
}

function formatDecimal(value) {
  const number = Number(value) || 0
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

async function loadStats() {
  try {
    const response = await fetch('/api/metrics', { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Metrics unavailable (${response.status})`)

    const metrics = await response.json()
    created.textContent = formatNumber(metrics.proofstampsCreated)
    openRate.textContent = `${formatDecimal(metrics.emailOpenRatePct)}%`
    averageFiles.textContent = formatDecimal(metrics.averageFilesPerProofstamp)
    feedbackYes.textContent = formatNumber(metrics.feedbackYes)
    feedbackNo.textContent = formatNumber(metrics.feedbackNo)
    status.textContent = 'Live aggregate usage since tracking started.'

    if (metrics.updatedAt) {
      const date = new Date(metrics.updatedAt)
      if (!Number.isNaN(date.getTime())) {
        updated.textContent = `Last updated ${date.toLocaleString()}`
        updated.hidden = false
      }
    }
  } catch {
    created.textContent = '—'
    openRate.textContent = '—'
    averageFiles.textContent = '—'
    feedbackYes.textContent = '—'
    feedbackNo.textContent = '—'
    status.textContent = 'Usage metrics are not configured for this deployment yet.'
    updated.hidden = true
  }
}

loadStats()
