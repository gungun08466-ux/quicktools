export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024

const supportedFormats = {
  jpg: { mimeType: 'image/jpeg', extension: 'jpg' },
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
}

export function getImageFormat(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const format = supportedFormats[extension]

  if (!format) return null

  const declaredType = file.type.toLowerCase()
  const normalizedType = declaredType === 'image/jpg' ? 'image/jpeg' : declaredType

  if (normalizedType && normalizedType !== format.mimeType) return null

  return format
}

export function validateImageFile(file) {
  if (!file) return 'Choose an image file to continue.'

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'This image is larger than the 20 MB upload limit. Choose a smaller file.'
  }

  if (!getImageFormat(file)) {
    return 'Unsupported image type. Choose a JPG, JPEG, PNG, or WebP image.'
  }

  return null
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function getCompressedFilename(originalName, extension) {
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'image'
  return `${baseName}-compressed.${extension}`
}
