import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_PROOFSTAMP,
  extractProofstampFileHashes,
  sha256File
} from './hash.js'
import { createMailtoUrl, createReceipt as buildReceipt, formatBytes, isValidEmail, receiptToText } from './receipt.js'
import { verifyFileLocally } from './local-verifier.js'

const $ = (selector) => document.querySelector(selector)
const els = {
  createTab: $('#create-tab'), verifyTab: $('#verify-tab'), createPanel: $('#create-panel'), verifyPanel: $('#verify-panel'),
  createAlert: $('#create-alert'), fileInput: $('#file-input'), dropZone: $('#drop-zone'), selectedFiles: $('#selected-files'),
  addMoreFiles: $('#add-more-files'), hashStatus: $('#hash-status'),
  fileStage: $('#file-stage'), detailsStage: $('#details-stage'), receiptStage: $('#receipt-stage'), startOver: $('#start-over'),
  receiptForm: $('#receipt-form'), description: $('#description'),
  descriptionCount: $('#description-count'), primaryEmail: $('#primary-email'), secondEmail: $('#second-email'), secondEmailField: $('#second-email-field'),
  addSecondEmail: $('#add-second-email'), removeSecondEmail: $('#remove-second-email'),
  includeFilename: $('#include-filename'), receiptSummary: $('#receipt-summary'), providerCount: $('#receipt-provider-count'),
  openEmail: $('#open-email'), copyReceipt: $('#copy-receipt'), downloadReceipt: $('#download-receipt'), createAnother: $('#create-another'),
  verifyAlert: $('#verify-alert'), expectedHash: $('#expected-hash'), verifyFile: $('#verify-file'), verifyDropZone: $('#verify-drop-zone'),
  verifySelectedFiles: $('#verify-selected-files'), addMoreVerifyFiles: $('#add-more-verify-files'), verifyButton: $('#verify-button'), verifyResult: $('#verify-result'),
  verifyResultIcon: $('#verify-result-icon'), verifyResultTitle: $('#verify-result-title'), verifyResultCopy: $('#verify-result-copy'),
  actualHash: $('#actual-hash')
}

let selectedFiles = []
let selectedVerifyFiles = []
let currentFileProofs = []
let currentReceipt = null
let hashFailures = new Set()
let hashGeneration = 0
const previewUrls = new Map()

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function moveTo(element, { focus = false, block = 'center' } = {}) {
  if (!element) return
  requestAnimationFrame(() => {
    if (focus) {
      const naturallyFocusable = element.matches('a, button, input, textarea, select, summary, [tabindex]')
      if (!naturallyFocusable) element.setAttribute('tabindex', '-1')
      element.focus({ preventScroll: true })
    }
    element.scrollIntoView({ behavior: focus || prefersReducedMotion() ? 'auto' : 'smooth', block })
  })
}

function showAlert(element, message, { move = false } = {}) {
  element.textContent = message
  element.hidden = !message
  if (message && move) moveTo(element, { block: 'center' })
}

function showToast(message) {
  document.querySelector('[data-proofstamp-toast]')?.remove()
  const toast = document.createElement('div')
  toast.dataset.proofstampToast = 'true'
  toast.setAttribute('role', 'alert')
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', bottom: '1rem', zIndex: '1000', maxWidth: 'calc(100% - 2rem)',
    padding: '.8rem 1rem', borderRadius: '.7rem', background: 'var(--navy)', color: 'white', fontWeight: '700',
    fontSize: '.85rem', boxShadow: '0 12px 32px rgba(7, 27, 44, .22)', transform: 'translateX(-50%)'
  })
  document.body.append(toast)
  setTimeout(() => toast.remove(), 4500)
}

function clearFieldError(field) {
  if (!field) return
  document.getElementById(`${field.id}-error`)?.remove()
  field.removeAttribute('aria-invalid')
  field.removeAttribute('aria-errormessage')
  field.style.borderColor = ''
}

