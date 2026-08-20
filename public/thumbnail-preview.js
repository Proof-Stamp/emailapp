const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
const MAX_PREVIEW_EDGE = 640

const fileInput = document.querySelector('#file-input')
const dropZone = document.querySelector('#drop-zone')
const selectedFilesRoot = document.querySelector('#selected-files')
const startOver = document.querySelector('#start-over')
const createAnother = document.querySelector('#create-another')

const selected = []
const previews = new Map()

function fileIdentity(file) {
  return `${file.name}\u0000${file.size}\u0000${file.type || ''}\u0000${file.lastModified || 0}`
}

function canAcceptBatch(files) {
  if (!files.length || files.length > MAX_FILES) return false
  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) return false

  const seen = new Set(selected.map(fileIdentity))
  const additions = files.filter((file) => !seen.has(fileIdentity(file)))
  return additions.length <= MAX_FILES - selected.length
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Could not read image'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Browser cannot preview this image format'))
    image.src = src
  })
}

async function buildPreview(file) {
  const key = fileIdentity(file)
  if (!file.type?.startsWith('image/') || previews.has(key)) return

  previews.set(key, { status: 'loading' })

  try {
    const source = await readAsDataUrl(file)
    const image = await loadImage(source)
    const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    previews.set(key, {
      status: 'ready',
      src: canvas.toDataURL('image/jpeg', 0.82)
    })
  } catch {
    previews.set(key, { status: 'failed' })
  }

  applyPreviews()
}

function addFallback(container) {
  let fallback = container.querySelector('.local-preview-fallback')
  if (fallback) return fallback

  fallback = document.createElement('span')
  fallback.className = 'local-preview-fallback'
  fallback.textContent = 'IMG'
  Object.assign(fallback.style, {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: '100%',
    minHeight: '120px',
    fontSize: '.85rem',
    fontWeight: '800',
    letterSpacing: '.08em',
    color: 'var(--muted)',
    background: 'var(--soft)'
  })
  container.append(fallback)
  return fallback
}

function applyPreviews() {
  if (!selectedFilesRoot) return

  const rows = Array.from(selectedFilesRoot.querySelectorAll('.preview-file'))
  rows.forEach((row, index) => {
    const file = selected[index]
    if (!file || !file.type?.startsWith('image/')) return

    const image = row.querySelector('img.file-thumbnail')
    const container = row.querySelector('.file-preview')
    if (!image || !container) return

    const preview = previews.get(fileIdentity(file))
    if (!preview || preview.status === 'loading') {
      image.style.visibility = 'hidden'
      return
    }

    if (preview.status === 'ready') {
      container.querySelector('.local-preview-fallback')?.remove()
      image.src = preview.src
      image.style.visibility = 'visible'
      image.dataset.localPreviewReady = 'true'
      return
    }

    image.style.display = 'none'
    addFallback(container)
  })
}

function recordIncoming(fileList) {
  const incoming = Array.from(fileList || [])
  if (!canAcceptBatch(incoming)) return

  const seen = new Set(selected.map(fileIdentity))
  incoming.forEach((file) => {
    const key = fileIdentity(file)
    if (seen.has(key)) return
    seen.add(key)
    selected.push(file)
    buildPreview(file)
  })

  applyPreviews()
}

function clearAll() {
  selected.splice(0, selected.length)
  previews.clear()
}

fileInput?.addEventListener('change', (event) => recordIncoming(event.target.files), { capture: true })
dropZone?.addEventListener('drop', (event) => recordIncoming(event.dataTransfer?.files), { capture: true })

selectedFilesRoot?.addEventListener('click', (event) => {
  const button = event.target.closest('button.icon-button')
  if (!button) return
  const row = button.closest('.preview-file')
  if (!row) return
  const rows = Array.from(selectedFilesRoot.querySelectorAll('.preview-file'))
  const index = rows.indexOf(row)
  if (index < 0) return

  const [removed] = selected.splice(index, 1)
  if (removed) previews.delete(fileIdentity(removed))
}, { capture: true })

startOver?.addEventListener('click', clearAll, { capture: true })
createAnother?.addEventListener('click', clearAll, { capture: true })

if (selectedFilesRoot) {
  new MutationObserver(applyPreviews).observe(selectedFilesRoot, { childList: true, subtree: true })
}
