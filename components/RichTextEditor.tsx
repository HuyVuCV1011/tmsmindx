'use client'

import { mergeAttributes, type Editor as TiptapEditor } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { NodeSelection } from '@tiptap/pm/state'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Image as ImageIcon,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo,
    Trash2,
    Underline as UnderlineIcon,
    Undo
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  error?: string
  textColor?: string
  showToolbar?: boolean
}

function ResizableImageNodeView(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor, getPos } = props

  const currentWidth = typeof node.attrs.width === 'number' ? node.attrs.width : null

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos === 'number') {
        editor?.commands?.setNodeSelection?.(pos)
      }
    } catch {
      // ignore
    }
  }

  const onPointerDownHandle = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const img = (e.currentTarget.parentElement?.querySelector('img') as HTMLImageElement | null)
    if (!img) return

    const rect = img.getBoundingClientRect()
    const startX = e.clientX
    const startWidth = rect.width
    const startHeight = rect.height || 1
    const aspectRatio = startWidth / startHeight

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const commitWidth = (width: number) => {
      const clamped = Math.max(60, Math.min(1400, Math.round(width)))
      updateAttributes({ width: clamped })
    }

    const onMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX
      let nextWidth = startWidth

      if (corner === 'se' || corner === 'ne') nextWidth = startWidth + deltaX
      else nextWidth = startWidth - deltaX

      // keep aspect ratio
      const width = nextWidth
      const height = width / aspectRatio
      if (width < 60 || width > 1400 || height < 30) return

      pendingWidth = width
      if (rafId != null) return

      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (pendingWidth != null) commitWidth(pendingWidth)
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (rafId != null) window.cancelAnimationFrame(rafId)
      rafId = null
      if (pendingWidth != null) commitWidth(pendingWidth)
    }

    // Ensure the node is selected before resizing
    try {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos === 'number') editor?.commands?.setNodeSelection?.(pos)
    } catch {
      // ignore
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { passive: true })
  }

  return (
    <NodeViewWrapper
      className={`image-wrapper ${selected ? 'image-wrapper-selected' : ''}`}
      style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        title={node.attrs.title || ''}
        className="tiptap-image"
        draggable={false}
        style={{
          width: currentWidth ? `${currentWidth}px` : undefined,
          height: 'auto',
          maxWidth: '100%'
        }}
      />

      {selected && (
        <>
          <div className="resize-handle resize-nw" onPointerDown={onPointerDownHandle('nw')} />
          <div className="resize-handle resize-ne" onPointerDown={onPointerDownHandle('ne')} />
          <div className="resize-handle resize-sw" onPointerDown={onPointerDownHandle('sw')} />
          <div className="resize-handle resize-se" onPointerDown={onPointerDownHandle('se')} />
        </>
      )}
    </NodeViewWrapper>
  )
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: {
        default: null,
        parseHTML: (element) => {
          const data = element.getAttribute('data-width')
          if (data) {
            const n = Number(data)
            return Number.isFinite(n) ? n : null
          }
          const styleWidth = (element as HTMLElement).style?.width
          if (styleWidth?.endsWith('px')) {
            const n = Number(styleWidth.replace('px', ''))
            return Number.isFinite(n) ? n : null
          }
          return null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          const width = Number(attributes.width)
          if (!Number.isFinite(width)) return {}
          return {
            'data-width': String(Math.round(width)),
            style: `width: ${Math.round(width)}px; height: auto;`
          }
        }
      }
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView)
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  }
})

export default function RichTextEditor({
  content,
  onChange,
  error,
  textColor = '#000000',
  showToolbar = true
}: RichTextEditorProps) {
  const [selectedImageWidth, setSelectedImageWidth] = useState<string>('100%')
  const [showImageControls, setShowImageControls] = useState(false)
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'tiptap-image'
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline hover:text-blue-700'
        }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      TextStyle,
      Color
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[300px] px-4 py-3 ${
          error ? 'border-red-500' : ''
        }`
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }: { editor: TiptapEditor }) => {
      const selection = editor.state.selection
      if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
        setShowImageControls(true)
        const w = selection.node.attrs.width
        if (typeof w === 'number' && Number.isFinite(w)) setSelectedImageWidth(`${Math.round(w)}px`)
        else setSelectedImageWidth('auto')
      } else {
        setShowImageControls(false)
      }
    }
  })

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined && content !== null) {
      // Only update if content actually changed to avoid unnecessary updates
      const currentContent = editor.getHTML()
      if (currentContent !== content) {
        editor.commands.setContent(content)
      }
    }
  }, [content, editor])

  // When the HTML content is set from outside, selection state should reset.
  useEffect(() => {
    setShowImageControls(false)
  }, [content])

  const uploadImage = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !editor) return

      try {
        // Upload to server
        const formData = new FormData()
        formData.append('image', file)

        const res = await fetch('/api/upload-thumbnail', {
          method: 'POST',
          body: formData
        })

        if (!res.ok) throw new Error('Upload failed')

        const data = await res.json()
        editor.chain().focus().setImage({ src: data.url }).run()
      } catch (error) {
        console.error('Image upload error:', error)
        alert('Không thể tải lên hình ảnh. Vui lòng thử lại.')
      }
    }

    input.click()
  }, [editor])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Nhập URL:', previousUrl)

    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const deleteImage = useCallback(() => {
    if (!editor) return
    editor.chain().focus().deleteSelection().run()
    setShowImageControls(false)
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className={`overflow-hidden ${error ? 'border-red-500 shadow-sm shadow-red-100' : ''}`}>
      {/* Image Controls */}
      {showImageControls && (
        <div className="image-controls-panel bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            📐 Kéo 4 góc ảnh để thay đổi kích thước
          </span>
          <span className="text-xs text-blue-700 ml-2">
            ({selectedImageWidth})
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={deleteImage}
            className="h-8 w-8 p-0 cursor-pointer hover:bg-red-100 hover:text-red-600"
            title="Xóa ảnh"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <button
            onClick={() => {
              setShowImageControls(false)
            }}
            className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
          >
            ✕ Đóng
          </button>
        </div>
      )}
      
      {/* Toolbar */}
      {showToolbar && (
        <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1">{/* Text Formatting */}
        <div className="flex gap-1 pr-2 border-r border-gray-300">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('bold') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0 cursor-pointer hover:bg-blue-100"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('italic') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0 cursor-pointer hover:bg-blue-100"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('underline') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-8 w-8 p-0 cursor-pointer hover:bg-blue-100"
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('code') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Code"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex gap-1 pr-2 border-r">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex gap-1 pr-2 border-r">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Alignment */}
        <div className="flex gap-1 pr-2 border-r">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Justify"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>

        {/* Insert */}
        <div className="flex gap-1 pr-2 border-r">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={uploadImage}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Upload Image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('link') ? 'default' : 'ghost'}
            onClick={setLink}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Horizontal Line"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        {/* Text Color */}
        <div className="flex gap-1 pr-2 border-r">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground px-2">Màu:</span>
            <input
              type="color"
              value={textColor}
              onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
              className="h-8 w-10 rounded cursor-pointer border border-border"
              title="Text Color"
            />
          </div>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} className="bg-background" />
    </div>
  )
}
