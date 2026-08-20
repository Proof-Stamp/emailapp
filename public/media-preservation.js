import { looksLikeFreshCapture } from './capture-detection.js'

const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const fileInput = document.querySelector('#file-input')
const selectedFilesRoot = document.querySelector('#selected-files')
const safetyPanel = document.querySelector('#captured-media-safety')
const safetyTitle = document.querySelector('#capture-safety-title')
const safetyCopy = safetyPanel?.querySelector('p')
const saveButton = document.querySelector('#save-selected-media')
const saveStatus = document.querySelector('#save-media-status')
const detailsStage = document.querySelector('#details-stage')
const description = document.querySelector('#description')
const startOver = document.querySelector('#start-over')
const createAnother = document.querySelector('#create-another')

const selected = []
const freshCaptureIds = new Set()
const savedCaptureIds = new Set()
let pickerOpenedAt = 0

function fileIdentity(file) {
  return `${file.name}\u0000${file.size}\u0000${file.type || ''}\u0000${file.lastModified || 0}`
}

function isMobileLike() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 700
}

function acceptedAdditions(fileList) {
  const incoming = Array.from(fileList || [])
  if (!incoming.length || incoming.length > MAX_FILES) return []
  if (incoming.some((file) => file.size > MAX_FILE_SIZE_BYTES)) return []

  const seen = new Set(selected.map(fileIdentity))
  const additions = incoming.filter((file) => !seen.has(fileIdentity(file)))
  if (additions.length > MAX_FILES - selected.length) return []
  return additions
}

function capturedMedia({ unsavedOnly = false } = {}) {
  return selected.filter((file) => {
    const key = fileIdentity(file)
    if (!freshCaptureIds.has(key)) return false
    return !unsavedOnly || !savedCaptureIds.has(key)
  })
}

function focusSafetyAction() {
  if (!saveButton || !safetyPanel || safetyPanel.hidden || saveButton.hidden) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      saveButton.focus({ preventScroll: true })
      safetyPanel.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  })
}

function focusDescription() {
  if (!description) return
  requestAnimationFrame(() => {
    description.focus({ preventScroll: true })
    description.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function updateSafetyPanel() {
  if (!safetyPanel || !saveButton || !safetyTitle || !safetyCopy) return

  const captured = capturedMedia()
  const unsaved = capturedMedia({ unsavedOnly: true })
  const show = isMobileLike() && captured.length > 0
  safetyPanel.hidden = !show

  if (!show) {
    saveButton.hidden = false
    saveButton.disabled = false
    safetyPanel.classList.remove('capture-safety-saved')
    if (saveStatus) saveStatus.textContent = ''
    return
  }

  if (unsaved.length) {
    safetyPanel.classList.remove('capture-safety-saved')
    safetyTitle.textContent = unsaved.length === 1
      ? 'New camera or recorder file'
      : `${unsaved.length} new camera or recorder files`
    safetyCopy.textContent = unsaved.length === 1
      ? 'This looks like a file created while the picker was open. Your phone may not have saved it to Photos or Files. Save the original before continuing.'
      : 'These look like files created while the picker was open. Your phone may not have saved them to Photos or Files. Save the originals before continuing.'
    saveButton.hidden = false
    saveButton.disabled = false
    saveButton.textContent = unsaved.length === 1 ? 'Save original copy' : `Save ${unsaved.length} original copies`
    if (saveStatus) saveStatus.textContent = ''
    return
  }

  safetyPanel.classList.add('capture-safety-saved')
  safetyTitle.textContent = captured.length === 1 ? 'Original copy save started ✓' : 'Original copies save started ✓'
  safetyCopy.textContent = 'Keep the saved original with your ProofStamp.'
  saveButton.hidden = true
  if (saveStatus) saveStatus.textContent = 'Check Downloads or Files on your device.'
}

function recordPickerOpen() {
  pickerOpenedAt = Date.now()
}

function recordIncoming(fileList) {
  const returnedAt = Date.now()
  const additions = acceptedAdditions(fileList)

  if (!additions.length) {
    pickerOpenedAt = 0
    return
  }

  selected.push(...additions)

  if (isMobileLike() && pickerOpenedAt) {
    additions.forEach((file) => {
      if (looksLikeFreshCapture(file, { pickerOpenedAt, pickerReturnedAt: returnedAt })) {
        freshCaptureIds.add(fileIdentity(file))
      }
    })
  }

  pickerOpenedAt = 0
  updateSafetyPanel()
}

function removeAt(index) {
  if (index < 0 || index >= selected.length) return
  const [removed] = selected.splice(index, 1)
  if (removed) {
    const key = fileIdentity(removed)
    freshCaptureIds.delete(key)
    savedCaptureIds.delete(key)
  }
  updateSafetyPanel()
}

function clearAll() {
  selected.splice(0, selected.length)
  freshCaptureIds.clear()
  savedCaptureIds.clear()
  pickerOpenedAt = 0
  updateSafetyPanel()
}

function triggerDownload(file) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name || `proofstamp-original-${Date.now()}`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function saveMediaCopies() {
  const media = capturedMedia({ unsavedOnly: true })
  if (!media.length || !saveButton) return

  saveButton.disabled = true
  for (let index = 0; index < media.length; index += 1) {
    triggerDownload(media[index])
    savedCaptureIds.add(fileIdentity(media[index]))
    if (index < media.length - 1) await new Promise((resolve) => setTimeout(resolve, 300))
  }

  updateSafetyPanel()
  focusDescription()
}

fileInput?.addEventListener('click', recordPickerOpen, { capture: true })
fileInput?.addEventListener('change', (event) => recordIncoming(event.target.files), { capture: true })

selectedFilesRoot?.addEventListener('click', (event) => {
  const button = event.target.closest('button.icon-button')
  if (!button) return
  const row = button.closest('.preview-file')
  if (!row) return
  const rows = Array.from(selectedFilesRoot.querySelectorAll('.preview-file'))
  removeAt(rows.indexOf(row))
}, { capture: true })

saveButton?.addEventListener('click', saveMediaCopies)
startOver?.addEventListener('click', clearAll, { capture: true })
createAnother?.addEventListener('click', clearAll, { capture: true })
window.addEventListener('resize', updateSafetyPanel)

detailsStage && new MutationObserver(() => {
  if (!detailsStage.hidden && capturedMedia({ unsavedOnly: true }).length) focusSafetyAction()
}).observe(detailsStage, { attributes: true, attributeFilter: ['hidden'] })
