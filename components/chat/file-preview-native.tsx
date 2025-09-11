'use client'

import { useState } from 'react'
import { 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  File, 
  Download,
  Eye,
  X,
  FileSpreadsheet,
  FileCode,
  Presentation,
  Archive,
  FileVideo
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileData {
  id: string
  name: string
  original_name?: string
  mimetype: string
  size: number
  storage_path: string
  width?: number | null
  height?: number | null
}

interface FilePreviewNativeProps {
  file: FileData
  className?: string
}

export function FilePreviewNative({ file, className }: FilePreviewNativeProps) {
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  const fileName = file.original_name || file.name
  const fileUrl = `/api/chat/upload?path=${file.storage_path}`
  const directUrl = `/api/chat/upload?path=${file.storage_path}&direct=true`
  
  const getFileIcon = () => {
    const type = file.mimetype || ''
    const name = fileName || ''
    
    // Images
    if (type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    
    // Vidéos
    if (type.startsWith('video/')) {
      return <FileVideo className="h-5 w-5 text-purple-500" />
    }
    
    // Audio
    if (type.startsWith('audio/')) {
      return <Music className="h-5 w-5 text-green-500" />
    }
    
    // PDF
    if (type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-600" />
    }
    
    // Documents Word
    if (type.includes('word') || type.includes('document') || name.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-5 w-5 text-blue-600" />
    }
    
    // Feuilles de calcul
    if (type.includes('sheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/i)) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />
    }
    
    // Présentations
    if (type.includes('presentation') || type.includes('powerpoint') || name.match(/\.(ppt|pptx)$/i)) {
      return <Presentation className="h-5 w-5 text-orange-600" />
    }
    
    // Archives
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || name.match(/\.(zip|rar|tar|gz|7z)$/i)) {
      return <Archive className="h-5 w-5 text-gray-600" />
    }
    
    // Code
    if (name.match(/\.(js|jsx|ts|tsx|py|java|c|cpp|cs|php|rb|go|rs|swift|kt)$/i)) {
      return <FileCode className="h-5 w-5 text-gray-700" />
    }
    
    // Défaut
    return <File className="h-5 w-5 text-gray-500" />
  }
  
  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }
  
  const getFileTypeLabel = () => {
    const type = file.mimetype || ''
    const name = fileName || ''
    const extension = name.toLowerCase().split('.').pop() || ''
    
    if (type.startsWith('image/')) return 'Image'
    if (type.startsWith('video/')) return 'Vidéo'
    if (type.startsWith('audio/')) return 'Audio'
    if (type === 'application/pdf') return 'PDF'
    if (type.includes('word') || name.match(/\.docx?$/i)) return 'Document'
    if (type.includes('sheet') || type.includes('excel') || name.match(/\.xlsx?$/i)) return 'Tableur'
    if (type.includes('presentation') || name.match(/\.pptx?$/i)) return 'Présentation'
    if (type.includes('zip') || name.match(/\.(zip|rar|tar|gz)$/i)) return 'Archive'
    if (name.match(/\.(js|jsx|ts|tsx|py|java|c|cpp|cs|php|rb|go|rs|swift|kt)$/i)) return 'Code'
    
    // Pour les fichiers non reconnus, afficher l'extension en majuscules
    return extension ? extension.toUpperCase() : 'Fichier'
  }
  
  // Détection améliorée des types de fichiers
  const fileExtension = fileName?.toLowerCase().split('.').pop() || ''
  
  const isImage = !!(
    file.mimetype?.startsWith('image/') ||
    file.mimetype === 'application/octet-stream' && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif'].includes(fileExtension) ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif'].includes(fileExtension)
  )
  
  const isPDF = file.mimetype === 'application/pdf' || fileExtension === 'pdf'
  
  const isVideo = !!(
    file.mimetype?.startsWith('video/') ||
    ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', 'mpg', 'mpeg', '3gp'].includes(fileExtension)
  )
  
  const isOfficeDoc = !!(
    file.mimetype?.match(/officedocument|msword|ms-excel|ms-powerpoint/) ||
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)
  )
  
  // Pour les images
  if (isImage) {
    return (
      <div className={cn("mt-2", className)}>
        <div className="inline-block" style={{ maxWidth: '70%' }}>
          {/* Affichage direct de l'image avec infos en dessous */}
          <div 
            className="cursor-pointer group"
            onClick={() => setShowFullPreview(true)}
          >
            {/* Image avec bordure */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-gray-300 transition-colors relative">
              {/* Fallback si erreur */}
              {imageError ? (
                <div className="bg-gray-50 p-8 flex flex-col items-center justify-center" style={{ minHeight: '200px' }}>
                  <ImageIcon className="h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-1">Aperçu non disponible</p>
                  <p className="text-[10px] text-gray-400 mt-2">{formatFileSize(file.size)}</p>
                </div>
              ) : (
                <img
                  src={directUrl}
                  alt={fileName}
                  className="w-full h-auto object-contain bg-gray-50"
                  style={{ maxHeight: '400px' }}
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
            
            {/* Infos sous l'image */}
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              <span className="font-medium text-gray-700 group-hover:text-blue-600 truncate">
                {fileName}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 whitespace-nowrap">
                {formatFileSize(file.size)}
              </span>
              {file.width && file.height && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {file.width}×{file.height}
                  </span>
                </>
              )}
              <button
                className="ml-auto text-gray-400 hover:text-gray-600 p-1"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullPreview(true)
                }}
                title="Agrandir"
              >
                <Eye className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Modal plein écran pour l'image */}
        {showFullPreview && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullPreview(false)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <img
                src={directUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullPreview(false)
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  // Pour les PDF
  if (isPDF) {
    return (
      <div className={cn("mt-2", className)}>
        <div className="inline-block" style={{ maxWidth: '70%' }}>
          {/* Aperçu du PDF avec embed */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Header avec infos du fichier */}
            <div className="flex items-center gap-3 p-3 border-b bg-gray-50">
              <div className="flex-shrink-0">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {fileName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowFullPreview(true)}
                  title="Agrandir"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(directUrl, '_blank')}
                  title="Télécharger"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Aperçu du PDF */}
            <div 
              className="relative bg-gray-50 cursor-pointer hover:opacity-95 transition-opacity"
              style={{ height: '400px' }}
              onClick={() => setShowFullPreview(true)}
            >
              <embed
                src={`${directUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                type="application/pdf"
                className="w-full h-full"
                title={fileName}
              />
              {/* Overlay pour empêcher l'interaction directe avec le PDF */}
              <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} />
            </div>
          </div>
        </div>
        
        {/* Modal plein écran pour le PDF */}
        {showFullPreview && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="relative w-[90vw] h-[90vh] bg-white rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-medium">{fileName}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(directUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFullPreview(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <embed
                src={directUrl}
                type="application/pdf"
                className="w-full h-[calc(100%-60px)]"
                title={fileName}
              />
            </div>
          </div>
        )}
      </div>
    )
  }
  
  // Pour les vidéos
  if (isVideo) {
    return (
      <div className={cn("mt-2", className)}>
        <div className="inline-block" style={{ maxWidth: '70%' }}>
          <div className="border border-gray-300 rounded-lg overflow-hidden bg-black">
            <video
              controls
              className="w-full h-auto"
              style={{ maxHeight: '400px' }}
              preload="metadata"
            >
              <source src={directUrl} type={file.mimetype} />
              Votre navigateur ne supporte pas la lecture de vidéos.
            </video>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xs font-medium text-gray-700">
              {fileName}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      </div>
    )
  }
  
  // Pour tous les autres fichiers
  return (
    <div className={cn("mt-2 inline-block", className)} style={{ maxWidth: '70%' }}>
      <div className="flex items-start gap-3 p-3 bg-[#f9f9f9] rounded-lg border border-gray-300 hover:border-gray-400 transition-colors">
        <div className="flex-shrink-0 w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center">
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#1d1c1d] hover:text-blue-600 hover:underline block truncate"
          >
            {fileName}
          </a>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-500">{getFileTypeLabel()}</span>
            <span className="text-[11px] text-gray-400">•</span>
            <span className="text-[11px] text-gray-400">
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}