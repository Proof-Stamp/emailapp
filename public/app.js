import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_PROOFSTAMP,
  extractProofstampFileHashes,
  sha256File
} from './hash.js'
import { createMailtoUrl, createReceipt as buildReceipt, formatBytes, isValidEmail, receiptToText } from './receipt.js'

const $ = (selector) => document.querySelector(selector)
const els = {
  createTab: $('#create-tab'), verifyTab: $('#verify-tab'), createPanel: $('#create-panel'), verifyPanel: $('#verify-panel'),
  createAlert: $('#create-alert'), fileInput: $('#file-input'), dropZone: $('#drop-zone'), selectedFiles: $('#selected-files'), addMoreFiles: $('#add-more-files'), hashFile: $('#hash-file'),
  fileStage: $('#file-stage'), detailsStage: $('#details-stage'), receiptStage: $('#receipt-stage'), startOver: $('#start-over'),
  hashValue: $('#hash-value'), copyHash: $('#copy-hash'), receiptForm: $('#receipt-form'), description: $('#description'),
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

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function moveTo(element, { focus = false, block = 'center' } = {}) {
  if (!element) return
  requestAnimationFrame(() => {
    if (focus) {
      const naturallyFocusable = element.matches('a, button, input, textarea, select, [tabindex]')
      if (!naturallyFocusable) element.setAttribute('tabindex', '-1')
      element.focus({ preventScroll: true })
    }
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block
    })
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
    position: 'fixed',
    left: '50%',
    bottom: '1rem',
    zIndex: '1000',
    maxWidth: 'calc(100% - 2rem)',
    padding: '.8rem 1rem',
    borderRadius: '.7rem',
    background: 'var(--navy)',
    color: 'white',
    fontWeight: '700',
    fontSize: '.85rem',
    boxShadow: '0 12px 32px rgba(7, 27, 44, .22)',
    transform: 'translateX(-50%)'
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

function setStep(active) {
  document.querySelectorAll('.step').forEach((step, index) => {
    step.classList.toggle('active', index + 1 === active)
    step.classList.toggle('complete', index + 1 < active)
  })
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
  if (files.length > MAX_FILES_PER_PROOFSTAMP) {
    return `Choose up to ${MAX_FILES_PER_PROOFSTAMP} files at a time.`
  }
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
      ? `You can add ${remaining} more ${remaining === 1 ? 'file' : 'files'} to this ProofStamp.`
      : `You already have ${MAX_FILES_PER_PROOFSTAMP} files selected.`
    return { files: current, added: 0, duplicates, error }
  }

  return {
    files: [...current, ...additions],
    added: additions.length,
    duplicates,
    error: ''
  }
}

function previousSelectionCopy(files) {
  if (!files.length) return ''
  return ` Your previous ${files.length} ${files.length === 1 ? 'file is' : 'files are'} still selected.`
}

function duplicateSelectionCopy(count) {
  if (!count) return ''
  return `${count === 1 ? 'That file is' : `${count} files are`} already selected, so ${count === 1 ? 'it was' : 'they were'} not added again.`
}

function makeFileRow(file, index, onRemove) {
  const row = document.createElement('div')
  row.className = 'selected-file'

  const icon = document.createElement('div')
  icon.className = 'file-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = 'FILE'

  const copy = document.createElement('div')
  copy.className = 'file-copy'
  const name = document.createElement('strong')
  name.textContent = file.name
  const meta = document.createElement('span')
  meta.textContent = `${formatBytes(file.size)}${file.type ? ` · ${file.type}` : ''}`
  copy.append(name, meta)

  const remove = document.createElement('button')
  remove.className = 'icon-button'
  remove.type = 'button'
  remove.setAttribute('aria-label', `Remove ${file.name}`)
  remove.textContent = '×'
  remove.addEventListener('click', () => onRemove(index))

  row.append(icon, copy, remove)
  return row
}

function renderCreateFiles() {
  els.selectedFiles.replaceChildren(...selectedFiles.map((file, index) => makeFileRow(file, index, removeCreateFile)))
  const hasFiles = selectedFiles.length > 0
  els.selectedFiles.hidden = !hasFiles
  els.dropZone.hidden = hasFiles
  els.addMoreFiles.hidden = !hasFiles || selectedFiles.length >= MAX_FILES_PER_PROOFSTAMP
  els.hashFile.hidden = !hasFiles
  els.hashFile.textContent = selectedFiles.length === 1 ? 'Create file fingerprint' : `Create ${selectedFiles.length} file fingerprints`
}

function acceptFiles(fileList) {
  showAlert(els.createAlert, '')
  const result = mergeFileSelection(selectedFiles, fileList)
  els.fileInput.value = ''

  if (result.error) {
    showAlert(els.createAlert, `${result.error}${previousSelectionCopy(selectedFiles)}`, { move: true })
    return
  }

  if (result.added) {
    selectedFiles = result.files
    currentFileProofs = []
    currentReceipt = null
  }
  renderCreateFiles()
  if (result.duplicates) showAlert(els.createAlert, duplicateSelectionCopy(result.duplicates))
}

function removeCreateFile(index) {
  selectedFiles.splice(index, 1)
  currentFileProofs = []
  currentReceipt = null
  els.fileInput.value = ''
  renderCreateFiles()
}

function resetCreate({ move = true } = {}) {
  selectedFiles = []
  currentFileProofs = []
  currentReceipt = null
  els.fileInput.value = ''
  els.selectedFiles.replaceChildren()
  els.selectedFiles.hidden = true
  els.dropZone.hidden = false
  els.addMoreFiles.hidden = true
  els.hashFile.hidden = true
  els.fileStage.hidden = false
  els.detailsStage.hidden = true
  els.receiptStage.hidden = true
  els.receiptForm.reset()
  setSecondEmailVisible(false)
  els.includeFilename.checked = true
  els.descriptionCount.textContent = '0 / 500'
  clearCreateFieldErrors()
  showAlert(els.createAlert, '')
  setStep(1)
  if (move) moveTo($('#file-stage-title'), { focus: true, block: 'start' })
}

async function calculateHashes() {
  if (!selectedFiles.length) return
  els.hashFile.disabled = true
  currentFileProofs = []
  showAlert(els.createAlert, '')

  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index]
      els.hashFile.textContent = selectedFiles.length === 1
        ? 'Creating fingerprint…'
        : `Creating fingerprints… ${index + 1}/${selectedFiles.length}`
      const hash = await sha256File(file)
      currentFileProofs.push({ file, hash })
    }

    const fingerprintLines = currentFileProofs.map(
      ({ file, hash }, index) => `${index + 1}. ${file.name}  ${hash}`
    )
    els.hashValue.textContent = fingerprintLines.join('\n')
    els.hashValue.style.whiteSpace = 'pre-wrap'

    els.fileStage.hidden = true
    els.detailsStage.hidden = false
    setStep(2)
    moveTo(els.description, { focus: true, block: 'center' })
  } catch {
    currentFileProofs = []
    showAlert(els.createAlert, 'This browser could not read one of those files. Try choosing the files again.', { move: true })
  } finally {
    els.hashFile.disabled = false
    els.hashFile.textContent = selectedFiles.length === 1 ? 'Create file fingerprint' : `Create ${selectedFiles.length} file fingerprints`
  }
}

