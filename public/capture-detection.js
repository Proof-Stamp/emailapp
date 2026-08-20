export const CAPTURE_TIMESTAMP_TOLERANCE_MS = 2000
export const MAX_PICKER_SESSION_MS = 10 * 60 * 1000

export function isMediaFile(file) {
  return /^(image|audio|video)\//.test(file?.type || '')
}

export function looksLikeFreshCapture(
  file,
  {
    pickerOpenedAt,
    pickerReturnedAt = Date.now(),
    toleranceMs = CAPTURE_TIMESTAMP_TOLERANCE_MS,
    maxSessionMs = MAX_PICKER_SESSION_MS
  } = {}
) {
  if (!isMediaFile(file)) return false

  const openedAt = Number(pickerOpenedAt)
  const returnedAt = Number(pickerReturnedAt)
  const modifiedAt = Number(file?.lastModified)

  if (!Number.isFinite(openedAt) || openedAt <= 0) return false
  if (!Number.isFinite(returnedAt) || returnedAt < openedAt) return false
  if (!Number.isFinite(modifiedAt) || modifiedAt <= 0) return false
  if (returnedAt - openedAt > maxSessionMs) return false

  return modifiedAt >= openedAt - toleranceMs && modifiedAt <= returnedAt + toleranceMs
}
