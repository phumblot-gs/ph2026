'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  src: string
  className?: string
}

export const AudioPlayer = memo(function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioData, setAudioData] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  // Générer des données de visualisation factices mais réalistes
  const generateWaveformData = () => {
    const samples = 100
    const data: number[] = []
    
    // Créer une forme d'onde qui ressemble à de la voix
    for (let i = 0; i < samples; i++) {
      // Créer des variations avec des pics et des creux
      const baseLevel = 0.3
      const variation = Math.sin(i * 0.1) * 0.2
      const noise = (Math.random() - 0.5) * 0.3
      const spike = Math.random() > 0.8 ? Math.random() * 0.5 : 0
      
      const value = Math.max(0.1, Math.min(1, baseLevel + variation + noise + spike))
      data.push(value)
    }
    
    // Lisser les données pour un aspect plus naturel
    const smoothedData = data.map((value, index) => {
      if (index === 0 || index === data.length - 1) return value
      return (data[index - 1] + value + data[index + 1]) / 3
    })
    
    return smoothedData
  }

  // Initialiser les données de waveform
  useEffect(() => {
    setAudioData(generateWaveformData())
  }, [])


  // Dessiner la forme d'onde
  useEffect(() => {
    if (!canvasRef.current || audioData.length === 0) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Configurer le canvas
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    
    const width = rect.width
    const height = rect.height
    const barWidth = width / audioData.length
    const centerY = height / 2
    
    // Effacer le canvas
    ctx.clearRect(0, 0, width, height)
    
    // Dessiner les barres
    audioData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * height * 0.8
      const progress = currentTime / duration
      const barProgress = index / audioData.length
      
      // Couleur selon la progression
      if (barProgress <= progress) {
        ctx.fillStyle = '#3b82f6' // Bleu pour la partie jouée
      } else {
        ctx.fillStyle = '#e5e7eb' // Gris pour la partie non jouée
      }
      
      // Dessiner la barre centrée verticalement
      ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight)
    })
  }, [audioData, currentTime, duration])

  // Gérer la lecture/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  // Gestionnaires d'événements audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src) {
      setIsLoading(false)
      return
    }
    
    // Vérifier si l'URL est valide
    if (src.includes('[Message supprimé]') || src.includes('undefined') || src.includes('null')) {
      setIsLoading(false)
      setError('Message audio supprimé')
      return
    }
    
    const setAudioData = () => {
      if (isFinite(audio.duration)) {
        setDuration(audio.duration)
        setIsLoading(false)
      }
    }
    
    const setAudioTime = () => setCurrentTime(audio.currentTime)
    
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    
    const handleError = (e: Event) => {
      const audioElement = e.target as HTMLAudioElement
      let errorMessage = 'Erreur inconnue'
      
      // Déterminer le type d'erreur
      if (audioElement.error) {
        switch (audioElement.error.code) {
          case audioElement.error.MEDIA_ERR_ABORTED:
            errorMessage = 'Chargement annulé'
            break
          case audioElement.error.MEDIA_ERR_NETWORK:
            errorMessage = 'Erreur réseau'
            break
          case audioElement.error.MEDIA_ERR_DECODE:
            errorMessage = 'Erreur de décodage'
            break
          case audioElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Format non supporté'
            break
        }
      } else {
      }
      
      // Retry logic seulement pour les erreurs réseau
      if (retryCount < maxRetries && audioElement.error?.code === audioElement.error.MEDIA_ERR_NETWORK) {
        setRetryCount(prev => prev + 1)
        
        // Attendre un peu avant de réessayer
        setTimeout(() => {
          if (audio) {
            audio.load()
          }
        }, 1000 * (retryCount + 1)) // Délai progressif
      } else {
        setError(`Impossible de charger le fichier audio: ${errorMessage}`)
        setIsLoading(false)
      }
    }
    
    const handleCanPlay = () => {
      setIsLoading(false)
      setError(null)
      setRetryCount(0)
    }
    
    // Forcer le rechargement de l'audio quand l'URL change
    setIsLoading(true)
    setError(null)
    
    // Attendre un peu avant de charger pour s'assurer que l'URL est prête
    const loadTimeout = setTimeout(() => {
      audio.load()
    }, 100)
    
    audio.addEventListener('loadedmetadata', setAudioData)
    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', setAudioTime)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    
    return () => {
      clearTimeout(loadTimeout)
      audio.removeEventListener('loadedmetadata', setAudioData)
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('timeupdate', setAudioTime)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [src, retryCount])

  // Changer la position de lecture
  const handleSeek = (value: number[]) => {
    const newTime = (value[0] / 100) * duration
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
    setCurrentTime(newTime)
  }

  // Formater le temps en mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }


  // Afficher l'erreur si elle existe
  if (error && retryCount >= maxRetries) {
    return (
      <div className={cn('flex items-center gap-3 p-3 bg-red-50 rounded-lg text-red-600 text-sm', className)}>
        <span>⚠️ {error}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setRetryCount(0)
            setError(null)
            setIsLoading(true)
            if (audioRef.current) {
              audioRef.current.load()
            }
          }}
        >
          Réessayer
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 bg-gray-50 rounded-lg', className)}>
      {/* Bouton Play/Pause */}
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        disabled={isLoading}
        className="h-10 w-10 rounded-full bg-white hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      {/* Zone de visualisation et slider */}
      <div className="flex-1 relative">
        {/* Canvas pour la forme d'onde */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-8 pointer-events-none"
          style={{ height: '32px' }}
        />
        
        {/* Slider de progression */}
        <div className="relative h-8 flex items-center">
          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>

      {/* Durée */}
      <div className="text-sm text-gray-600 min-w-[45px]">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      {/* Élément audio caché */}
      <audio 
        ref={audioRef} 
        src={src} 
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  )
})