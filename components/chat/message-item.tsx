'use client'

import React from 'react'
import { ChatMessage } from '@/hooks/use-native-chat'
import { AudioPlayer } from './audio-player'

interface MessageItemProps {
  message: ChatMessage
  renderMessage: (message: ChatMessage, isReply: boolean, showHeader: boolean) => React.ReactNode
  isReply?: boolean
  showHeader?: boolean
  isEditing?: boolean
}

// Composant mémorisé pour éviter les re-rendus inutiles
export const MessageItem = React.memo(function MessageItem({ 
  message, 
  renderMessage, 
  isReply = false, 
  showHeader = false,
  isEditing = false 
}: MessageItemProps) {
  return <>{renderMessage(message, isReply, showHeader)}</>
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour éviter les re-rendus
  // Ne re-rendre que si le message a changé ou si on est en mode édition
  
  // Comparer les réactions en profondeur
  const reactionsEqual = JSON.stringify(prevProps.message.reactions) === JSON.stringify(nextProps.message.reactions)
  
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.deleted_at === nextProps.message.deleted_at &&
    prevProps.message.edited_at === nextProps.message.edited_at &&
    prevProps.message.files?.length === nextProps.message.files?.length &&
    reactionsEqual &&
    prevProps.isReply === nextProps.isReply &&
    prevProps.showHeader === nextProps.showHeader &&
    prevProps.isEditing === nextProps.isEditing
  )
})