function showFieldError(field, message) {
  clearFieldError(field)
  const error = document.createElement('small')
  error.id = `${field.id}-error`
  error.setAttribute('role', 'alert')
  error.textContent = message
  error.style.color = 'var(--danger)'
  error.style.fontWeight = '700'
  field.insertAdjacentElement('afterend', error)
  field.setAttribute('aria-invalid', 'true')
  field.setAttribute('aria-errormessage', error.id)
  field.style.borderColor = 'var(--danger)'
  moveTo(field, { focus: true, block: 'center' })
}

function clearCreateFieldErrors() {
  ;[els.description, els.primaryEmail, els.secondEmail].forEach(clearFieldError)
}

function setSecondEmailVisible(visible, { focus = false } = {}) {
  els.secondEmailField.hidden = !visible
  els.addSecondEmail.hidden = visible
  if (!visible) {
    clearFieldError(els.secondEmail)
    els.secondEmail.value = ''
  }
  if (visible && focus) moveTo(els.secondEmail, { focus: true, block: 'center' })
}

function focusPanel(mode) {
  const target = mode === 'create'
    ? els.createPanel.querySelector('#file-stage-title')
    : els.verifyPanel.querySelector('.verify-intro h2')
  moveTo(target, { focus: true, block: 'start' })
}

function switchTab(mode, { move = true } = {}) {
  const create = mode === 'create'
  els.createTab.classList.toggle('active', create)
  els.verifyTab.classList.toggle('active', !create)
  els.createTab.setAttribute('aria-selected', String(create))
  els.verifyTab.setAttribute('aria-selected', String(!create))
  els.createPanel.hidden = !create
  els.verifyPanel.hidden = create
  history.replaceState(null, '', create ? '/' : '/verify')
  if (move) focusPanel(mode)
}

function fileValidationMessage(files) {
  if (!files.length) return ''
  if (files.length > MAX_FILES_PER_PROOFSTAMP) return `Choose up to ${MAX_FILES_PER_PROOFSTAMP} files at a time.`
  const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE_BYTES)
  return tooLarge ? `${tooLarge.name} is larger than 50 MB.` : ''
}

function fileIdentity(file) {
  return `${file.name}\u0000${file.size}\u0000${file.type || ''}\u0000${file.lastModified || 0}`
}

function mergeFileSelection(current, fileList) {
  const incoming = Array.from(fileList || [])
  if (!incoming.length) return { files: current, added: 0, duplicates: 0, error: '' }

  const validationMessage = fileValidationMessage(incoming)
  if (validationMessage) return { files: current, added: 0, duplicates: 0, error: validationMessage }

  const seen = new Set(current.map(fileIdentity))
  const additions = []
  let duplicates = 0

  incoming.forEach((file) => {
    const key = fileIdentity(file)
    if (seen.has(key)) {
      duplicates += 1
      return
    }
    seen.add(key)
    additions.push(file)
  })

  const remaining = MAX_FILES_PER_PROOFSTAMP - current.length
  if (additions.length > remaining) {
    const error = remaining > 0
      ? `You can add ${remaining} more ${remaining === 1 ? 'file' : 'files'}.`
      : `You already have ${MAX_FILES_PER_PROOFSTAMP} files selected.`
    return { files: current, added: 0, duplicates, error }
  }

  return { files: [...current, ...additions], additions, added: additions.length, duplicates, error: '' }
}

function previousSelectionCopy(files) {
  if (!files.length) return ''
  return ` Your previous ${files.length} ${files.length === 1 ? 'file is' : 'files are'} still selected.`
}

function duplicateSelectionCopy(count) {
  if (!count) return ''
  return `${count === 1 ? 'That file is' : `${count} files are`} already selected.`
}

function previewUrl(file) {
  const key = fileIdentity(file)
  if (!previewUrls.has(key)) previewUrls.set(key, URL.createObjectURL(file))
  return previewUrls.get(key)
}

function revokePreview(file) {
  const key = fileIdentity(file)
  const url = previewUrls.get(key)
  if (!url) return
  URL.revokeObjectURL(url)
  previewUrls.delete(key)
}

function revokeAllPreviews() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url))
  previewUrls.clear()
}

