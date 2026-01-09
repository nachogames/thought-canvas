import { useState, useRef, useEffect, useCallback } from 'react'
import { Database, Copy, Download, ClipboardPaste, Upload, Check, X, Replace, Merge } from 'lucide-react'
import { useStickies } from '@/hooks'
import {
  exportToJson,
  downloadJson,
  copyToClipboard,
  readFromClipboard,
  parseImportJson,
  validateExportData,
  readJsonFile,
} from '@/utils'
import type { ImportMode } from '@/types'

type FeedbackType = 'success' | 'error' | null

interface FeedbackState {
  type: FeedbackType
  message: string
}

type MenuState = 'closed' | 'main' | 'import-mode'

export function DataMenu() {
  const { stickies, exportData, importData } = useStickies()
  const [menuState, setMenuState] = useState<MenuState>('closed')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [pendingImportData, setPendingImportData] = useState<ReturnType<typeof validateExportData>['data'] | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Click outside to close
  useEffect(() => {
    if (menuState === 'closed') return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuState('closed')
        setPendingImportData(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuState])

  // Auto-clear feedback
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2500)
    return () => clearTimeout(timer)
  }, [feedback])

  const showFeedback = useCallback((type: FeedbackType, message: string) => {
    setFeedback({ type, message })
  }, [])

  const handleCopyToClipboard = async () => {
    const data = exportData()
    const json = exportToJson(data)
    const success = await copyToClipboard(json)

    if (success) {
      showFeedback('success', `Copied ${data.stickies.length} cards`)
      setMenuState('closed')
    } else {
      showFeedback('error', 'Failed to copy')
    }
  }

  const handleDownload = () => {
    const data = exportData()
    downloadJson(data)
    showFeedback('success', `Downloaded ${data.stickies.length} cards`)
    setMenuState('closed')
  }

  const handlePasteFromClipboard = async () => {
    const text = await readFromClipboard()

    if (!text) {
      showFeedback('error', 'Clipboard is empty or access denied')
      return
    }

    const parsed = parseImportJson(text)
    if (!parsed) {
      showFeedback('error', 'Invalid JSON format')
      return
    }

    const validation = validateExportData(parsed)
    if (!validation.valid || !validation.data) {
      showFeedback('error', validation.errors[0] || 'Invalid data')
      return
    }

    // Show import mode selection
    setPendingImportData(validation.data)
    setMenuState('import-mode')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await readJsonFile(file)
      const parsed = parseImportJson(text)

      if (!parsed) {
        showFeedback('error', 'Invalid JSON format')
        return
      }

      const validation = validateExportData(parsed)
      if (!validation.valid || !validation.data) {
        showFeedback('error', validation.errors[0] || 'Invalid data')
        return
      }

      // Show import mode selection
      setPendingImportData(validation.data)
      setMenuState('import-mode')
    } catch {
      showFeedback('error', 'Failed to read file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportWithMode = (mode: ImportMode) => {
    if (!pendingImportData) return

    importData(pendingImportData, mode)
    const count = pendingImportData.stickies.length
    showFeedback('success', `${mode === 'replace' ? 'Replaced with' : 'Added'} ${count} cards`)
    setMenuState('closed')
    setPendingImportData(null)
  }

  const toggleMenu = () => {
    setMenuState(prev => prev === 'closed' ? 'main' : 'closed')
    setPendingImportData(null)
  }

  const buttonClass = `
    w-full flex items-center gap-3 px-3 py-2 rounded-lg
    text-sm text-left
    text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-gray-700
    transition-colors cursor-pointer
  `

  const sectionTitleClass = `
    text-[10px] font-semibold uppercase tracking-wider
    text-gray-400 dark:text-gray-500
    px-3 py-1.5
  `

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={toggleMenu}
        className={`
          p-2 rounded-full transition-colors cursor-pointer
          ${menuState !== 'closed'
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }
        `}
        title="Import / Export"
      >
        <Database size={18} />
      </button>

      {/* Popover menu */}
      {menuState !== 'closed' && (
        <div className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-56
          bg-white dark:bg-gray-800
          rounded-xl shadow-lg
          border border-gray-200 dark:border-gray-700
          overflow-hidden
        ">
          {/* Feedback toast */}
          {feedback && (
            <div className={`
              px-3 py-2 text-sm flex items-center gap-2
              ${feedback.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }
            `}>
              {feedback.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {feedback.message}
            </div>
          )}

          {menuState === 'main' && (
            <>
              {/* Export section */}
              <div className={sectionTitleClass}>Export</div>
              <div className="px-1.5 pb-1.5">
                <button
                  onClick={handleCopyToClipboard}
                  className={buttonClass}
                  disabled={stickies.length === 0}
                >
                  <Copy size={16} className="text-gray-400" />
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleDownload}
                  className={buttonClass}
                  disabled={stickies.length === 0}
                >
                  <Download size={16} className="text-gray-400" />
                  Download File
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              {/* Import section */}
              <div className={sectionTitleClass}>Import</div>
              <div className="px-1.5 pb-1.5">
                <button
                  onClick={handlePasteFromClipboard}
                  className={buttonClass}
                >
                  <ClipboardPaste size={16} className="text-gray-400" />
                  Paste from Clipboard
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={buttonClass}
                >
                  <Upload size={16} className="text-gray-400" />
                  Upload File
                </button>
              </div>
            </>
          )}

          {menuState === 'import-mode' && pendingImportData && (
            <>
              <div className={sectionTitleClass}>
                Import {pendingImportData.stickies.length} cards
              </div>
              <div className="px-1.5 pb-1.5">
                <button
                  onClick={() => handleImportWithMode('replace')}
                  className={buttonClass}
                >
                  <Replace size={16} className="text-gray-400" />
                  <div>
                    <div>Replace All</div>
                    <div className="text-xs text-gray-400">Remove existing cards</div>
                  </div>
                </button>
                <button
                  onClick={() => handleImportWithMode('merge')}
                  className={buttonClass}
                >
                  <Merge size={16} className="text-gray-400" />
                  <div>
                    <div>Merge</div>
                    <div className="text-xs text-gray-400">Add to existing cards</div>
                  </div>
                </button>
              </div>

              {/* Back button */}
              <div className="h-px bg-gray-200 dark:bg-gray-700" />
              <div className="px-1.5 py-1.5">
                <button
                  onClick={() => {
                    setMenuState('main')
                    setPendingImportData(null)
                  }}
                  className={`${buttonClass} text-gray-500`}
                >
                  <X size={16} className="text-gray-400" />
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
