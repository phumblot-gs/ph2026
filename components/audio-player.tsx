'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  url: string
  className?: string
}

export function AudioPlayer({ url, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const setAudioData = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }
    
    const setAudioTime = () => setCurrentTime(audio.currentTime)
    
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    
    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('timeupdate', setAudioTime)
    audio.addEventListener('ended', handleEnded)
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('timeupdate', setAudioTime)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])
  
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }
  
  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    
    const newTime = value[0]
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }
  
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  return (
    <div className={cn(
      "flex items-center gap-2.5 p-2.5 bg-white rounded-lg border shadow-sm",
      className
    )}>
      <audio ref={audioRef} src={url} preload="metadata" />
      
      {/* Play/Pause button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-full bg-green-500 hover:bg-green-600 text-white"
        onClick={togglePlayPause}
        disabled={isLoading}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>
      
      {/* Waveform/Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <Volume2 className="h-3.5 w-3.5 text-gray-400" />
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSliderChange}
          className="flex-1 h-1"
          disabled={isLoading}
        />
      </div>
      
      {/* Time display */}
      <div className="text-xs text-gray-600 font-mono min-w-[40px] text-right">
        {isPlaying || currentTime > 0 
          ? formatTime(currentTime)
          : formatTime(duration)}
      </div>
    </div>
  )
}