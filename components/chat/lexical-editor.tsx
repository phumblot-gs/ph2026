'use client'

import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { $getRoot, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, COMMAND_PRIORITY_LOW, KEY_ENTER_COMMAND, $createParagraphNode, CLEAR_EDITOR_COMMAND, $createLineBreakNode } from 'lexical'
import { 
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  ListItemNode,
} from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { 
  $convertToMarkdownString,
  $convertFromMarkdownString
} from '@lexical/markdown'
import { 
  LexicalComposer,
  InitialConfigType
} from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { mergeRegister } from '@lexical/utils'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { LinkNode } from '@lexical/link'
import { Button } from '@/components/ui/button'
import { Bold, Italic, Strikethrough, Link, Type, Smile, Mic, StopCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { cn } from '@/lib/utils'

// Import des transformateurs spécifiques
import { 
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  LINK,
  UNORDERED_LIST,
  ORDERED_LIST
} from '@lexical/markdown'

// Transformateurs Slack personnalisés
const SLACK_TRANSFORMERS = [
  BOLD_STAR,           // *text* pour gras
  ITALIC_UNDERSCORE,   // _text_ pour italique
  STRIKETHROUGH,       // ~text~ pour barré
  LINK,               // [text](url) pour les liens
  UNORDERED_LIST,     // - ou * pour listes à puces
  ORDERED_LIST        // 1. pour listes numérotées
]

// Plugin pour gérer l'envoi avec Enter
function EnterKeyPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        // Permettre Enter normal dans les listes
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode()
          const parentNode = anchorNode.getParent()
          
          // Si on est dans une liste, permettre Enter pour créer un nouvel item
          if ($isListNode(parentNode?.getParent?.())) {
            return false // Laisser le comportement par défaut
          }
        }
        
        // Shift+Enter insère un saut de ligne
        if (event?.shiftKey) {
          event.preventDefault()
          editor.update(() => {
            const selection = $getSelection()
            if ($isRangeSelection(selection)) {
              // Insérer un saut de ligne
              const lineBreak = $createLineBreakNode()
              selection.insertNodes([lineBreak])
            }
          })
          return true
        }
        
        // Enter simple envoie le message
        event.preventDefault()
        onSubmit()
        // Réinitialiser l'éditeur après l'envoi
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, onSubmit])

  return null
}

// Plugin pour réinitialiser l'éditeur
function ClearEditorPlugin({ shouldClear }: { shouldClear: boolean }) {
  const [editor] = useLexicalComposerContext()
  
  useEffect(() => {
    if (shouldClear) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        const paragraph = $createParagraphNode()
        root.append(paragraph)
        paragraph.select()
      })
    }
  }, [editor, shouldClear])
  
  return null
}

