'use client'

import { mergeAttributes, type Editor as TiptapEditor } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
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
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from './ui/button'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  error?: string
  textColor?: string
  showToolbar?: boolean
  minHeight?: string
}

interface SlashCommandItem {
  id: string
  title: string
  description: string
  keywords: string[]
  action: () => void
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

  const verticalAlign = typeof node.attrs.verticalAlign === 'string' ? node.attrs.verticalAlign : 'top'

  return (
    <NodeViewWrapper
      className={`image-wrapper ${selected ? 'image-wrapper-selected' : ''}`}
      style={{ display: 'inline-block', position: 'relative', maxWidth: '100%', verticalAlign }}
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
      verticalAlign: {
        default: 'top',
        parseHTML: (element) => {
          const data = element.getAttribute('data-vertical-align')
          return data || 'top'
        },
        renderHTML: (attributes) => {
          if (!attributes.verticalAlign) return {}
          return {
            'data-vertical-align': attributes.verticalAlign,
            style: `vertical-align: ${attributes.verticalAlign};`
          }
        }
      },
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
  showToolbar = true,
  minHeight = 'min-h-[300px]'
}: RichTextEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastEmittedContentRef = useRef<string>(content || '')
  const [selectedImageWidth, setSelectedImageWidth] = useState<string>('100%')
  const [selectedImageAlign, setSelectedImageAlign] = useState<string>('top')
  const [showImageControls, setShowImageControls] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [showEmbedDialog, setShowEmbedDialog] = useState(false)
  const [embedUrlValue, setEmbedUrlValue] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrlValue, setLinkUrlValue] = useState('')

  const syncSlashMenuFromSelection = useCallback((editorInstance: TiptapEditor) => {
    const { $from } = editorInstance.state.selection
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\\0', '\\0')
    const lastSlash = textBefore.lastIndexOf('/')

    if (lastSlash === -1) {
      setShowSlashMenu((prev) => (prev ? false : prev))
      setSlashQuery((prev) => (prev ? '' : prev))
      return
    }

    const query = textBefore.slice(lastSlash + 1)
    const invalidQuery = query.includes(' ') || query.includes('\\n')

    if (invalidQuery) {
      setShowSlashMenu((prev) => (prev ? false : prev))
      setSlashQuery((prev) => (prev ? '' : prev))
      return
    }

    setSlashQuery((prev) => (prev === query ? prev : query))
    setShowSlashMenu((prev) => (prev ? prev : true))
  }, [])

  const dataUrlToFile = useCallback(async (dataUrl: string, fallbackName: string) => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const ext = blob.type.split('/')[1] || 'png'
    return new File([blob], `${fallbackName}.${ext}`, { type: blob.type || 'image/png' })
  }, [])

  const uploadImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Chi ho tro dinh dang anh')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Kich thuoc anh toi da 5MB')
    }

    const formData = new FormData()
    formData.append('image', file)

    const res = await fetch('/api/upload-question-image', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    if (!res.ok || !data?.success || !data?.url) {
      throw new Error(data?.error || 'Upload failed')
    }

    return String(data.url)
  }, [])
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      ResizableImage.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: 'tiptap-image'
        }
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full min-w-full my-4 overflow-x-auto block tiptap-table',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 p-2 font-bold text-left min-w-[100px]',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 min-w-[100px]',
        },
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
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none ${minHeight} px-4 py-3 ${
          error ? 'border-red-500' : ''
        }`
      },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData
        const items = clipboard?.items
        if (!items?.length) return false

        const html = clipboard?.getData('text/html') || ''
        const hasHtml = Boolean(html && html.trim())
        const hasDataImageInHtml = /<img[^>]+src=["']data:image/i.test(html)

        if (hasHtml && hasDataImageInHtml) {
          event.preventDefault()
          ;(async () => {
            try {
              toast.loading('Dang xu ly anh tu noi dung paste...', { id: 'richtext-image-upload' })

              const parser = new DOMParser()
              const doc = parser.parseFromString(html, 'text/html')
              const images = Array.from(doc.querySelectorAll('img'))
              let uploadedCount = 0

              for (let i = 0; i < images.length; i += 1) {
                const img = images[i]
                const src = img.getAttribute('src') || ''
                if (!src.startsWith('data:image')) continue

                try {
                  const file = await dataUrlToFile(src, `pasted-image-${Date.now()}-${i}`)
                  const imageUrl = await uploadImageFile(file)
                  img.setAttribute('src', imageUrl)
                  uploadedCount += 1
                } catch {
                  // Cloud-only mode: remove image if upload fails.
                  img.remove()
                }
              }

              const finalHtml = doc.body.innerHTML
              if (finalHtml.trim()) {
                editor?.chain().focus().insertContent(finalHtml).run()
              }

              if (uploadedCount > 0) {
                toast.success(`Da paste noi dung va tai ${uploadedCount} anh len cloud`, {
                  id: 'richtext-image-upload'
                })
              } else {
                toast.error('Khong tai duoc anh tu noi dung paste. Da chen phan text.', {
                  id: 'richtext-image-upload'
                })
              }
            } catch (error) {
              console.error('Rich HTML paste processing error:', error)
              toast.error('Khong the xu ly noi dung paste tu doc', { id: 'richtext-image-upload' })
            }
          })()

          return true
        }

        for (const item of Array.from(items)) {
          if (!item.type.startsWith('image/')) continue

          if (hasHtml) {
            // If rich HTML is present, keep default paste flow for full text content.
            return false
          }

          const file = item.getAsFile()
          if (!file) continue

          event.preventDefault()
          ;(async () => {
            try {
              toast.loading('Dang tai anh len cloud...', { id: 'richtext-image-upload' })
              const imageUrl = await uploadImageFile(file)
              editor?.chain().focus().setImage({ src: imageUrl, alt: file.name || 'image' }).run()
              toast.success('Da chen anh thanh cong', { id: 'richtext-image-upload' })
            } catch (error) {
              console.error('Paste image upload error:', error)
              toast.error(error instanceof Error ? error.message : 'Khong the tai anh len cloud', {
                id: 'richtext-image-upload'
              })
            }
          })()

          return true
        }

        return false
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        const imageFile = files.find((file) => file.type.startsWith('image/'))
        if (!imageFile) return false

        event.preventDefault()
        ;(async () => {
          try {
            toast.loading('Dang tai anh len cloud...', { id: 'richtext-image-upload' })
            const imageUrl = await uploadImageFile(imageFile)
            editor?.chain().focus().setImage({ src: imageUrl, alt: imageFile.name || 'image' }).run()
            toast.success('Da chen anh thanh cong', { id: 'richtext-image-upload' })
          } catch (error) {
            console.error('Drop image upload error:', error)
            toast.error(error instanceof Error ? error.message : 'Khong the tai anh len cloud', {
              id: 'richtext-image-upload'
            })
          }
        })()

        return true
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()

      // Blob/Data URLs are temporary and should not be persisted.
      const hasUnstableSource = /<img[^>]+src=["'](?:blob:|data:image)/i.test(html)
      if (hasUnstableSource) {
        const sanitized = html.replace(/<img[^>]+src=["'](?:blob:[^"']*|data:image[^"']*)["'][^>]*>/gi, '')
        if (sanitized !== html) {
          editor.commands.setContent(sanitized, { emitUpdate: false })
          lastEmittedContentRef.current = sanitized
          onChange(sanitized)
          toast.error('Anh tam (blob/base64) da bi loai bo. Vui long upload Cloudinary truoc khi luu.')
          return
        }
      }

      lastEmittedContentRef.current = html
      onChange(html)
      syncSlashMenuFromSelection(editor)
    },
    onSelectionUpdate: ({ editor }: { editor: TiptapEditor }) => {
      const selection = editor.state.selection
      if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
        setShowImageControls(true)
        const w = selection.node.attrs.width
        if (typeof w === 'number' && Number.isFinite(w)) setSelectedImageWidth(`${Math.round(w)}px`)
        else setSelectedImageWidth('auto')
        const align = selection.node.attrs.verticalAlign
        setSelectedImageAlign(typeof align === 'string' && align ? align : 'top')
      } else {
        setShowImageControls(false)
      }

      syncSlashMenuFromSelection(editor)
    }
  })

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined && content !== null) {
      if (editor.isFocused) return
      if (content === lastEmittedContentRef.current) return

      // Only update if content actually changed to avoid unnecessary updates
      const currentContent = editor.getHTML()
      if (currentContent !== content) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
      lastEmittedContentRef.current = content
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
        toast.loading('Dang tai anh len cloud...', { id: 'richtext-image-upload' })
        const imageUrl = await uploadImageFile(file)
        editor.chain().focus().setImage({ src: imageUrl, alt: file.name || 'image' }).run()
        toast.success('Da chen anh thanh cong', { id: 'richtext-image-upload' })
      } catch (error) {
        console.error('Image upload error:', error)
        toast.error(error instanceof Error ? error.message : 'Khong the tai len hinh anh', {
          id: 'richtext-image-upload'
        })
      }
    }

    input.click()
  }, [editor, uploadImageFile])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    setLinkUrlValue(typeof previousUrl === 'string' ? previousUrl : '')
    setShowLinkDialog(true)
  }, [editor])

  const closeLinkDialog = useCallback(() => {
    setShowLinkDialog(false)
    setLinkUrlValue('')
  }, [])

  const submitLinkDialog = useCallback(() => {
    if (!editor) return

    const safeUrl = linkUrlValue.trim()
    if (!safeUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      closeLinkDialog()
      return
    }

    try {
      const normalizedUrl = new URL(safeUrl).toString()
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run()
      closeLinkDialog()
    } catch {
      toast.error('URL khong hop le. Vi du: https://example.com')
    }
  }, [closeLinkDialog, editor, linkUrlValue])

  const deleteImage = useCallback(() => {
    if (!editor) return
    editor.chain().focus().deleteSelection().run()
    setShowImageControls(false)
  }, [editor])

  const setImageVerticalAlign = useCallback((align: string) => {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', { verticalAlign: align }).run()
    setSelectedImageAlign(align)
  }, [editor])

  const insertHintBlock = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent('<blockquote><p><strong>HINT:</strong> Nội dung gợi ý...</p></blockquote>').run()
  }, [editor])

  const insertTaskListTemplate = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent('<p>[ ] Việc cần làm 1</p><p>[ ] Việc cần làm 2</p>').run()
  }, [editor])

  const insertEmbedUrl = useCallback(() => {
    if (!editor) return
    setEmbedUrlValue('')
    setShowEmbedDialog(true)
  }, [editor])

  const closeEmbedDialog = useCallback(() => {
    setShowEmbedDialog(false)
    setEmbedUrlValue('')
  }, [])

  const submitEmbedUrl = useCallback(() => {
    if (!editor) return

    const safeUrl = embedUrlValue.trim()
    if (!safeUrl) {
      toast.error('Vui long nhap URL can nhung')
      return
    }

    try {
      const normalizedUrl = new URL(safeUrl).toString()
      editor
        .chain()
        .focus()
        .insertContent(`<p><a href="${normalizedUrl}" target="_blank" rel="noreferrer">${normalizedUrl}</a></p>`)
        .run()
      closeEmbedDialog()
    } catch {
      toast.error('URL khong hop le. Vi du: https://example.com')
    }
  }, [closeEmbedDialog, editor, embedUrlValue])

  const insertTabsTemplate = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent('<h3>Tab 1</h3><p>Nội dung tab 1...</p><hr><h3>Tab 2</h3><p>Nội dung tab 2...</p>').run()
  }, [editor])

  const insertDrawingPlaceholder = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent('<blockquote><p><strong>Drawing:</strong> Dán link Figma/Miro hoặc ảnh sơ đồ tại đây.</p></blockquote>').run()
  }, [editor])

  const insertTwoColumnsTemplate = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 1, cols: 2, withHeaderRow: false }).run()
  }, [editor])


  const insertStepperStep = useCallback(() => {
    if (!editor) return

    if (editor.isActive('orderedList')) {
      editor
        .chain()
        .focus()
        .splitListItem('listItem')
        .insertContent('<p><strong>Step title</strong></p><p>Step content</p>')
        .run()
      return
    }

    editor
      .chain()
      .focus()
      .insertContent('<ol><li><p><strong>Step title</strong></p><p>Step content</p></li></ol>')
      .run()
  }, [editor])

  const slashCommands = useMemo<SlashCommandItem[]>(() => {
    if (!editor) return []

    return [
      { id: 'paragraph', title: 'Paragraph', description: 'Đoạn văn bản thường', keywords: ['paragraph', 'text', 'p'], action: () => editor.chain().focus().setParagraph().run() },
      { id: 'h1', title: 'Heading 1', description: 'Tiêu đề cấp 1', keywords: ['h1', 'heading'], action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
      { id: 'h2', title: 'Heading 2', description: 'Tiêu đề cấp 2', keywords: ['h2', 'heading'], action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
      { id: 'h3', title: 'Heading 3', description: 'Tiêu đề cấp 3', keywords: ['h3', 'heading'], action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
      { id: 'unordered-list', title: 'Unordered list', description: 'Danh sách dấu chấm', keywords: ['unordered', 'bullet', 'list'], action: () => editor.chain().focus().toggleBulletList().run() },
      { id: 'ordered-list', title: 'Ordered list', description: 'Danh sách đánh số', keywords: ['ordered', 'number', 'list'], action: () => editor.chain().focus().toggleOrderedList().run() },
      { id: 'task-list', title: 'Task list', description: 'Checklist công việc', keywords: ['task', 'todo', 'checklist'], action: insertTaskListTemplate },
      { id: 'add-step', title: 'Add Step', description: 'Chèn nhanh một bước mới', keywords: ['step', 'stepper', 'quick'], action: insertStepperStep },
      { id: 'divider', title: 'Divider', description: 'Đường phân cách', keywords: ['divider', 'line', 'hr'], action: () => editor.chain().focus().setHorizontalRule().run() },
      { id: 'hint', title: 'Hint', description: 'Khối gợi ý', keywords: ['hint', 'tip', 'note'], action: insertHintBlock },
      { id: 'quote', title: 'Quote', description: 'Khối trích dẫn', keywords: ['quote', 'blockquote'], action: () => editor.chain().focus().toggleBlockquote().run() },
      { id: 'codeblock', title: 'Code block', description: 'Khối code', keywords: ['code', 'snippet'], action: () => editor.chain().focus().toggleCodeBlock().run() },
      { id: 'image', title: 'Insert Image', description: 'Chèn ảnh từ máy tính', keywords: ['image', 'photo', 'upload'], action: uploadImage },
      { id: 'table', title: 'Table', description: 'Bảng dữ liệu', keywords: ['table', 'grid'], action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'tabs', title: 'Tab', description: 'Mẫu nội dung dạng tab', keywords: ['tab', 'tabs'], action: insertTabsTemplate },
      { id: 'drawing', title: 'Drawing', description: 'Khối đính kèm sơ đồ', keywords: ['drawing', 'diagram', 'figma', 'miro'], action: insertDrawingPlaceholder },
      { id: 'column', title: 'Column', description: 'Bố cục 2 cột', keywords: ['column', 'columns'], action: insertTwoColumnsTemplate },
      { id: 'embed', title: 'Embed a URL', description: 'Nhúng liên kết', keywords: ['embed', 'url', 'link'], action: insertEmbedUrl },
    ]
  }, [editor, insertDrawingPlaceholder, insertEmbedUrl, insertHintBlock, insertStepperStep, insertTabsTemplate, insertTaskListTemplate, insertTwoColumnsTemplate, uploadImage])

  const filteredSlashCommands = useMemo(() => {
    const q = slashQuery.trim().toLowerCase()
    if (!q) return slashCommands
    return slashCommands.filter((item) => `${item.title} ${item.description} ${item.keywords.join(' ')}`.toLowerCase().includes(q))
  }, [slashCommands, slashQuery])

  const closeSlashMenu = useCallback(() => {
    setShowSlashMenu(false)
    setSlashQuery('')
  }, [])

  const executeSlashCommand = useCallback((command: SlashCommandItem) => {
    if (!editor) return
    const { $from } = editor.state.selection
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0')
    const lastSlash = textBefore.lastIndexOf('/')

    if (lastSlash >= 0) {
      const start = $from.start() + lastSlash
      const end = $from.start() + $from.parentOffset
      editor.chain().focus().deleteRange({ from: start, to: end }).run()
    }

    command.action()
    closeSlashMenu()
  }, [closeSlashMenu, editor])

  if (!editor) {
    return null
  }

  return (
    <div ref={editorContainerRef} className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white ${error ? 'border-red-500 shadow-sm shadow-red-100' : ''}`}>
      <div className="border-b border-gray-100 bg-[#fcfcfd] px-4 py-3">
        <p className="text-xs font-medium text-gray-500">Gõ "/" để mở block menu</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:border-[#a1001f]/40 hover:text-[#a1001f]">Heading 1</button>
          <button type="button" onClick={uploadImage} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:border-[#a1001f]/40 hover:text-[#a1001f]">Image</button>
          <button type="button" onClick={insertHintBlock} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:border-[#a1001f]/40 hover:text-[#a1001f]">Hint</button>
          <button type="button" onClick={insertStepperStep} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:border-[#a1001f]/40 hover:text-[#a1001f]">Add Step</button>
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 hover:border-[#a1001f]/40 hover:text-[#a1001f]">Code</button>
        </div>
      </div>
      {/* Image Controls */}
      {showImageControls && (
        <div className="image-controls-panel bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            📐 Kéo 4 góc ảnh để thay đổi kích thước
          </span>
          <span className="text-xs text-blue-700 ml-2">
            ({selectedImageWidth})
          </span>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-blue-700">Căn dọc:</span>
            <select
              value={selectedImageAlign}
              onChange={(e) => setImageVerticalAlign(e.target.value)}
              className="h-8 rounded-md border border-blue-200 bg-white/90 px-2 text-xs text-blue-900"
            >
              <option value="top">Trên</option>
              <option value="middle">Giữa</option>
              <option value="bottom">Dưới</option>
              <option value="baseline">Baseline</option>
            </select>
          </div>
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
            onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
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

        {/* Table Operations */}
        <div className="flex gap-1 pr-2 border-r">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('table') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className=" h-8 w-8 p-0 cursor-pointer"
            title="Thêm Bảng"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          {editor.isActive('table') && (
            <div className="flex items-center bg-blue-50/50 rounded-md border border-blue-100 p-0.5 gap-0.5 ml-1">
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="h-7 px-2 text-[10px] text-blue-700 hover:bg-blue-100 cursor-pointer"
                    title="Thêm cột"
                >
                    +Cột
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="h-7 px-2 text-[10px] text-blue-700 hover:bg-blue-100 cursor-pointer"
                    title="Thêm dòng"
                >
                    +Dòng
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="h-7 px-2 text-[10px] text-red-600 hover:bg-red-100 cursor-pointer"
                    title="Xóa Bảng"
                >
                    Xóa
                </Button>
            </div>
          )}
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

      {showSlashMenu && (
        <div className="absolute left-4 top-16 z-40 w-90 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-2xl">
          <div className="mb-2 px-2 text-sm font-semibold text-gray-700">Insert block...</div>
          <div className="space-y-1">
            {filteredSlashCommands.length === 0 ? (
              <div className="rounded-md px-2 py-2 text-sm text-gray-500">Không tìm thấy block phù hợp</div>
            ) : (
              filteredSlashCommands.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => executeSlashCommand(item)}
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-gray-100"
                >
                  <div className="text-sm font-medium text-gray-800">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showEmbedDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeEmbedDialog}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Nhúng liên kết</h3>
              <p className="mt-1 text-sm text-gray-500">Nhập URL để chèn link embed vào nội dung</p>
            </div>

            <div className="px-5 py-4">
              <input
                type="url"
                value={embedUrlValue}
                onChange={(event) => setEmbedUrlValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitEmbedUrl()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeEmbedDialog()
                  }
                }}
                autoFocus
                placeholder="https://example.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeEmbedDialog}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitEmbedUrl}
                className="rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#830018]"
              >
                Chèn link
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeLinkDialog}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Thêm liên kết</h3>
              <p className="mt-1 text-sm text-gray-500">Để trống rồi bấm cập nhật để gỡ liên kết hiện tại</p>
            </div>

            <div className="px-5 py-4">
              <input
                type="url"
                value={linkUrlValue}
                onChange={(event) => setLinkUrlValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitLinkDialog()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeLinkDialog()
                  }
                }}
                autoFocus
                placeholder="https://example.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeLinkDialog}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitLinkDialog}
                className="rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#830018]"
              >
                Cập nhật link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
