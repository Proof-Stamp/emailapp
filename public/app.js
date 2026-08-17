import { MAX_FILE_SIZE_BYTES, extractSha256, isSha256, sha256File } from './hash.js'

const $ = (selector) => document.querySelector(selector)
const els = {
  createTab: $('#create-tab'), verifyTab: $('#verify-tab'), createPanel: $('#create-panel'), verifyPanel: $('#verify-panel'),
  createAlert: $('#create-alert'), fileInput: $('#file-input'), dropZone: $('#drop-zone'), selectedFile: $('#selected-file'),
  selectedFileName: $('#selected-file-name'), selectedFileMeta: $('#selected-file-meta'), removeFile: $('#remove-file'), hashFile: $('#hash-file'),
  fileStage: $('#file-stage'), detailsStage: $('#details-stage'), receiptStage: $('#receipt-stage'), startOver: $('#start-over'),
  hashValue: $('#hash-value'), copyHash: $('#copy-hash'), receiptForm: $('#receipt-form'), description: $('#description'),
  descriptionCount: $('#description-count'), primaryEmail: $('#primary-email'), secondEmail: $('#second-email'),
  includeFilename: $('#include-filename'), receiptSummary: $('#receipt-summary'), providerCount: $('#receipt-provider-count'),
  openEmail: $('#open-email'), copyReceipt: $('#copy-receipt'), downloadReceipt: $('#download-receipt'), createAnother: $('#create-another'),
  verifyAlert: $('#verify-alert'), receiptFile: $('#receipt-file'), expectedHash: $('#expected-hash'), verifyFile: $('#verify-file'),
  verifyButton: $('#verify-button'), verifyResult: $('#verify-result'), verifyResultIcon: $('#verify-result-icon'),
  verifyResultTitle: $('#verify-result-title'), verifyResultCopy: $('#verify-result-copy'), actualHash: $('#actual-hash')
}

let selectedFile = null
let currentHash = ''
let currentReceipt = null

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

function showAlert(element, message) {
  element.textContent = message
  element.hidden = !message
}

function setStep(active) {
  document.querySelectorAll('.step').forEach((step, index) => {
    step.classList.toggle('active', index + 1 === active)
    step.classList.toggle('complete', index + 1 < active)
  })
}

function switchTab(mode) {
  const create = mode === 'create'
  els.createTab.classList.toggle('active', create)
  els.verifyTab.classList.toggle('active', !create)
  els.createTab.setAttribute('aria-selected', String(create))
  els.verifyTab.setAttribute('aria-selected', String(!create))
  els.createPanel.hidden = !create
  els.verifyPanel.hidden = create
  history.replaceState(null, '', create ? '/' : '/verify')
}

function acceptFile(file) {
  showAlert(els.createAlert, '')
  if (!file) return
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showAlert(els.createAlert, 'Please choose a file smaller than 50 MB.')
    return
  }
  selectedFile = file
  currentHash = ''
  els.selectedFileName.textContent = file.name
  els.selectedFileMeta.textContent = `${formatBytes(file.size)}${file.type ? ` · ${file.type}` : ''}`
  els.selectedFile.hidden = false
  els.hashFile.hidden = false
}

function resetCreate() {
  selectedFile = null
  currentHash = ''
  currentReceipt = null
  els.fileInput.value = ''
  els.selectedFile.hidden = true
  els.hashFile.hidden = true
  els.fileStage.hidden = false
  els.detailsStage.hidden = true
  els.receiptStage.hidden = true
  els.receiptForm.reset()
  els.includeFilename.checked = true
  els.descriptionCount.textContent = '0 / 500'
  showAlert(els.createAlert, '')
  setStep(1)
}