function createReceipt() {
  const description = els.description.value.trim()
  const primaryEmail = els.primaryEmail.value.trim()
  const secondEmail = els.secondEmail.value.trim()
  clearCreateFieldErrors()
  showAlert(els.createAlert, '')

  if (!description) return showFieldError(els.description, 'Add a short description so you can recognize these files later.')
  if (!isValidEmail(primaryEmail)) return showFieldError(els.primaryEmail, 'Enter a valid email address.')
  if (secondEmail && !isValidEmail(secondEmail)) return showFieldError(els.secondEmail, 'Enter a valid second email address or remove it.')
  if (secondEmail && secondEmail.toLowerCase() === primaryEmail.toLowerCase()) {
    return showFieldError(els.secondEmail, 'Use a different address for the second email.')
  }
  if (!currentFileProofs.length || currentFileProofs.length !== selectedFiles.length) {
    showAlert(els.createAlert, 'Choose the files and create their fingerprints first.', { move: true })
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
  els.detailsStage.hidden = true
  els.receiptStage.hidden = false
  setStep(3)
  moveTo($('#receipt-stage-title'), { focus: true, block: 'start' })
}

function publicReceipt() {
  const { _delivery, ...receipt } = currentReceipt
  return receipt
}

function renderReceipt() {
  const receipt = publicReceipt()
  const { primaryEmail, secondEmail } = currentReceipt._delivery
  const totalSize = receipt.files.reduce((sum, file) => sum + file.file_size_bytes, 0)
  const rows = [
    ['To', primaryEmail],
    ...(secondEmail ? [['CC', secondEmail]] : []),
    ['Description', receipt.description],
    ['Files', receipt.files.length === 1 ? '1 file' : `${receipt.files.length} files`],
    ...(receipt.files.length === 1 && receipt.files[0].file_name ? [['Filename', receipt.files[0].file_name]] : []),
    [receipt.files.length === 1 ? 'Size' : 'Total size', formatBytes(totalSize)],
    [receipt.files.length === 1 ? 'File fingerprint (SHA-256)' : 'Fingerprints', receipt.files.length === 1 ? receipt.files[0].hash : `${receipt.files.length} individual SHA-256 fingerprints`],
    ['Created at', new Date(receipt.created_at_device).toLocaleString()]
  ]
  els.receiptSummary.replaceChildren(...rows.flatMap(([key, value]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = key
    dd.textContent = value
    return [dt, dd]
  }))
  els.providerCount.textContent = secondEmail ? '2 email addresses' : '1 email address'
}

function openEmail() {
  const { primaryEmail, secondEmail } = currentReceipt._delivery
  window.location.href = createMailtoUrl({ receipt: publicReceipt(), primaryEmail, secondEmail })
}

async function copyText(text, button, label) {
  try {
    await navigator.clipboard.writeText(text)
    const previous = button.textContent
    button.textContent = label
    setTimeout(() => { button.textContent = previous }, 1500)
  } catch {
    showToast('Copying was blocked. Select the text and copy it manually.')
  }
}

function downloadReceipt() {
  const receipt = publicReceipt()
  const keyHash = receipt.files[0].hash
  const blob = new Blob([receiptToText(receipt)], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `proofstamp-${keyHash.slice(0, 12)}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
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

function resetVerifyFiles() {
  selectedVerifyFiles = []
  els.verifyFile.value = ''
  els.verifySelectedFiles.replaceChildren()
  els.verifySelectedFiles.hidden = true
  els.verifyDropZone.hidden = false
  els.addMoreVerifyFiles.hidden = true
  els.verifyResult.hidden = true
  clearFieldError(els.expectedHash)
  showAlert(els.verifyAlert, '')
}

async function verify() {
  showAlert(els.verifyAlert, '')
  clearFieldError(els.expectedHash)
  els.verifyResult.hidden = true

  const expectedHashes = extractProofstampFileHashes(els.expectedHash.value)
  if (!selectedVerifyFiles.length) {
    showAlert(els.verifyAlert, 'Choose one or more files you want to check.', { move: true })
    return
  }
  if (!expectedHashes.length) return showFieldError(els.expectedHash, 'Paste a valid fingerprint or the full ProofStamp email.')

  els.verifyButton.disabled = true
  const actual = []

  try {
    for (let index = 0; index < selectedVerifyFiles.length; index += 1) {
      const file = selectedVerifyFiles[index]
      els.verifyButton.textContent = selectedVerifyFiles.length === 1
        ? 'Checking the file…'
        : `Checking files… ${index + 1}/${selectedVerifyFiles.length}`
      actual.push({ file, hash: await sha256File(file) })
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
      els.verifyResultTitle.textContent = `All ${actual.length} files match this ProofStamp`
      els.verifyResultCopy.textContent = 'The selected files match all fingerprints recorded in this ProofStamp.'
    } else if (success && actual.length === 1) {
      els.verifyResultTitle.textContent = 'This file matches the ProofStamp'
      els.verifyResultCopy.textContent = 'The file has exactly the same contents as a file recorded in this ProofStamp.'
    } else if (success) {
      els.verifyResultTitle.textContent = `All ${actual.length} selected files match this ProofStamp`
      els.verifyResultCopy.textContent = 'Every selected file matches a fingerprint in this ProofStamp.'
    } else {
      els.verifyResultTitle.textContent = `${matchedCount} of ${actual.length} selected files match this ProofStamp`
      els.verifyResultCopy.textContent = 'A non-matching file is different, changed, or was not part of this ProofStamp.'
    }

    els.actualHash.textContent = results
      .map(({ file, hash, match }) => `${match ? '✓' : '×'} ${file.name}\n${hash}`)
      .join('\n\n')
    moveTo(els.verifyResultTitle, { focus: true, block: 'center' })
  } catch {
    showAlert(els.verifyAlert, 'This browser could not read one of those files. Try choosing the files again.', { move: true })
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
els.hashFile.addEventListener('click', calculateHashes)
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
els.copyHash.addEventListener('click', () => copyText(els.hashValue.textContent, els.copyHash, 'Copied'))
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

if (location.pathname.startsWith('/verify') || location.hash === '#verify') {
  switchTab('verify', { move: true })
}