function makeFileRow(file, index, onRemove, { failed = false, showPreview = false } = {}) {
  const row = document.createElement('div')
  row.className = `selected-file${showPreview ? ' preview-file' : ''}${failed ? ' file-failed' : ''}`

  const visual = document.createElement('div')
  visual.className = showPreview ? 'file-preview' : 'file-icon'
  visual.setAttribute('aria-hidden', 'true')

  if (showPreview && file.type?.startsWith('image/')) {
    const image = document.createElement('img')
    image.className = 'file-thumbnail'
    image.src = previewUrl(file)
    image.alt = ''
    visual.append(image)
  } else {
    visual.textContent = file.type?.startsWith('image/') ? 'IMG' : 'FILE'
  }

  const copy = document.createElement('div')
  copy.className = 'file-copy'
  const name = document.createElement('strong')
  name.textContent = file.name || 'Photo'
  const meta = document.createElement('span')
  meta.textContent = failed ? 'Could not read this file' : `${formatBytes(file.size)}${file.type ? ` · ${file.type}` : ''}`
  copy.append(name, meta)

  const remove = document.createElement('button')
  remove.className = 'icon-button'
  remove.type = 'button'
  remove.setAttribute('aria-label', `Remove ${file.name || 'file'}`)
  remove.textContent = '×'
  remove.addEventListener('click', () => onRemove(index))

  row.append(visual, copy, remove)
  return row
}

function renderCreateFiles() {
  els.selectedFiles.replaceChildren(...selectedFiles.map((file, index) => makeFileRow(
    file,
    index,
    removeCreateFile,
    { failed: hashFailures.has(fileIdentity(file)), showPreview: true }
  )))

  const hasFiles = selectedFiles.length > 0
  const canAdd = selectedFiles.length < MAX_FILES_PER_PROOFSTAMP
  els.selectedFiles.hidden = !hasFiles
  els.dropZone.hidden = hasFiles
  els.addMoreFiles.hidden = !hasFiles || !canAdd
}

function setHashStatus(message) {
  els.hashStatus.textContent = message
  els.hashStatus.hidden = !message
}

async function acceptFiles(fileList) {
  showAlert(els.createAlert, '')
  const result = mergeFileSelection(selectedFiles, fileList)
  els.fileInput.value = ''

  if (result.error) {
    showAlert(els.createAlert, `${result.error}${previousSelectionCopy(selectedFiles)}`, { move: true })
    return
  }

  if (result.added) {
    selectedFiles = result.files
    currentReceipt = null
  }

  renderCreateFiles()
  if (result.duplicates) showAlert(els.createAlert, duplicateSelectionCopy(result.duplicates))
  if (result.added) await calculateHashes({ focusDetails: true })
}

async function removeCreateFile(index) {
  const [removed] = selectedFiles.splice(index, 1)
  if (removed) {
    revokePreview(removed)
    const key = fileIdentity(removed)
    hashFailures.delete(key)
    currentFileProofs = currentFileProofs.filter(({ file }) => fileIdentity(file) !== key)
  }
  currentReceipt = null
  renderCreateFiles()

  if (!selectedFiles.length) {
    currentFileProofs = []
    hashFailures = new Set()
    els.detailsStage.hidden = true
    setHashStatus('')
    return
  }

  await calculateHashes({ focusDetails: false })
}

function resetCreate({ move = true } = {}) {
  hashGeneration += 1
  revokeAllPreviews()
  selectedFiles = []
  currentFileProofs = []
  currentReceipt = null
  hashFailures = new Set()
  els.fileInput.value = ''
  els.selectedFiles.replaceChildren()
  els.selectedFiles.hidden = true
  els.dropZone.hidden = false
  els.addMoreFiles.hidden = true
  els.fileStage.hidden = false
  els.detailsStage.hidden = true
  els.receiptStage.hidden = true
  els.receiptForm.reset()
  setSecondEmailVisible(false)
  els.includeFilename.checked = true
  els.descriptionCount.textContent = '0 / 500'
  setHashStatus('')
  clearCreateFieldErrors()
  showAlert(els.createAlert, '')
  if (move) moveTo($('#file-stage-title'), { focus: true, block: 'start' })
}

