'use client'

import React from 'react'
import { ChatMessage } from '@/types/chat'
import { AudioPlayer } from './audio-player'

interface MessageItemProps {
  message: ChatMessage
  renderMessage: (message: ChatMessage, isReply: boolean, showHeader: boolean) => React.ReactNode
  isReply?: boolean
  showHeader?: boolean
}

// Composant mémorisé pour éviter les re-rendus inutiles
export const MessageItem = React.memo(function MessageItem({ 
  message, 
  renderMessage, 
  isReply = false, 
  showHeader = false 
}: MessageItemProps) {
  return <>{renderMessage(message, isReply, showHeader)}</>
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour éviter les re-rendus
  // Ne re-rendre que si le message a changé
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.deleted_at === nextProps.message.deleted_at &&
    prevProps.message.edited_at === nextProps.message.edited_at &&
    prevProps.message.files?.length === nextProps.message.files?.length &&
    prevProps.message.reactions?.length === nextProps.message.reactions?.length &&
    prevProps.isReply === nextProps.isReply &&
    prevProps.showHeader === nextProps.showHeader
  )
})