export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024

export async function validatePdfFile(file) {
  if (!file) return 'Choose one or more PDF files.'

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return `${file.name} exceeds the 25 MB per-file limit.`
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return `${file.name} is not a PDF file. Choose files with a .pdf extension.`
  }

  if (file.type && file.type !== 'application/pdf') {
    return `${file.name} is not recognized as a PDF file.`
  }

  try {
    const signature = await file.slice(0, 5).text()
    if (signature !== '%PDF-') {
      return `${file.name} does not contain a valid PDF signature.`
    }
  } catch {
    return `Could not read ${file.name}. Please choose another PDF file.`
  }

  return null
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
