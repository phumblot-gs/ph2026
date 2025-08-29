'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  File, 
  Download,
  Eye,
  X,
  Loader2,
  FileSpreadsheet,
  FileImage,
  Presentation
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface FileAttachment {
  id?: string
  name: string
  mimetype: string
  url_private?: string
  url_private_download?: string
  permalink?: string
  title?: string
  filetype?: string
  size?: number
  file?: File // Pour les fichiers locaux avant upload
  preview?: string // Pour les previews d'images locales
}

interface FilePreviewProps {
  file: FileAttachment
  onRemove?: () => void
  isLocal?: boolean
  className?: string
}

export function FilePreview({ file, onRemove, isLocal = false, className }: FilePreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  
  // Détecter si c'est un fichier temporaire (en cours d'upload)
  const isTemporary = file.id?.startsWith('temp-')
  
  // Create preview URL for local files
  useEffect(() => {
    if (isLocal && file.file && file.file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file.file)
      setPreviewUrl(url)
      return () => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      }
    }
  }, [isLocal, file.file])
  
  const getFileIcon = () => {
    const type = file.mimetype || file.filetype || ''
    const name = file.name || ''
    
    // Images
    if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return <ImageIcon className="h-5 w-5" />
    }
    
    // Vidéos
    if (type.startsWith('video/') || name.match(/\.(mp4|avi|mov|webm|mkv)$/i)) {
      return <Film className="h-5 w-5" />
    }
    
    // Audio
    if (type.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return <Music className="h-5 w-5" />
    }
    
    // Documents
    if (type.includes('pdf') || name.match(/\.pdf$/i)) {
      return <FileText className="h-5 w-5 text-red-600" />
    }
    
    if (type.includes('word') || name.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-5 w-5 text-blue-600" />
    }
    
    if (type.includes('sheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/i)) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />
    }
    
    if (type.includes('photoshop') || name.match(/\.(psd|ai|sketch|fig)$/i)) {
      return <FileImage className="h-5 w-5 text-purple-600" />
    }
    
    // Défaut
    return <File className="h-5 w-5" />
  }
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    // Utiliser un espace insécable (non-breaking space) entre la valeur et l'unité
    return `${(bytes / Math.pow(1024, i)).toFixed(1)}\u00A0${sizes[i]}`
  }
  
  const canPreview = () => {
    const type = file.mimetype || ''
    const name = file.name || ''
    return (
      type.startsWith('image/') || 
      name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
      type.includes('pdf')
    )
  }
  
  const getPreviewUrl = () => {
    if (isLocal && previewUrl) {
      return previewUrl
    }
    if (file.url_private_download || file.url_private) {
      return `/api/slack/proxy-file?url=${encodeURIComponent(file.url_private_download || file.url_private || '')}`
    }
    // Pour les fichiers temporaires (en cours d'upload), pas d'URL disponible
    return null
  }
  
  const handleDownload = async () => {
    if (isLocal && file.file) {
      // Télécharger le fichier local
      const url = URL.createObjectURL(file.file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (file.url_private_download || file.url_private) {
      // Télécharger depuis Slack
      const url = `/api/slack/proxy-file?url=${encodeURIComponent(file.url_private_download || file.url_private || '')}`
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }
  
  const isImage = file.mimetype?.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  const isPDF = file.mimetype === 'application/pdf' || file.name?.match(/\.pdf$/i)
  const isOffice = file.mimetype?.match(/officedocument/) || file.name?.match(/\.(docx?|xlsx?|pptx?)$/i)
  
  return (
    <div className={cn(
      "inline-block relative",
      className
    )}>
      {/* Indicateur de chargement pour les fichiers temporaires */}
      {isTemporary && (
        <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            <span className="text-sm text-gray-500">Envoi en cours...</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 p-3 bg-white border rounded-lg">
        {/* Première ligne : icône, nom, taille et boutons */}
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            {getFileIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-medium truncate">{file.title || file.name}</p>
              {file.size && (
                <span className="text-xs text-gray-500 whitespace-nowrap">{formatFileSize(file.size)}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
          {canPreview() && !isLocal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowPreview(true)}
              title="Aperçu"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          
          {!isLocal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownload}
              title="Télécharger"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              onClick={onRemove}
              title="Supprimer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          </div>
        </div>
        
        {/* Aperçu sous la première ligne */}
        {isImage && !imageError && getPreviewUrl() && (
          <div className="relative rounded overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" 
               style={{ width: 'min(100%, 400px)' }}
               onClick={() => setShowPreview(true)}>
            <img
              src={getPreviewUrl() || ''}
              alt={file.name}
              className="w-full h-auto object-contain"
              style={{ maxHeight: '300px' }}
              onError={() => {
                setImageError(true)
              }}
            />
          </div>
        )}
        
        {/* Aperçu PDF */}
        {isPDF && !isLocal && getPreviewUrl() && (
          <div className="relative rounded overflow-hidden bg-gray-100 border border-gray-200" 
               style={{ width: 'min(100%, 400px)', height: '300px' }}>
            <iframe
              src={`${getPreviewUrl()}#view=FitH&navpanes=0&toolbar=0&statusbar=0&messages=0&scrollbar=0`}
              className="w-full h-full"
              title={file.name}
            />
            <div 
              className="absolute inset-0 cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowPreview(true)}
              title="Cliquer pour agrandir"
            />
          </div>
        )}
        
        {/* Aperçu Office - Affichage d'une miniature générique */}
        {isOffice && !isLocal && (
          <div className="relative rounded overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity p-8 flex flex-col items-center justify-center" 
               style={{ width: 'min(100%, 400px)', height: '200px' }}
               onClick={handleDownload}>
            <div className="text-blue-600 mb-3">
              {file.name?.match(/\.docx?$/i) && <FileText className="h-16 w-16" />}
              {file.name?.match(/\.xlsx?$/i) && <FileSpreadsheet className="h-16 w-16" />}
              {file.name?.match(/\.pptx?$/i) && <Presentation className="h-16 w-16" />}
            </div>
            <p className="text-sm text-gray-600 text-center">
              {file.name?.match(/\.docx?$/i) && "Document Word"}
              {file.name?.match(/\.xlsx?$/i) && "Feuille de calcul Excel"}
              {file.name?.match(/\.pptx?$/i) && "Présentation PowerPoint"}
            </p>
            <p className="text-xs text-gray-500 mt-2">Cliquer pour télécharger</p>
          </div>
        )}
      </div>
      
      {/* Modal d'aperçu */}
      {showPreview && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className={cn(
              "relative max-h-[90vh] bg-white rounded-lg overflow-hidden",
              isPDF ? "w-[75vw] max-w-[1000px]" : "max-w-4xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-medium">{file.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreview(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              {file.mimetype?.startsWith('image/') && !imageError && getPreviewUrl() ? (
                <img
                  src={getPreviewUrl() || ''}
                  alt={file.name}
                  className="max-w-full h-auto"
                  onError={() => setImageError(true)}
                />
              ) : file.mimetype?.includes('pdf') && getPreviewUrl() ? (
                <iframe
                  src={`${getPreviewUrl()}#view=FitH&navpanes=0&toolbar=0`}
                  className="w-full h-[70vh]"
                  title={file.name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  {getFileIcon()}
                  <p className="mt-4 text-gray-500">Aperçu non disponible</p>
                  <Button
                    className="mt-4"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger le fichier
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface FileListProps {
  files: FileAttachment[]
  onRemove?: (index: number) => void
  isLocal?: boolean
  className?: string
}

export function FileList({ files, onRemove, isLocal = false, className }: FileListProps) {
  if (!files || files.length === 0) return null
  
  return (
    <div className={cn("space-y-2", className)}>
      {files.map((file, index) => (
        <FilePreview
          key={file.id || index}
          file={file}
          onRemove={onRemove ? () => onRemove(index) : undefined}
          isLocal={isLocal}
        />
      ))}
    </div>
  )
}