async function calculateHashes({ focusDetails = false } = {}) {
  if (!selectedFiles.length) return

  const generation = ++hashGeneration
  const snapshot = [...selectedFiles]
  const existing = new Map(currentFileProofs.map(({ file, hash }) => [fileIdentity(file), hash]))
  const proofs = []
  const failures = new Set()
  showAlert(els.createAlert, '')
  els.detailsStage.hidden = true

  for (let index = 0; index < snapshot.length; index += 1) {
    if (generation !== hashGeneration) return
    const file = snapshot[index]
    const key = fileIdentity(file)
    setHashStatus(snapshot.length === 1 ? 'Creating ProofStamp…' : `Creating ProofStamp… ${index + 1}/${snapshot.length}`)

    try {
      const hash = existing.get(key) || await sha256File(file)
      proofs.push({ file, hash })
    } catch {
      failures.add(key)
    }
  }

  if (generation !== hashGeneration) return
  currentFileProofs = proofs
  hashFailures = failures
  renderCreateFiles()

  if (failures.size) {
    const failedNames = snapshot.filter((file) => failures.has(fileIdentity(file))).map((file) => file.name || 'a file')
    setHashStatus(`${proofs.length} of ${snapshot.length} files ready`)
    showAlert(els.createAlert, `Couldn’t read ${failedNames.join(', ')}. Remove ${failures.size > 1 ? 'them' : 'it'} or try again.`, { move: true })
    return
  }

  setHashStatus(`${snapshot.length} ${snapshot.length === 1 ? 'file' : 'files'} ready ✓`)
  els.detailsStage.hidden = false

  if (focusDetails) moveTo(els.description, { focus: true, block: 'center' })
}

function createReceipt() {
  const description = els.description.value.trim()
  const primaryEmail = els.primaryEmail.value.trim()
  const secondEmail = els.secondEmail.value.trim()
  clearCreateFieldErrors()
  showAlert(els.createAlert, '')

  if (!description) return showFieldError(els.description, 'Add a short description.')
  if (primaryEmail && !isValidEmail(primaryEmail)) return showFieldError(els.primaryEmail, 'Enter a valid email address or leave it blank.')
  if (secondEmail && !primaryEmail) return showFieldError(els.secondEmail, 'Add the first email address before a second recipient.')
  if (secondEmail && !isValidEmail(secondEmail)) return showFieldError(els.secondEmail, 'Enter a valid second email address or remove it.')
  if (secondEmail && secondEmail.toLowerCase() === primaryEmail.toLowerCase()) {
    return showFieldError(els.secondEmail, 'Use a different address for the second recipient.')
  }
  if (hashFailures.size || !currentFileProofs.length || currentFileProofs.length !== selectedFiles.length) {
    showAlert(els.createAlert, 'Wait until all selected files are ready.', { move: true })
    return
  }

  currentReceipt = buildReceipt({
    description,
    includeFilename: els.includeFilename.checked,
    files: currentFileProofs.map(({ file, hash }) => ({
      hash,
      fileName: file.name,
      fileSizeBytes: file.size,
      mediaType: file.type
    }))
  })
  currentReceipt._delivery = { primaryEmail, secondEmail }
  renderReceipt()
  els.fileStage.hidden = true
  els.detailsStage.hidden = true
  els.receiptStage.hidden = false
  moveTo($('#receipt-stage-title'), { focus: true, block: 'center' })
}

function publicReceipt() {
  const { _delivery, ...receipt } = currentReceipt
  return receipt
}

function renderReceipt() {
  const receipt = publicReceipt()
  const { primaryEmail, secondEmail } = currentReceipt._delivery
  const totalSize = receipt.files.reduce((sum, file) => sum + file.file_size_bytes, 0)
  const hashValue = receipt.files.length === 1
    ? receipt.files[0].hash
    : receipt.files.map((file, index) => `${index + 1}. ${file.file_name || `File ${index + 1}`}\n${file.hash}`).join('\n\n')
  const hashLabel = receipt.files.length === 1
    ? 'SHA-256 hash / file fingerprint'
    : 'SHA-256 hashes / file fingerprints'
  const rows = [
    ...(primaryEmail ? [['To', primaryEmail]] : []),
    ...(secondEmail ? [['CC', secondEmail]] : []),
    ['Description', receipt.description],
    ['Files', receipt.files.length === 1 ? '1 file' : `${receipt.files.length} files`],
    ...(receipt.files.length === 1 && receipt.files[0].file_name ? [['Filename', receipt.files[0].file_name]] : []),
    [receipt.files.length === 1 ? 'Size' : 'Total size', formatBytes(totalSize)],
    [hashLabel, hashValue]
  ]
  els.receiptSummary.replaceChildren(...rows.flatMap(([key, value]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = key
    dd.textContent = value
    if (key.startsWith('SHA-256')) {
      dt.classList.add('receipt-hash-label')
      dd.classList.add('receipt-hash')
    }
    return [dt, dd]
  }))
  els.providerCount.textContent = secondEmail
    ? '2 email addresses'
    : primaryEmail
      ? '1 email address'
      : 'Saved locally'
}

