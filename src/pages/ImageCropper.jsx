import {
  AlertCircle,
  CheckCircle2,
  Crop,
  Download,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, MAX_IMAGE_SIZE_BYTES, validateImageFile } from '../utils/imageValidation.js'

const MAX_SOURCE_PIXELS = 30_000_000
const PREVIEW_MAX_WIDTH = 900
const PREVIEW_MAX_HEIGHT = 600
const ASPECT_PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: '1:1 Square', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '9:16', label: '9:16 Portrait', ratio: 9 / 16 },
]
const OUTPUT_FORMATS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPG' },
]
const CROP_HANDLES = [
  { id: 'nw', label: 'top left', position: '-left-2 -top-2', cursor: 'cursor-nwse-resize' },
  { id: 'n', label: 'top', position: 'left-1/2 -top-2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { id: 'ne', label: 'top right', position: '-right-2 -top-2', cursor: 'cursor-nesw-resize' },
  { id: 'e', label: 'right', position: '-right-2 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { id: 'se', label: 'bottom right', position: '-bottom-2 -right-2', cursor: 'cursor-nwse-resize' },
  { id: 's', label: 'bottom', position: '-bottom-2 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { id: 'sw', label: 'bottom left', position: '-bottom-2 -left-2', cursor: 'cursor-nesw-resize' },
  { id: 'w', label: 'left', position: '-left-2 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clampCrop(crop, dimensions) {
  const width = clamp(Math.round(crop.width), 1, dimensions.width)
  const height = clamp(Math.round(crop.height), 1, dimensions.height)
  return {
    x: clamp(Math.round(crop.x), 0, dimensions.width - width),
    y: clamp(Math.round(crop.y), 0, dimensions.height - height),
    width,
    height,
  }
}

function getPresetRatio(presetId) {
  return ASPECT_PRESETS.find(({ id }) => id === presetId)?.ratio ?? null
}

function getFullCrop(dimensions) {
  return { x: 0, y: 0, width: dimensions.width, height: dimensions.height }
}

function getInitialCrop(dimensions) {
  const width = Math.max(1, Math.round(dimensions.width * 0.9))
  const height = Math.max(1, Math.round(dimensions.height * 0.9))
  return clampCrop({
    x: (dimensions.width - width) / 2,
    y: (dimensions.height - height) / 2,
    width,
    height,
  }, dimensions)
}

function getPresetCrop(dimensions, ratio) {
  if (!ratio) return getFullCrop(dimensions)

  let width = dimensions.width
  let height = dimensions.height
  if (width / height > ratio) width = Math.round(height * ratio)
  else height = Math.round(width / ratio)

  return clampCrop({
    x: (dimensions.width - width) / 2,
    y: (dimensions.height - height) / 2,
    width,
    height,
  }, dimensions)
}

function getCropFromDrag(start, point, dimensions, ratio) {
  const deltaX = point.x - start.x
  const deltaY = point.y - start.y
  let width = Math.abs(deltaX)
  let height = Math.abs(deltaY)
  const directionX = deltaX < 0 ? -1 : 1
  const directionY = deltaY < 0 ? -1 : 1

  if (ratio) {
    if (!width && !height) return null
    if (width / Math.max(height, 1) > ratio) height = width / ratio
    else width = height * ratio

    const maxWidth = directionX > 0 ? dimensions.width - start.x : start.x
    const maxHeight = directionY > 0 ? dimensions.height - start.y : start.y
    const scale = Math.min(1, maxWidth / width, maxHeight / height)
    width *= scale
    height *= scale
  }

  if (width < 1 || height < 1) return null
  const crop = {
    x: directionX > 0 ? start.x : start.x - width,
    y: directionY > 0 ? start.y : start.y - height,
    width,
    height,
  }
  return clampCrop(crop, dimensions)
}

function resizeCrop(initial, deltaX, deltaY, handle, dimensions, ratio) {
  const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
  const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
  const right = initial.x + initial.width
  const bottom = initial.y + initial.height

  if (!ratio) {
    let left = initial.x
    let top = initial.y
    let nextRight = right
    let nextBottom = bottom
    if (horizontal < 0) left = clamp(initial.x + deltaX, 0, right - 1)
    if (horizontal > 0) nextRight = clamp(right + deltaX, left + 1, dimensions.width)
    if (vertical < 0) top = clamp(initial.y + deltaY, 0, bottom - 1)
    if (vertical > 0) nextBottom = clamp(bottom + deltaY, top + 1, dimensions.height)
    return clampCrop({ x: left, y: top, width: nextRight - left, height: nextBottom - top }, dimensions)
  }

  const anchorX = horizontal > 0
    ? initial.x
    : horizontal < 0
      ? right
      : initial.x + initial.width / 2
  const anchorY = vertical > 0
    ? initial.y
    : vertical < 0
      ? bottom
      : initial.y + initial.height / 2
  let width = horizontal
    ? Math.max(1, initial.width + horizontal * deltaX)
    : Math.max(1, initial.height + vertical * deltaY) * ratio
  let height = vertical
    ? Math.max(1, initial.height + vertical * deltaY)
    : width / ratio

  if (horizontal && vertical) {
    const widthChange = Math.abs(width / initial.width - 1)
    const heightChange = Math.abs(height / initial.height - 1)
    if (widthChange >= heightChange) height = width / ratio
    else width = height * ratio
  } else if (horizontal) {
    height = width / ratio
  } else {
    width = height * ratio
  }

  const maxWidth = horizontal > 0
    ? dimensions.width - anchorX
    : horizontal < 0
      ? anchorX
      : 2 * Math.min(anchorX, dimensions.width - anchorX)
  const maxHeight = vertical > 0
    ? dimensions.height - anchorY
    : vertical < 0
      ? anchorY
      : 2 * Math.min(anchorY, dimensions.height - anchorY)
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  return clampCrop({
    x: horizontal > 0 ? anchorX : horizontal < 0 ? anchorX - width : anchorX - width / 2,
    y: vertical > 0 ? anchorY : vertical < 0 ? anchorY - height : anchorY - height / 2,
    width,
    height,
  }, dimensions)
}

function drawTransformedImage(image, rotation, flipHorizontal, flipVertical) {
  const swapsDimensions = rotation % 180 !== 0
  const width = swapsDimensions ? image.naturalHeight : image.naturalWidth
  const height = swapsDimensions ? image.naturalWidth : image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create an image canvas.')

  context.translate(width / 2, height / 2)
  context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1)
  context.rotate((rotation * Math.PI) / 180)
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
  return canvas
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2
  const colors = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : status.type === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${colors}`}
    >
      <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

function getCroppedFilename(fileName, extension) {
  const baseName = fileName.replace(/\.[^.]+$/u, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').trim()
  return `${baseName || 'image'}-cropped.${extension}`
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export default function ImageCropper() {
  const fileInputRef = useRef(null)
  const imageElementRef = useRef(null)
  const sourceCanvasRef = useRef(null)
  const editorCanvasRef = useRef(null)
  const outputPreviewCanvasRef = useRef(null)
  const workspaceRef = useRef(null)
  const interactionRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const [imageFile, setImageFile] = useState(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageDimensions, setImageDimensions] = useState(null)
  const [crop, setCrop] = useState(null)
  const [aspectPreset, setAspectPreset] = useState('free')
  const [rotation, setRotation] = useState(0)
  const [flipHorizontal, setFlipHorizontal] = useState(false)
  const [flipVertical, setFlipVertical] = useState(false)
  const [outputFormat, setOutputFormat] = useState('image/png')
  const [quality, setQuality] = useState(90)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState(null)
  const [transformVersion, setTransformVersion] = useState(0)

  const createObjectUrl = (blob) => {
    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.add(url)
    return url
  }

  const releaseObjectUrl = (url) => {
    if (!url || !objectUrlsRef.current.has(url)) return
    URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(url)
  }

  const clearCanvases = () => {
    if (sourceCanvasRef.current) {
      sourceCanvasRef.current.width = 0
      sourceCanvasRef.current.height = 0
      sourceCanvasRef.current = null
    }
    if (editorCanvasRef.current) {
      editorCanvasRef.current.width = 0
      editorCanvasRef.current.height = 0
    }
    if (outputPreviewCanvasRef.current) {
      outputPreviewCanvasRef.current.width = 0
      outputPreviewCanvasRef.current.height = 0
    }
  }

  useEffect(() => {
    if (!imageFile) {
      setSourceUrl('')
      setImageDimensions(null)
      setCrop(null)
      setIsLoading(false)
      return undefined
    }

    const url = createObjectUrl(imageFile)
    const image = new window.Image()
    let active = true
    setSourceUrl(url)
    setIsLoading(true)
    image.decoding = 'async'
    image.onload = () => {
      if (!active) return
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      if (!dimensions.width || !dimensions.height) {
        setStatus({ type: 'error', message: 'This image has invalid dimensions. Choose a valid image file.' })
        setImageFile(null)
        return
      }
      if (dimensions.width * dimensions.height > MAX_SOURCE_PIXELS) {
        setStatus({
          type: 'error',
          message: `This image exceeds the ${MAX_SOURCE_PIXELS / 1_000_000}-megapixel limit. Choose a smaller image to protect browser memory.`,
        })
        setImageFile(null)
        return
      }

      try {
        const canvas = drawTransformedImage(image, 0, false, false)
        sourceCanvasRef.current = canvas
        imageElementRef.current = image
        setImageDimensions(dimensions)
        setCrop(getInitialCrop(dimensions))
        setAspectPreset('free')
        setRotation(0)
        setFlipHorizontal(false)
        setFlipVertical(false)
        setTransformVersion((currentVersion) => currentVersion + 1)
        setStatus(null)
      } catch (error) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? `Could not prepare this image: ${error.message}` : 'Could not prepare this image in your browser.',
        })
        setImageFile(null)
      } finally {
        setIsLoading(false)
      }
    }
    image.onerror = () => {
      if (!active) return
      setStatus({
        type: 'error',
        message: 'This image could not be opened. It may be corrupted or use an unsupported format.',
      })
      setIsLoading(false)
      setImageFile(null)
    }
    image.src = url

    return () => {
      active = false
      image.onload = null
      image.onerror = null
      image.src = ''
      releaseObjectUrl(url)
      if (imageElementRef.current === image) imageElementRef.current = null
    }
  }, [imageFile])

  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current
    const canvas = editorCanvasRef.current
    if (!sourceCanvas || !canvas) return

    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height
    const context = canvas.getContext('2d')
    if (!context) {
      setStatus({ type: 'error', message: 'This browser could not display the image canvas.' })
      return
    }
    context.drawImage(sourceCanvas, 0, 0)
  }, [imageDimensions, transformVersion])

  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current
    const canvas = outputPreviewCanvasRef.current
    if (!canvas) return
    if (!sourceCanvas || !crop || !imageDimensions) {
      canvas.width = 0
      canvas.height = 0
      return
    }

    const x = clamp(Math.round(crop.x), 0, imageDimensions.width - 1)
    const y = clamp(Math.round(crop.y), 0, imageDimensions.height - 1)
    const width = clamp(Math.round(crop.width), 1, imageDimensions.width - x)
    const height = clamp(Math.round(crop.height), 1, imageDimensions.height - y)
    const scale = Math.min(1, PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height)
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(sourceCanvas, x, y, width, height, 0, 0, canvas.width, canvas.height)
  }, [crop, imageDimensions, transformVersion])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
    if (sourceCanvasRef.current) {
      sourceCanvasRef.current.width = 0
      sourceCanvasRef.current.height = 0
      sourceCanvasRef.current = null
    }
    imageElementRef.current = null
    interactionRef.current = null
    if (editorCanvasRef.current) {
      editorCanvasRef.current.width = 0
      editorCanvasRef.current.height = 0
    }
    if (outputPreviewCanvasRef.current) {
      outputPreviewCanvasRef.current.width = 0
      outputPreviewCanvasRef.current.height = 0
    }
  }, [])

  const chooseImage = (file) => {
    if (isExporting) return
    const validationError = validateImageFile(file)
    if (validationError) {
      setStatus({ type: 'error', message: validationError })
      return
    }
    if (!file.size) {
      setStatus({ type: 'error', message: 'This image is empty. Choose a valid JPG, PNG, or WebP file.' })
      return
    }

    clearCanvases()
    imageElementRef.current = null
    setImageDimensions(null)
    setCrop(null)
    setSourceUrl('')
    setAspectPreset('free')
    setRotation(0)
    setFlipHorizontal(false)
    setFlipVertical(false)
    setStatus(null)
    setImageFile(file)
    setIsLoading(true)
  }

  const handleFileInput = (event) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (selectedFile) chooseImage(selectedFile)
    else setStatus({ type: 'error', message: 'Choose an image file to continue.' })
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) chooseImage(file)
    else setStatus({ type: 'error', message: 'Drop one image file to continue.' })
  }

  const reset = () => {
    clearCanvases()
    imageElementRef.current = null
    setImageFile(null)
    setSourceUrl('')
    setImageDimensions(null)
    setCrop(null)
    setAspectPreset('free')
    setRotation(0)
    setFlipHorizontal(false)
    setFlipVertical(false)
    setOutputFormat('image/png')
    setQuality(90)
    setIsLoading(false)
    setIsExporting(false)
    setStatus(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const chooseAspectPreset = (presetId) => {
    setAspectPreset(presetId)
    if (!imageDimensions) return
    if (presetId !== 'free') {
      setCrop(getPresetCrop(imageDimensions, getPresetRatio(presetId)))
    }
  }

  const changeCropDimension = (dimension, value) => {
    if (!imageDimensions || !crop || !value) return
    const nextValue = Number(value)
    if (!Number.isInteger(nextValue) || nextValue < 1) return

    setAspectPreset('free')
    setCrop((currentCrop) => {
      const width = dimension === 'width'
        ? Math.min(nextValue, imageDimensions.width)
        : currentCrop.width
      const height = dimension === 'height'
        ? Math.min(nextValue, imageDimensions.height)
        : currentCrop.height
      return clampCrop({
        ...currentCrop,
        x: Math.min(currentCrop.x, imageDimensions.width - width),
        y: Math.min(currentCrop.y, imageDimensions.height - height),
        width,
        height,
      }, imageDimensions)
    })
  }

  const updateTransform = (nextRotation, nextFlipHorizontal, nextFlipVertical) => {
    const image = imageElementRef.current
    if (!image || !imageDimensions || isExporting) return

    try {
      const nextCanvas = drawTransformedImage(image, nextRotation, nextFlipHorizontal, nextFlipVertical)
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = 0
        sourceCanvasRef.current.height = 0
      }
      sourceCanvasRef.current = nextCanvas
      const dimensions = { width: nextCanvas.width, height: nextCanvas.height }
      setImageDimensions(dimensions)
      setRotation(nextRotation)
      setFlipHorizontal(nextFlipHorizontal)
      setFlipVertical(nextFlipVertical)
      setCrop(getPresetCrop(dimensions, getPresetRatio(aspectPreset)))
      setTransformVersion((currentVersion) => currentVersion + 1)
      setStatus({ type: 'info', message: 'Image transform applied. The crop selection was reset to fit the updated image.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? `Could not transform this image: ${error.message}` : 'Could not transform this image.',
      })
    }
  }

  const rotateImage = (direction) => {
    const nextRotation = (rotation + direction + 360) % 360
    updateTransform(nextRotation, flipHorizontal, flipVertical)
  }

  const toggleFlipHorizontal = () => {
    updateTransform(rotation, !flipHorizontal, flipVertical)
  }

  const toggleFlipVertical = () => {
    updateTransform(rotation, flipHorizontal, !flipVertical)
  }

  const resetTransforms = () => {
    updateTransform(0, false, false)
  }

  const getImagePoint = (clientX, clientY) => {
    const workspace = workspaceRef.current
    if (!workspace || !imageDimensions) return null
    const bounds = workspace.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    return {
      x: clamp(((clientX - bounds.left) / bounds.width) * imageDimensions.width, 0, imageDimensions.width),
      y: clamp(((clientY - bounds.top) / bounds.height) * imageDimensions.height, 0, imageDimensions.height),
    }
  }

  const beginInteraction = (event, mode, handle = '') => {
    if (!crop || !imageDimensions || isExporting) return
    event.preventDefault()
    event.stopPropagation()
    const point = getImagePoint(event.clientX, event.clientY)
    if (!point) return
    workspaceRef.current?.setPointerCapture(event.pointerId)
    interactionRef.current = {
      mode,
      handle,
      start: point,
      initialCrop: crop,
    }
  }

  const beginNewCrop = (event) => {
    if (event.target.closest('[data-crop-control]')) return
    beginInteraction(event, 'draw')
  }

  const updateInteraction = (event) => {
    const interaction = interactionRef.current
    if (!interaction || !imageDimensions) return
    const point = getImagePoint(event.clientX, event.clientY)
    if (!point) return
    const deltaX = point.x - interaction.start.x
    const deltaY = point.y - interaction.start.y
    const ratio = getPresetRatio(aspectPreset)

    if (interaction.mode === 'draw') {
      const nextCrop = getCropFromDrag(interaction.start, point, imageDimensions, ratio)
      if (nextCrop) setCrop(nextCrop)
      return
    }
    if (interaction.mode === 'move') {
      setCrop(clampCrop({
        ...interaction.initialCrop,
        x: interaction.initialCrop.x + deltaX,
        y: interaction.initialCrop.y + deltaY,
      }, imageDimensions))
      return
    }
    if (interaction.mode === 'resize') {
      setCrop(resizeCrop(
        interaction.initialCrop,
        deltaX,
        deltaY,
        interaction.handle,
        imageDimensions,
        ratio,
      ))
    }
  }

  const endInteraction = (event) => {
    interactionRef.current = null
    if (workspaceRef.current?.hasPointerCapture(event.pointerId)) {
      workspaceRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const resetCrop = () => {
    if (!imageDimensions) return
    setCrop(getPresetCrop(imageDimensions, getPresetRatio(aspectPreset)))
    setStatus(null)
  }

  const downloadCroppedImage = async () => {
    if (!sourceCanvasRef.current || !crop || !imageDimensions || isExporting) return
    setIsExporting(true)
    setStatus({ type: 'info', message: 'Preparing the cropped image…' })

    let canvas = null
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      const x = clamp(Math.round(crop.x), 0, imageDimensions.width - 1)
      const y = clamp(Math.round(crop.y), 0, imageDimensions.height - 1)
      const width = clamp(Math.round(crop.width), 1, imageDimensions.width - x)
      const height = clamp(Math.round(crop.height), 1, imageDimensions.height - y)
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: outputFormat !== 'image/jpeg' })
      if (!context) throw new Error('This browser could not create an image canvas.')
      if (outputFormat === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
      }
      context.drawImage(sourceCanvasRef.current, x, y, width, height, 0, 0, width, height)

      const outputBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('The browser could not encode the cropped image.'))
            } else if (blob.type !== outputFormat || !blob.size) {
              reject(new Error('The browser returned an invalid image.'))
            } else {
              resolve(blob)
            }
          },
          outputFormat,
          outputFormat === 'image/jpeg' ? quality / 100 : undefined,
        )
      })

      const extension = outputFormat === 'image/jpeg' ? 'jpg' : 'png'
      const fileName = getCroppedFilename(imageFile.name, extension)
      triggerDownload(outputBlob, fileName)
      setStatus({
        type: 'success',
        message: `${fileName} is ready. Cropped dimensions: ${width} × ${height} pixels (${formatFileSize(outputBlob.size)}).`,
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? `Could not export this crop: ${error.message}` : 'Could not export this crop. Try a smaller selection.',
      })
    } finally {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      setIsExporting(false)
    }
  }

  const changeOutputFormat = (event) => {
    setOutputFormat(event.target.value)
    setStatus(null)
  }

  const canEdit = Boolean(imageFile && imageDimensions && crop && sourceUrl && !isLoading)
  const cropWidth = crop ? Math.round(crop.width) : 0
  const cropHeight = crop ? Math.round(crop.height) : 0

  return (
    <>
      <PageMetadata
        title="Image Cropper - Crop Images Online in Your Browser"
        description="Crop JPG, PNG, and WebP images online. Set aspect ratios or custom dimensions, rotate and flip images, preview the crop, and download as PNG or JPG. Files stay on your device."
      />
      <div className="mx-auto max-w-7xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Image Cropper</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Crop, rotate, and flip JPG, PNG, or WebP images in your browser.
            Choose a preset ratio or enter exact crop dimensions, then download
            the result as PNG or JPG.
          </p>
        </header>

        <section
          aria-label="Image cropper"
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
          }}
          onDrop={handleDrop}
          className={`tool-surface-raised p-4 transition sm:p-6 ${isDragging ? 'ring-4 ring-indigo-200' : ''}`}
        >
          <input
            ref={fileInputRef}
            id="crop-image-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileInput}
            disabled={isLoading || isExporting}
            className="sr-only"
            aria-label="Choose an image to crop"
          />

          {!imageFile && !isLoading && (
            <label
              htmlFor="crop-image-file"
              className="tool-dropzone flex min-h-72 cursor-pointer flex-col items-center justify-center p-6 text-center transition focus-within:ring-4 focus-within:ring-indigo-100 sm:min-h-80 sm:p-9"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">
                Drop an image here to start cropping
              </span>
              <span className="mt-1 text-sm text-slate-600">or select a JPG, PNG, or WebP image from your device</span>
              <span className="tool-primary-button mt-5">
                <ImagePlus aria-hidden="true" size={17} />
                Choose image
              </span>
              <span className="mt-4 text-xs leading-5 text-slate-500">
                One image · {formatFileSize(MAX_IMAGE_SIZE_BYTES)} maximum · up to {MAX_SOURCE_PIXELS / 1_000_000} megapixels
              </span>
            </label>
          )}

          {isLoading && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-800" role="status">
              <LoaderCircle aria-hidden="true" size={25} className="animate-spin" />
              <p className="mt-3 text-sm font-medium">Loading image…</p>
            </div>
          )}

          {canEdit && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-950">{imageFile.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {imageDimensions.width} × {imageDimensions.height} px · {formatFileSize(imageFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExporting}
                  className="tool-secondary-button"
                >
                  <ImagePlus aria-hidden="true" size={16} />
                  Choose another image
                </button>
              </div>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.7fr)]">
                <div className="tool-surface min-w-0 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Crop workspace</h3>
                    <span className="text-xs text-slate-500">
                      Drag the selection to move · drag its handles to resize
                    </span>
                  </div>
                  <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2 sm:min-h-[28rem] sm:p-4">
                    <div
                      ref={workspaceRef}
                      className="relative inline-block max-h-[65vh] max-w-full touch-none select-none"
                      onPointerDown={beginNewCrop}
                      onPointerMove={updateInteraction}
                      onPointerUp={endInteraction}
                      onPointerCancel={endInteraction}
                    >
                      <canvas
                        ref={editorCanvasRef}
                        aria-label="Image being cropped"
                        className="block h-auto max-h-[65vh] max-w-full w-auto"
                      />
                      {crop && imageDimensions && (
                        <div
                          data-crop-control
                          role="group"
                          aria-label={`Crop selection ${cropWidth} by ${cropHeight} pixels`}
                          onPointerDown={(event) => beginInteraction(event, 'move')}
                          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]"
                          style={{
                            left: `${(crop.x / imageDimensions.width) * 100}%`,
                            top: `${(crop.y / imageDimensions.height) * 100}%`,
                            width: `${(crop.width / imageDimensions.width) * 100}%`,
                            height: `${(crop.height / imageDimensions.height) * 100}%`,
                          }}
                        >
                          <span className="pointer-events-none absolute inset-0 border border-indigo-500/80" />
                          <span className="pointer-events-none absolute left-1/3 top-0 h-full border-l border-white/35" />
                          <span className="pointer-events-none absolute left-2/3 top-0 h-full border-l border-white/35" />
                          <span className="pointer-events-none absolute top-1/3 left-0 w-full border-t border-white/35" />
                          <span className="pointer-events-none absolute top-2/3 left-0 w-full border-t border-white/35" />
                          {CROP_HANDLES.map(({ id, label, position, cursor }) => (
                            <button
                              key={id}
                              type="button"
                              data-crop-control
                              aria-label={`Resize crop from ${label}`}
                              onPointerDown={(event) => beginInteraction(event, 'resize', id)}
                              className={`absolute z-10 size-3.5 rounded-sm border border-indigo-700 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${position} ${cursor}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-xs text-slate-500">
                    <span>Current crop: {cropWidth} × {cropHeight} px</span>
                    <span>Source: {imageDimensions.width} × {imageDimensions.height} px</span>
                  </div>
                </div>

                <aside className="space-y-4">
                  <section aria-labelledby="crop-ratio-heading" className="tool-surface p-4 sm:p-5">
                    <h3 id="crop-ratio-heading" className="text-sm font-bold text-slate-950">Aspect ratio</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {ASPECT_PRESETS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={aspectPreset === id}
                          onClick={() => chooseAspectPreset(id)}
                          className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                            aspectPreset === id
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="crop-width" className="text-xs font-medium text-slate-700">Width (px)</label>
                        <input
                          id="crop-width"
                          type="number"
                          min="1"
                          max={imageDimensions.width}
                          step="1"
                          value={cropWidth}
                          onChange={(event) => changeCropDimension('width', event.target.value)}
                          disabled={isExporting}
                          className="tool-field mt-1.5 w-full"
                        />
                      </div>
                      <div>
                        <label htmlFor="crop-height" className="text-xs font-medium text-slate-700">Height (px)</label>
                        <input
                          id="crop-height"
                          type="number"
                          min="1"
                          max={imageDimensions.height}
                          step="1"
                          value={cropHeight}
                          onChange={(event) => changeCropDimension('height', event.target.value)}
                          disabled={isExporting}
                          className="tool-field mt-1.5 w-full"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetCrop}
                      disabled={isExporting}
                      className="tool-secondary-button mt-3 w-full"
                    >
                      <Crop aria-hidden="true" size={16} />
                      Reset crop
                    </button>
                  </section>

                  <section aria-labelledby="transform-heading" className="tool-surface p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 id="transform-heading" className="text-sm font-bold text-slate-950">Rotate and flip</h3>
                      {(rotation !== 0 || flipHorizontal || flipVertical) && (
                        <button
                          type="button"
                          onClick={resetTransforms}
                          disabled={isExporting}
                          className="text-xs font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-900"
                        >
                          Reset transforms
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => rotateImage(-90)}
                        disabled={isExporting}
                        className="tool-secondary-button w-full"
                      >
                        <RotateCcw aria-hidden="true" size={16} />
                        Rotate left
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateImage(90)}
                        disabled={isExporting}
                        className="tool-secondary-button w-full"
                      >
                        <RotateCw aria-hidden="true" size={16} />
                        Rotate right
                      </button>
                      <button
                        type="button"
                        aria-pressed={flipHorizontal}
                        onClick={toggleFlipHorizontal}
                        disabled={isExporting}
                        className="tool-secondary-button w-full"
                      >
                        <FlipHorizontal aria-hidden="true" size={16} />
                        Flip horizontal
                      </button>
                      <button
                        type="button"
                        aria-pressed={flipVertical}
                        onClick={toggleFlipVertical}
                        disabled={isExporting}
                        className="tool-secondary-button w-full"
                      >
                        <FlipVertical aria-hidden="true" size={16} />
                        Flip vertical
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Rotation and flips reset the crop area so it fits the transformed image.
                    </p>
                  </section>

                  <section aria-labelledby="crop-output-heading" className="tool-surface p-4 sm:p-5">
                    <h3 id="crop-output-heading" className="text-sm font-bold text-slate-950">Cropped output preview</h3>
                    <div className="mt-3 flex min-h-36 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-3">
                      <canvas
                        ref={outputPreviewCanvasRef}
                        aria-label="Preview of cropped output"
                        className="block max-h-56 max-w-full object-contain"
                      />
                    </div>
                    <p className="mt-2 text-center text-xs text-slate-500">
                      {cropWidth} × {cropHeight} px
                    </p>
                  </section>

                  <section aria-labelledby="download-crop-heading" className="tool-surface p-4 sm:p-5">
                    <h3 id="download-crop-heading" className="text-sm font-bold text-slate-950">Download cropped image</h3>
                    <div className="mt-3">
                      <label htmlFor="crop-output-format" className="text-xs font-medium text-slate-700">
                        Output format
                      </label>
                      <select
                        id="crop-output-format"
                        value={outputFormat}
                        onChange={changeOutputFormat}
                        disabled={isExporting}
                        className="tool-field mt-1.5 w-full"
                      >
                        {OUTPUT_FORMATS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    {outputFormat === 'image/jpeg' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor="crop-jpg-quality" className="text-xs font-medium text-slate-700">
                            JPG quality
                          </label>
                          <output htmlFor="crop-jpg-quality" className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                            {quality}%
                          </output>
                        </div>
                        <input
                          id="crop-jpg-quality"
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={quality}
                          onChange={(event) => setQuality(Number(event.target.value))}
                          disabled={isExporting}
                          className="mt-3 h-2 w-full cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={downloadCroppedImage}
                      disabled={!canEdit || isExporting}
                      className="tool-primary-button mt-4 w-full"
                    >
                      {isExporting
                        ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                        : <Download aria-hidden="true" size={17} />}
                      {isExporting ? 'Preparing image…' : `Download cropped ${outputFormat === 'image/jpeg' ? 'JPG' : 'PNG'}`}
                    </button>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {status && <div className="mt-5"><StatusMessage status={status} /></div>}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-image-cropper">
            <h2 id="about-image-cropper" className="text-2xl font-bold tracking-tight text-slate-950">
              Crop images online in your browser
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Select a crop by dragging on the image, move the selection, or resize
              it with the handles. Choose a common aspect ratio or enter an exact
              pixel width and height. Rotate or flip the image before exporting
              your crop as PNG or JPG. All image processing takes place locally
              in your browser.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              PNG output keeps the selected pixels losslessly. JPG output uses the
              quality setting and a white background for transparent source pixels.
              The cropper preserves the selected pixel dimensions and limits source
              images to {formatFileSize(MAX_IMAGE_SIZE_BYTES)} and {MAX_SOURCE_PIXELS / 1_000_000} megapixels
              to help protect browser memory. EXIF orientation is applied by the browser where supported.
            </p>
          </section>

          <section aria-labelledby="image-cropper-faq">
            <h2 id="image-cropper-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I crop an image?', 'Choose or drop a JPG, PNG, or WebP image. Drag on the image to create a crop, move the selection, or drag its handles to resize it. Then choose a format and download the result.'],
                ['Can I set a specific crop size?', 'Yes. Choose an aspect-ratio preset or enter the crop width and height in pixels. The output uses those crop dimensions.'],
                ['Can I rotate or flip my image?', 'Yes. Rotate left or right by 90 degrees, flip horizontally or vertically, then adjust the crop on the transformed image.'],
                ['What image formats can I download?', 'Download the crop as PNG or JPG. PNG preserves transparency and uses lossless encoding. JPG uses the selected quality and fills transparent areas with white.'],
                ['Are my images uploaded?', 'No. The crop selection, transforms, previews, and export run in your browser using Canvas. QuickTools does not upload your image.'],
                ['Why are there image size limits?', `Large images can use substantial browser memory. Sources are limited to ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} and ${MAX_SOURCE_PIXELS / 1_000_000} megapixels.`],
              ].map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer font-semibold text-slate-900 marker:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                    {question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