// Barre d'outils de formatage
function ToolbarPlugin({ 
  showEmojiPicker, 
  setShowEmojiPicker,
  onEmojiClick,
  isRecording,
  onStartRecording,
  onStopRecording
}: {
  showEmojiPicker: boolean
  setShowEmojiPicker: (show: boolean) => void
  onEmojiClick: (emoji: string) => void
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
}) {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isLink, setIsLink] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      
      // Vérifier si c'est un lien
      const node = selection.anchor.getNode()
      const parent = node.getParent()
      setIsLink($isLinkNode(parent) || $isLinkNode(node))
    }
  }, [])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
      editor.registerCommand(
        FORMAT_TEXT_COMMAND,
        () => {
          updateToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, updateToolbar])

  const insertLink = () => {
    const url = prompt('Entrez l\'URL:')
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
    }
  }

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    onEmojiClick(emojiData.emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div className="flex items-center gap-1 p-2 border-b">
      {/* Boutons de formatage */}
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", isBold && "bg-gray-200")}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Gras (Cmd/Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", isItalic && "bg-gray-200")}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italique (Cmd/Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", isStrikethrough && "bg-gray-200")}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        title="Barré"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-5 bg-gray-300 mx-1" />
      
      {/* Lien */}
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", isLink && "bg-gray-200")}
        onClick={insertLink}
        title="Insérer un lien (Cmd/Ctrl+K)"
      >
        <Link className="h-4 w-4" />
      </Button>
      
      <div className="flex-1" />
      
      {/* Emoji */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Ajouter un emoji"
            disabled={isRecording}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" side="top">
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            width={350}
            height={400}
            searchDisabled={false}
            lazyLoadEmojis={true}
            previewConfig={{ showPreview: false }}
          />
        </PopoverContent>
      </Popover>
      
      {/* Enregistrement vocal */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={isRecording ? onStopRecording : onStartRecording}
        title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
      >
        {isRecording ? (
          <StopCircle className="h-4 w-4 text-red-500" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

// Import pour useState
import { useState } from 'react'

interface LexicalEditorProps {
  value: string
  onChange: (markdown: string) => void
  onSubmit: () => void
  onReset?: () => void
  placeholder?: string
  disabled?: boolean
  showEmojiPicker: boolean
  setShowEmojiPicker: (show: boolean) => void
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  className?: string
  initialValue?: string
}

export const LexicalEditor = forwardRef<any, LexicalEditorProps>(({
  value,
  onChange,
  onSubmit,
  onReset,
  placeholder = "Tapez votre message...",
  disabled = false,
  showEmojiPicker,
  setShowEmojiPicker,
  isRecording,
  onStartRecording,
  onStopRecording,
  className,
  initialValue
}, ref) => {
  console.log('📝 LexicalEditor - initialValue:', initialValue)
  console.log('📝 LexicalEditor - value:', value)
  
  const editorRef = useRef<HTMLDivElement>(null)
  const [showToolbar, setShowToolbar] = useState(false)
  const [shouldClear, setShouldClear] = useState(false)
  
  // Exposer la méthode focus via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editorRef.current) {
        // L'élément editorRef.current EST le contentEditable lui-même
        const contentEditable = editorRef.current
        if (contentEditable && contentEditable.getAttribute('contenteditable') === 'true') {
          contentEditable.focus()
          
          // Placer le curseur à la fin du contenu
          const selection = window.getSelection()
          const range = document.createRange()
          
          if (selection && contentEditable.lastChild) {
            // Si il y a du contenu, placer le curseur à la fin
            range.selectNodeContents(contentEditable)
            range.collapse(false) // false = collapse à la fin
            selection.removeAllRanges()
            selection.addRange(range)
          } else if (selection) {
            // Si pas de contenu, juste placer le curseur au début
            range.setStart(contentEditable, 0)
            range.setEnd(contentEditable, 0)
            selection.removeAllRanges()
            selection.addRange(range)
          }
          
          // Forcer le focus avec un timeout au cas où
          setTimeout(() => {
            contentEditable.focus()
            // Répéter le placement du curseur après le timeout
            const selection = window.getSelection()
            const range = document.createRange()
            if (selection && contentEditable.lastChild) {
              range.selectNodeContents(contentEditable)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }, 0)
        }
      }
    }
  }), [])
  
  // Réinitialiser quand value devient vide (après envoi du message)
  useEffect(() => {
    if (value === '') {
      setShouldClear(true)
      setShowToolbar(false) // Masquer la barre d'outils après l'envoi
      setTimeout(() => setShouldClear(false), 100)
    }
  }, [value])

  // Utiliser useEffect pour l'initialisation au lieu de initialConfig.editorState
  useEffect(() => {
    if (initialValue && initialValue.trim()) {
      console.log('🚀 useEffect - Initializing editor with:', initialValue)
      // Attendre que l'éditeur soit monté
      setTimeout(() => {
        if (editorRef.current) {
          try {
            const contentEditable = editorRef.current
            if (contentEditable && contentEditable.textContent === '') {
              console.log('📄 Setting textContent directly')
              contentEditable.textContent = initialValue
            }
          } catch (error) {
            console.log('Erreur initialisation:', error)
          }
        }
      }, 100)
    }
  }, [initialValue])

  const initialConfig: InitialConfigType = {
    namespace: 'ChatEditor',
    theme: {
      text: {
        bold: 'font-bold',
        italic: 'italic',
        strikethrough: 'line-through',
      },
      link: 'text-blue-600 hover:underline cursor-pointer',
      list: {
        nested: {
          listitem: 'list-none'
        },
        ol: 'list-decimal list-inside',
        ul: 'list-disc list-inside',
        listitem: 'ml-4'
      }
    },
    onError: (error: Error) => {
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    editable: !disabled && !isRecording
  }

  const handleChange = (editorState: any, editor: any) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(SLACK_TRANSFORMERS)
      onChange(markdown)
    })
  }

  const handleEmojiClick = (emoji: string) => {
    // Insérer l'emoji dans l'éditeur
    const editor = (editorRef.current as any)?.__lexicalEditor
    if (editor) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          selection.insertText(emoji)
        }
      })
    }
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        {showToolbar && (
          <ToolbarPlugin 
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            onEmojiClick={handleEmojiClick}
            isRecording={isRecording}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
          />
        )}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                ref={editorRef}
                className="min-h-[36px] max-h-[240px] overflow-y-auto px-2 py-1.5 focus:outline-none text-sm"
                aria-placeholder={placeholder}
                placeholder={<div className="text-gray-400 absolute top-1.5 left-2 pointer-events-none text-sm">{placeholder}</div>}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={SLACK_TRANSFORMERS} />
            <OnChangePlugin onChange={handleChange} />
            <EnterKeyPlugin onSubmit={onSubmit} />
            <ClearEditorPlugin shouldClear={shouldClear} />
            
            {/* Boutons flottants */}
            <div className="absolute right-2 bottom-1 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-500 hover:text-gray-700"
                onClick={() => setShowToolbar(!showToolbar)}
                title="Formatage du texte"
                type="button"
              >
                <Type className="h-4 w-4" />
              </Button>
              
              {!showToolbar && (
                <>
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-500 hover:text-gray-700"
                        title="Ajouter un emoji"
                        disabled={isRecording}
                        type="button"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end" side="top">
                      <EmojiPicker
                        onEmojiClick={(emojiData: EmojiClickData) => {
                          handleEmojiClick(emojiData.emoji)
                        }}
                        width={350}
                        height={400}
                        searchDisabled={false}
                        lazyLoadEmojis={true}
                        previewConfig={{ showPreview: false }}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-gray-700"
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
                    type="button"
                  >
                    {isRecording ? (
                      <StopCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
      </LexicalComposer>
    </div>
  )
})

LexicalEditor.displayName = 'LexicalEditor'