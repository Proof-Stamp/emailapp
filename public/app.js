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
  createAlert: $('#create-alert'), fileInput: $('#file-input'), dropZone: $('#drop-zone'), selectedFiles: $('#selected-files'), hashFile: $('#hash-file'),
  fileStage: $('#file-stage'), detailsStage: $('#details-stage'), receiptStage: $('#receipt-stage'), startOver: $('#start-over'),
  hashValue: $('#hash-value'), copyHash: $('#copy-hash'), receiptForm: $('#receipt-form'), description: $('#description'),
  descriptionCount: $('#description-count'), primaryEmail: $('#primary-email'), secondEmail: $('#second-email'),
  includeFilename: $('#include-filename'), receiptSummary: $('#receipt-summary'), providerCount: $('#receipt-provider-count'),
  openEmail: $('#open-email'), copyReceipt: $('#copy-receipt'), downloadReceipt: $('#download-receipt'), createAnother: $('#create-another'),
  verifyAlert: $('#verify-alert'), expectedHash: $('#expected-hash'), verifyFile: $('#verify-file'), verifyDropZone: $('#verify-drop-zone'),
  verifySelectedFiles: $('#verify-selected-files'), verifyButton: $('#verify-button'), verifyResult: $('#verify-result'),
  verifyResultIcon: $('#verify-result-icon'), verifyResultTitle: $('#verify-result-title'), verifyResultCopy: $('#verify-result-copy'),
  actualHash: $('#actual-hash')
}

let selectedFiles = []
let selectedVerifyFiles = []
let currentFileProofs = []
let currentReceipt = null

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

function validateFiles(files, alertElement) {
  if (!files.length) return false
  if (files.length > MAX_FILES_PER_PROOFSTAMP) {
    showAlert(alertElement, `Choose up to ${MAX_FILES_PER_PROOFSTAMP} files at a time.`)
    return false
  }
  const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE_BYTES)
  if (tooLarge) {
    showAlert(alertElement, `${tooLarge.name} is larger than 50 MB.`)
    return false
  }
  return true
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
  els.selectedFiles.hidden = selectedFiles.length === 0
  els.hashFile.hidden = selectedFiles.length === 0
  els.hashFile.textContent = selectedFiles.length === 1 ? 'Create file fingerprint' : `Create ${selectedFiles.length} file fingerprints`
}

function acceptFiles(fileList) {
  showAlert(els.createAlert, '')
  const files = Array.from(fileList || [])
  if (!validateFiles(files, els.createAlert)) return
  selectedFiles = files
  currentFileProofs = []
  currentReceipt = null
  renderCreateFiles()
}

function removeCreateFile(index) {
  selectedFiles.splice(index, 1)
  currentFileProofs = []
  currentReceipt = null
  els.fileInput.value = ''
  renderCreateFiles()
}

function resetCreate() {
  selectedFiles = []
  currentFileProofs = []
  currentReceipt = null
  els.fileInput.value = ''
  els.selectedFiles.replaceChildren()
  els.selectedFiles.hidden = true
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

async function calculateHashes() {
  if (!selectedFiles.length) return
  els.hashFile.disabled = true
  currentFileProofs = []

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
    els.description.focus()
  } catch {
    currentFileProofs = []
    showAlert(els.createAlert, 'This browser could not read one of those files. Try choosing the files again.')
  } finally {
    els.hashFile.disabled = false
    els.hashFile.textContent = selectedFiles.length === 1 ? 'Create file fingerprint' : `Create ${selectedFiles.length} file fingerprints`
  }
}

function createReceipt() {
  const description = els.description.value.trim()
  const primaryEmail = els.primaryEmail.value.trim()
  const secondEmail = els.secondEmail.value.trim()
  if (!description) return showAlert(els.createAlert, 'Add a short description so you can recognize these files later.')
  if (!isValidEmail(primaryEmail)) return showAlert(els.createAlert, 'Enter a valid email address.')
  if (secondEmail && !isValidEmail(secondEmail)) return showAlert(els.createAlert, 'Enter a valid CC email address or leave it blank.')
  if (secondEmail && secondEmail.toLowerCase() === primaryEmail.toLowerCase()) {
    return showAlert(els.createAlert, 'Use a different address for CC.')
  }
  if (!currentFileProofs.length || currentFileProofs.length !== selectedFiles.length) {
    return showAlert(els.createAlert, 'Choose the files and create their fingerprints first.')
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
  showAlert(els.createAlert, '')
  els.detailsStage.hidden = true
  els.receiptStage.hidden = false
  setStep(3)
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
    showAlert(els.createAlert, 'Copying was blocked. Select the text and copy it manually.')
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
  els.verifySelectedFiles.hidden = selectedVerifyFiles.length === 0
}

function acceptVerifyFiles(fileList) {
  showAlert(els.verifyAlert, '')
  els.verifyResult.hidden = true
  const files = Array.from(fileList || [])
  if (!validateFiles(files, els.verifyAlert)) return
  selectedVerifyFiles = files
  renderVerifyFiles()
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
  els.verifyResult.hidden = true
  showAlert(els.verifyAlert, '')
}

async function verify() {
  showAlert(els.verifyAlert, '')
  els.verifyResult.hidden = true

  const expectedHashes = extractProofstampFileHashes(els.expectedHash.value)
  if (!selectedVerifyFiles.length) return showAlert(els.verifyAlert, 'Choose one or more files you want to check.')
  if (!expectedHashes.length) return showAlert(els.verifyAlert, 'Paste a valid fingerprint or the full ProofStamp email.')

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
  } catch {
    showAlert(els.verifyAlert, 'This browser could not read one of those files. Try choosing the files again.')
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
els.startOver.addEventListener('click', resetCreate)
els.description.addEventListener('input', () => { els.descriptionCount.textContent = `${els.description.value.length} / 500` })
els.copyHash.addEventListener('click', () => copyText(els.hashValue.textContent, els.copyHash, 'Copied'))
els.receiptForm.addEventListener('submit', (event) => { event.preventDefault(); createReceipt() })
els.openEmail.addEventListener('click', openEmail)
els.copyReceipt.addEventListener('click', () => copyText(receiptToText(publicReceipt()), els.copyReceipt, 'Copied'))
els.downloadReceipt.addEventListener('click', downloadReceipt)
els.createAnother.addEventListener('click', resetCreate)
els.verifyFile.addEventListener('change', () => acceptVerifyFiles(els.verifyFile.files))
els.verifyDropZone.addEventListener('dragover', (event) => { event.preventDefault(); els.verifyDropZone.classList.add('dragging') })
els.verifyDropZone.addEventListener('dragleave', () => els.verifyDropZone.classList.remove('dragging'))
els.verifyDropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  els.verifyDropZone.classList.remove('dragging')
  acceptVerifyFiles(event.dataTransfer.files)
})
els.verifyButton.addEventListener('click', verify)

if (location.pathname.startsWith('/verify') || location.hash === '#verify') switchTab('verify')