function openEmail() {
  const { primaryEmail, secondEmail } = currentReceipt._delivery
  window.location.href = createMailtoUrl({ receipt: publicReceipt(), primaryEmail, secondEmail })
}

async function copyText(text, button, label) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(text)
    const previous = button.textContent
    button.textContent = label
    setTimeout(() => { button.textContent = previous }, 1500)
  } catch {
    showToast('Copying was blocked. Use Save ProofStamp instead.')
  }
}

function triggerDownload(blob, filename) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function downloadReceipt() {
  const receipt = publicReceipt()
  const keyHash = receipt.files[0].hash
  triggerDownload(new Blob([receiptToText(receipt)], { type: 'text/plain;charset=utf-8' }), `proofstamp-${keyHash.slice(0, 12)}.txt`)
}

function renderVerifyFiles() {
  els.verifySelectedFiles.replaceChildren(...selectedVerifyFiles.map((file, index) => makeFileRow(file, index, removeVerifyFile)))
  const hasFiles = selectedVerifyFiles.length > 0
  els.verifySelectedFiles.hidden = !hasFiles
  els.verifyDropZone.hidden = hasFiles
  els.addMoreVerifyFiles.hidden = !hasFiles || selectedVerifyFiles.length >= MAX_FILES_PER_PROOFSTAMP
}

function acceptVerifyFiles(fileList) {
  showAlert(els.verifyAlert, '')
  els.verifyResult.hidden = true
  const result = mergeFileSelection(selectedVerifyFiles, fileList)
  els.verifyFile.value = ''

  if (result.error) {
    showAlert(els.verifyAlert, `${result.error}${previousSelectionCopy(selectedVerifyFiles)}`, { move: true })
    return
  }

  if (result.added) selectedVerifyFiles = result.files
  renderVerifyFiles()
  if (result.duplicates) showAlert(els.verifyAlert, duplicateSelectionCopy(result.duplicates))
}

function removeVerifyFile(index) {
  selectedVerifyFiles.splice(index, 1)
  els.verifyFile.value = ''
  els.verifyResult.hidden = true
  showAlert(els.verifyAlert, '')
  renderVerifyFiles()
}