async function calculateHash() {
  if (!selectedFile) return
  els.hashFile.disabled = true
  els.hashFile.textContent = 'Calculating fingerprint…'
  try {
    currentHash = await sha256File(selectedFile)
    els.hashValue.textContent = currentHash
    els.fileStage.hidden = true
    els.detailsStage.hidden = false
    setStep(2)
    els.description.focus()
  } catch {
    showAlert(els.createAlert, 'This browser could not read the file. Please try again.')
  } finally {
    els.hashFile.disabled = false
    els.hashFile.textContent = 'Calculate SHA-256'
  }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function createReceipt() {
  const description = els.description.value.trim()
  const primaryEmail = els.primaryEmail.value.trim()
  const secondEmail = els.secondEmail.value.trim()
  if (!description) return showAlert(els.createAlert, 'Add a description for this file.')
  if (!validEmail(primaryEmail)) return showAlert(els.createAlert, 'Enter a valid email address.')
  if (secondEmail && !validEmail(secondEmail)) return showAlert(els.createAlert, 'Enter a valid second email address or leave it blank.')
  if (!currentHash || !selectedFile) return showAlert(els.createAlert, 'Select and fingerprint a file first.')

  currentReceipt = {
    schema: 'org.proofstamp.email-receipt',
    version: '1.0',
    hash_algorithm: 'SHA-256',
    hash: currentHash,
    description,
    file_name: els.includeFilename.checked ? selectedFile.name : null,
    file_size_bytes: selectedFile.size,
    media_type: selectedFile.type || 'application/octet-stream',
    created_at_device: new Date().toISOString(),
    verification_url: 'https://email.proofstamp.org/verify',
    app_version: '0.1.0'
  }
  currentReceipt._delivery = { primaryEmail, secondEmail }
  renderReceipt()
  showAlert(els.createAlert, '')
  els.detailsStage.hidden = true
  els.receiptStage.hidden = false
  setStep(3)
}

function publicReceipt() {
  const { _delivery, ...receipt } = currentReceipt
  return receipt
}

function receiptText() {
  const receipt = publicReceipt()
  const lines = [
    'PROOFSTAMP EMAIL RECEIPT', '',
    `Description: ${receipt.description}`,
    ...(receipt.file_name ? [`Filename: ${receipt.file_name}`] : []),
    `File size: ${formatBytes(receipt.file_size_bytes)} (${receipt.file_size_bytes} bytes)`,
    `Media type: ${receipt.media_type}`,
    `SHA-256: ${receipt.hash}`,
    `Created on this device: ${receipt.created_at_device}`, '',
    `Verify later: ${receipt.verification_url}`, '',
    'Keep the original file. A matching SHA-256 later shows that its bytes are unchanged.', '',
    'LIMITATION',
    'This receipt does not prove when or where the file was created, who created it, whether it was changed before this receipt, or whether its contents are true. The email received time is a practical record, not an independent public timestamp.'
  ]
  return lines.join('\n')
}

function renderReceipt() {
  const receipt = publicReceipt()
  const rows = [
    ['Description', receipt.description],
    ...(receipt.file_name ? [['Filename', receipt.file_name]] : []),
    ['Size', formatBytes(receipt.file_size_bytes)],
    ['SHA-256', receipt.hash],
    ['Device time', new Date(receipt.created_at_device).toLocaleString()]
  ]
  els.receiptSummary.replaceChildren(...rows.flatMap(([key, value]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = key
    dd.textContent = value
    return [dt, dd]
  }))
  els.providerCount.textContent = currentReceipt._delivery.secondEmail ? '2 inboxes' : '1 inbox'
}

function openEmail() {
  const { primaryEmail, secondEmail } = currentReceipt._delivery
  const subject = `ProofStamp receipt: ${currentReceipt.description.slice(0, 80)}`
  const params = new URLSearchParams({ subject, body: receiptText() })
  if (secondEmail) params.set('cc', secondEmail)
  window.location.href = `mailto:${encodeURIComponent(primaryEmail)}?${params.toString()}`
}

async function copyText(text, button, label) {
  try {
    await navigator.clipboard.writeText(text)
    const previous = button.textContent
    button.textContent = label
    setTimeout(() => { button.textContent = previous }, 1500)
  } catch {
    showAlert(els.createAlert, 'Copying was blocked. Select the text and copy it manually.')
  }
}

function downloadReceipt() {
  const blob = new Blob([JSON.stringify(publicReceipt(), null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `proofstamp-${currentHash.slice(0, 12)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function loadReceiptFile(file) {
  showAlert(els.verifyAlert, '')
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    if (!isSha256(String(parsed.hash || ''))) throw new Error('invalid')
    els.expectedHash.value = parsed.hash.toLowerCase()
  } catch {
    showAlert(els.verifyAlert, 'That file is not a valid ProofStamp receipt JSON file.')
  }
}

async function verify() {
  showAlert(els.verifyAlert, '')
  els.verifyResult.hidden = true
  const expected = extractSha256(els.expectedHash.value)
  const file = els.verifyFile.files[0]
  if (!expected) return showAlert(els.verifyAlert, 'Paste a valid 64-character SHA-256 fingerprint or load a receipt.')
  if (!file) return showAlert(els.verifyAlert, 'Choose the file you want to verify.')
  if (file.size > MAX_FILE_SIZE_BYTES) return showAlert(els.verifyAlert, 'Please choose a file smaller than 50 MB.')
  els.verifyButton.disabled = true
  els.verifyButton.textContent = 'Checking file…'
  try {
    const actual = await sha256File(file)
    const match = actual === expected
    els.verifyResult.hidden = false
    els.verifyResult.className = `verify-result ${match ? 'match' : 'mismatch'}`
    els.verifyResultIcon.textContent = match ? '✓' : '×'
    els.verifyResultTitle.textContent = match ? 'Fingerprint matches' : 'Fingerprint does not match'
    els.verifyResultCopy.textContent = match
      ? 'This file has exactly the same bytes as the file used to create the receipt.'
      : 'This is a different file, or its bytes changed after the receipt was created.'
    els.actualHash.textContent = actual
  } catch {
    showAlert(els.verifyAlert, 'This browser could not read the file. Please try again.')
  } finally {
    els.verifyButton.disabled = false
    els.verifyButton.textContent = 'Verify file'
  }
}

els.createTab.addEventListener('click', () => switchTab('create'))
els.verifyTab.addEventListener('click', () => switchTab('verify'))
els.fileInput.addEventListener('change', () => acceptFile(els.fileInput.files[0]))
els.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); els.dropZone.classList.add('dragging') })
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragging'))
els.dropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  els.dropZone.classList.remove('dragging')
  acceptFile(event.dataTransfer.files[0])
})
els.removeFile.addEventListener('click', resetCreate)
els.hashFile.addEventListener('click', calculateHash)
els.startOver.addEventListener('click', resetCreate)
els.description.addEventListener('input', () => { els.descriptionCount.textContent = `${els.description.value.length} / 500` })
els.copyHash.addEventListener('click', () => copyText(currentHash, els.copyHash, 'Copied'))
els.receiptForm.addEventListener('submit', (event) => { event.preventDefault(); createReceipt() })
els.openEmail.addEventListener('click', openEmail)
els.copyReceipt.addEventListener('click', () => copyText(receiptText(), els.copyReceipt, 'Copied'))
els.downloadReceipt.addEventListener('click', downloadReceipt)
els.createAnother.addEventListener('click', resetCreate)
els.receiptFile.addEventListener('change', () => loadReceiptFile(els.receiptFile.files[0]))
els.verifyButton.addEventListener('click', verify)

if (location.pathname.startsWith('/verify') || location.hash === '#verify') switchTab('verify')

