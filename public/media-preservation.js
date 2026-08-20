const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const fileInput = document.querySelector('#file-input')
const selectedFilesRoot = document.querySelector('#selected-files')
const safetyPanel = document.querySelector('#captured-media-safety')
const saveButton = document.querySelector('#save-selected-media')
const saveStatus = document.querySelector('#save-media-status')
const startOver = document.querySelector('#start-over')
const createAnother = document.querySelector('#create-another')

const selected = []

function fileIdentity(file) {
  return `${file.name}\u0000${file.size}\u0000${file.type || ''}\u0000${file.lastModified || 0}`
}

function isMedia(file) {
  return /^(image|audio|video)\//.test(file.type || '')
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

function selectedMedia() {
  return selected.filter(isMedia)
}

function updateSafetyPanel() {
  if (!safetyPanel || !saveButton) return
  const media = selectedMedia()
  const show = isMobileLike() && media.length > 0
  safetyPanel.hidden = !show
  if (!show) return

  saveButton.textContent = media.length === 1 ? 'Save original copy' : `Save ${media.length} original copies`
  if (saveStatus) saveStatus.textContent = ''
}

function recordIncoming(fileList) {
  const additions = acceptedAdditions(fileList)
  if (!additions.length) return
  selected.push(...additions)
  updateSafetyPanel()
}

function removeAt(index) {
  if (index < 0 || index >= selected.length) return
  selected.splice(index, 1)
  updateSafetyPanel()
}

function clearAll() {
  selected.splice(0, selected.length)
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
  const media = selectedMedia()
  if (!media.length || !saveButton) return

  saveButton.disabled = true
  for (let index = 0; index < media.length; index += 1) {
    triggerDownload(media[index])
    if (index < media.length - 1) await new Promise((resolve) => setTimeout(resolve, 300))
  }
  saveButton.disabled = false

  if (saveStatus) {
    saveStatus.textContent = media.length === 1
      ? 'Your browser is saving the original file. Check Downloads or Files on your device.'
      : 'Your browser is saving the originals. It may ask to allow multiple downloads.'
  }
}

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
