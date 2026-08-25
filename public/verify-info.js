const result = document.querySelector('#verify-result')
const button = document.querySelector('#verify-method-info-button')
const panel = document.querySelector('#verify-method-info')
const toolShell = result?.closest('.tool-shell')

function setOpen(open, { restoreFocus = false } = {}) {
  if (!button || !panel) return
  panel.hidden = !open
  button.setAttribute('aria-expanded', String(open))
  toolShell?.classList.toggle('verify-info-open', open)
  if (!open && restoreFocus) button.focus()
}

if (result && button && panel) {
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(panel.hidden)
  })

  document.addEventListener('click', (event) => {
    if (panel.hidden) return
    if (button.contains(event.target) || panel.contains(event.target)) return
    setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return
    setOpen(false, { restoreFocus: true })
  })

  new MutationObserver(() => {
    if (result.hidden || !result.classList.contains('match')) setOpen(false)
  }).observe(result, { attributes: true, attributeFilter: ['class', 'hidden'] })
}