async function verify() {
  showAlert(els.verifyAlert, '')
  clearFieldError(els.expectedHash)
  els.verifyResult.hidden = true

  const expectedHashes = extractProofstampFileHashes(els.expectedHash.value)
  if (!selectedVerifyFiles.length) {
    showAlert(els.verifyAlert, 'Choose one or more files to check.', { move: true })
    return
  }
  if (!expectedHashes.length) return showFieldError(els.expectedHash, 'Paste a valid fingerprint or ProofStamp email.')

  els.verifyButton.disabled = true
  const actual = []

  try {
    for (let index = 0; index < selectedVerifyFiles.length; index += 1) {
      const file = selectedVerifyFiles[index]
      els.verifyButton.textContent = selectedVerifyFiles.length === 1 ? 'Checking…' : `Checking… ${index + 1}/${selectedVerifyFiles.length}`
      actual.push({ file, hash: await verifyFileLocally(file) })
    }

    const remaining = new Map()
    expectedHashes.forEach((hash) => remaining.set(hash, (remaining.get(hash) || 0) + 1))
    const results = actual.map(({ file, hash }) => {
      const count = remaining.get(hash) || 0
      const match = count > 0
      if (match) remaining.set(hash, count - 1)
      return { file, hash, match }
    })

    const matchedCount = results.filter(({ match }) => match).length
    const allIndividualMatch = matchedCount === results.length
    const checkingCompleteSet = actual.length === expectedHashes.length
    const success = allIndividualMatch
    els.verifyResult.hidden = false
    els.verifyResult.className = `verify-result ${success ? 'match' : 'mismatch'}`
    els.verifyResultIcon.textContent = success ? '✓' : '×'

    if (success && checkingCompleteSet && actual.length > 1) {
      els.verifyResultTitle.textContent = 'Verified locally'
      els.verifyResultCopy.textContent = 'Two different local methods produced the same fingerprint for every file. The selected files match all fingerprints in this ProofStamp. Nothing was uploaded.'
    } else if (success && actual.length === 1) {
      els.verifyResultTitle.textContent = 'Verified locally'
      els.verifyResultCopy.textContent = 'Two different local methods produced the same fingerprint. This file matches the ProofStamp. Nothing was uploaded.'
    } else if (success) {
      els.verifyResultTitle.textContent = 'Verified locally'
      els.verifyResultCopy.textContent = 'Two different local methods produced the same fingerprint for every selected file. Each selected file matches a fingerprint in this ProofStamp. Nothing was uploaded.'
    } else {
      els.verifyResultTitle.textContent = `${matchedCount} of ${actual.length} files match`
      els.verifyResultCopy.textContent = 'A non-matching file is different, changed, or was not part of this ProofStamp.'
    }

    els.actualHash.textContent = results.map(({ file, hash, match }) => `${match ? '✓' : '×'} ${file.name}\n${hash}`).join('\n\n')
    moveTo(els.verifyResultTitle, { focus: true, block: 'center' })
  } catch {
    showAlert(els.verifyAlert, 'Local verification could not be completed safely. Try again or use another browser.', { move: true })
  } finally {
    els.verifyButton.disabled = false
    els.verifyButton.textContent = 'Check files'
  }
}

els.createTab.addEventListener('click', () => switchTab('create'))
els.verifyTab.addEventListener('click', () => switchTab('verify'))
els.fileInput.addEventListener('change', () => acceptFiles(els.fileInput.files))
els.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); els.dropZone.classList.add('dragging') })
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragging'))
els.dropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  els.dropZone.classList.remove('dragging')
  acceptFiles(event.dataTransfer.files)
})
els.startOver.addEventListener('click', () => resetCreate({ move: true }))
els.description.addEventListener('input', () => {
  els.descriptionCount.textContent = `${els.description.value.length} / 500`
  clearFieldError(els.description)
})
els.primaryEmail.addEventListener('input', () => clearFieldError(els.primaryEmail))
els.addSecondEmail.addEventListener('click', () => setSecondEmailVisible(true, { focus: true }))
els.removeSecondEmail.addEventListener('click', () => {
  setSecondEmailVisible(false)
  moveTo(els.addSecondEmail, { focus: true, block: 'center' })
})
els.secondEmail.addEventListener('input', () => clearFieldError(els.secondEmail))
els.receiptForm.addEventListener('submit', (event) => { event.preventDefault(); createReceipt() })
els.openEmail.addEventListener('click', openEmail)
els.copyReceipt.addEventListener('click', () => copyText(receiptToText(publicReceipt()), els.copyReceipt, 'Copied'))
els.downloadReceipt.addEventListener('click', downloadReceipt)
els.createAnother.addEventListener('click', () => resetCreate({ move: true }))
els.verifyFile.addEventListener('change', () => acceptVerifyFiles(els.verifyFile.files))
els.expectedHash.addEventListener('input', () => clearFieldError(els.expectedHash))
els.verifyDropZone.addEventListener('dragover', (event) => { event.preventDefault(); els.verifyDropZone.classList.add('dragging') })
els.verifyDropZone.addEventListener('dragleave', () => els.verifyDropZone.classList.remove('dragging'))
els.verifyDropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  els.verifyDropZone.classList.remove('dragging')
  acceptVerifyFiles(event.dataTransfer.files)
})
els.verifyButton.addEventListener('click', verify)
window.addEventListener('pagehide', revokeAllPreviews)

if (location.pathname.startsWith('/verify') || location.hash === '#verify') switchTab('verify', { move: true })
