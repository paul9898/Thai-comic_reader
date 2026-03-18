import { useEffect, useMemo, useState } from 'react'
import ComicViewer from './components/ComicViewer'
import Toolbar from './components/Toolbar'
import VocabSidebar from './components/VocabSidebar'
import WordPopup from './components/WordPopup'
import { useApi } from './hooks/useApi'

const DICTIONARY_LANG_KEY = 'thai-comic-reader.dictionary-lang'
const LIBRARY_KEY = 'thai-comic-reader.library'
const LAST_DOCUMENT_KEY = 'thai-comic-reader.last-document'
const LAST_PAGE_KEY = 'thai-comic-reader.last-page'
const AUTO_OCR_KEY = 'thai-comic-reader.auto-ocr'
const AI_PROVIDER_KEY = 'thai-comic-reader.ai-provider'
const OCR_EDIT_OVERRIDES_KEY = 'thai-comic-reader.ocr-edit-overrides'
const AI_PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com/' },
]

function readStoredDocument() {
  try {
    const raw = localStorage.getItem(LAST_DOCUMENT_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed?.id || !Array.isArray(parsed?.pages) || typeof parsed?.total_pages !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function readStoredPage() {
  const raw = localStorage.getItem(LAST_PAGE_KEY)
  const parsed = Number.parseInt(raw || '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function readStoredOcrOverrides() {
  try {
    const raw = localStorage.getItem(OCR_EDIT_OVERRIDES_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readStoredAutoOcr() {
  return localStorage.getItem(AUTO_OCR_KEY) === 'true'
}

function readStoredAiProvider() {
  const stored = localStorage.getItem(AI_PROVIDER_KEY) || 'chatgpt'
  return AI_PROVIDERS.some((provider) => provider.id === stored) ? stored : 'chatgpt'
}

function readStoredLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.type === 'string' &&
        typeof item.lastPage === 'number',
    )
  } catch {
    return []
  }
}

function buildOcrOverrideKey(documentId, pageNum, boxId) {
  if (!documentId || pageNum == null || boxId == null) {
    return ''
  }

  return `${documentId}:${pageNum}:${boxId}`
}

function App() {
  const api = useApi()
  const [documentData, setDocumentData] = useState(() => readStoredDocument())
  const [currentDocumentSource, setCurrentDocumentSource] = useState(null)
  const [currentPage, setCurrentPage] = useState(() => readStoredPage())
  const [libraryItems, setLibraryItems] = useState(() => readStoredLibrary())
  const [hasHydratedLibrary, setHasHydratedLibrary] = useState(() => !window.electronShell?.readLibrary)
  const [ocrByPage, setOcrByPage] = useState({})
  const [selection, setSelection] = useState(null)
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupHistory, setLookupHistory] = useState([])
  const [dictionaryLang, setDictionaryLang] = useState(localStorage.getItem(DICTIONARY_LANG_KEY) || 'en')
  const [vocabItems, setVocabItems] = useState([])
  const [vocabSearch, setVocabSearch] = useState('')
  const [status, setStatus] = useState({ busy: false, message: '', error: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isAutoOcrEnabled, setIsAutoOcrEnabled] = useState(() => readStoredAutoOcr())
  const [aiProviderId, setAiProviderId] = useState(() => readStoredAiProvider())
  const [selectionMode, setSelectionMode] = useState(null)
  const [ocrEditOverrides, setOcrEditOverrides] = useState(() => readStoredOcrOverrides())

  const currentPageData = documentData?.pages?.find((page) => page.page_num === currentPage) || null
  const currentPageImageSrc = currentPageData ? api.resolveAssetUrl(currentPageData.image_url) : ''
  const ocrBoxes = currentPageData ? ocrByPage[currentPageData.page_num] || [] : []
  const hasOcrLoadedForCurrentPage = currentPageData
    ? Object.prototype.hasOwnProperty.call(ocrByPage, currentPageData.page_num)
    : false
  const savedWordSet = useMemo(() => new Set(vocabItems.map((item) => item.word)), [vocabItems])
  const aiProvider = AI_PROVIDERS.find((provider) => provider.id === aiProviderId) || AI_PROVIDERS[0]
  const isDesktopApp = Boolean(window.electronShell?.selectDocument)
  const libraryViewItems = useMemo(
    () =>
      libraryItems.map((item) => ({
        ...item,
        isActive: item.id === currentDocumentSource?.libraryId,
        progressLabel: buildProgressLabel(item.lastPage, item.totalPages),
        lastOpenedLabel: formatRelativeTime(item.lastOpenedAt),
      })),
    [currentDocumentSource?.libraryId, libraryItems],
  )

  useEffect(() => {
    localStorage.setItem(DICTIONARY_LANG_KEY, dictionaryLang)
  }, [dictionaryLang])

  useEffect(() => {
    if (!documentData) {
      localStorage.removeItem(LAST_DOCUMENT_KEY)
      localStorage.removeItem(LAST_PAGE_KEY)
      return
    }
    localStorage.setItem(LAST_DOCUMENT_KEY, JSON.stringify(documentData))
  }, [documentData])

  useEffect(() => {
    if (!documentData) {
      return
    }
    localStorage.setItem(LAST_PAGE_KEY, String(currentPage))
  }, [currentPage, documentData])

  useEffect(() => {
    localStorage.setItem(OCR_EDIT_OVERRIDES_KEY, JSON.stringify(ocrEditOverrides))
  }, [ocrEditOverrides])

  useEffect(() => {
    localStorage.setItem(AUTO_OCR_KEY, String(isAutoOcrEnabled))
  }, [isAutoOcrEnabled])

  useEffect(() => {
    localStorage.setItem(AI_PROVIDER_KEY, aiProviderId)
  }, [aiProviderId])

  useEffect(() => {
    if (!window.electronShell?.readLibrary) {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryItems))
    }
  }, [libraryItems])

  useEffect(() => {
    if (!window.electronShell?.readLibrary) {
      return
    }

    let cancelled = false

    async function hydrateLibrary() {
      try {
        const storedItems = await window.electronShell.readLibrary()
        if (cancelled) {
          return
        }

        if (Array.isArray(storedItems) && storedItems.length) {
          setLibraryItems(storedItems)
        }
      } finally {
        if (!cancelled) {
          setHasHydratedLibrary(true)
        }
      }
    }

    void hydrateLibrary()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!window.electronShell?.writeLibrary || !hasHydratedLibrary) {
      return
    }

    void window.electronShell.writeLibrary(libraryItems)
  }, [hasHydratedLibrary, libraryItems])

  useEffect(() => {
    loadVocab(vocabSearch)
  }, [vocabSearch])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) {
        return
      }

      if (event.key === 'Escape') {
        closePopups()
        setIsHelpOpen(false)
        setIsSettingsOpen(false)
        setSelectionMode(null)
      }
      if (event.key === '?') {
        event.preventDefault()
        setIsHelpOpen((previous) => !previous)
      }
      if (event.key === 'ArrowLeft') {
        setCurrentPage((page) => Math.max(1, page - 1))
      }
      if (event.key === 'ArrowRight') {
        setCurrentPage((page) => Math.min(documentData?.total_pages || 1, page + 1))
      }
      if (event.key.toLowerCase() === 'r' && currentPageData && !status.busy) {
        event.preventDefault()
        setSelectionMode((previous) => (previous === 'ocr' ? null : 'ocr'))
        closePopups()
      }
      if (event.key.toLowerCase() === 'g' && currentPageData && !status.busy) {
        event.preventDefault()
        setSelectionMode((previous) => (previous === 'ai' ? null : 'ai'))
        closePopups()
      }
      if (event.key.toLowerCase() === 'o' && currentPageData && !status.busy) {
        event.preventDefault()
        void handleRunOcr()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentPageData, documentData?.total_pages, status.busy])

  useEffect(() => {
    if (!documentData?.pages?.length || !currentPageData) {
      return
    }

    const preloadTargets = [
      documentData.pages.find((page) => page.page_num === currentPage + 1),
      documentData.pages.find((page) => page.page_num === currentPage - 1),
    ].filter(Boolean)

    const loaders = preloadTargets.map((page) => {
      const image = new Image()
      image.src = api.resolveAssetUrl(page.image_url)
      return image
    })

    return () => {
      loaders.forEach((image) => {
        image.src = ''
      })
    }
  }, [api, currentPage, currentPageData, documentData])

  useEffect(() => {
    if (!documentData?.total_pages) {
      return
    }
    if (currentPage > documentData.total_pages) {
      setCurrentPage(documentData.total_pages)
    }
  }, [currentPage, documentData])

  useEffect(() => {
    if (!currentDocumentSource?.libraryId || !documentData) {
      return
    }

    setLibraryItems((previous) =>
      previous.map((item) =>
        item.id === currentDocumentSource.libraryId
          ? {
              ...item,
              lastPage: currentPage,
              totalPages: documentData.total_pages,
              lastOpenedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
  }, [currentDocumentSource, currentPage, documentData])

  useEffect(() => {
    if (!isAutoOcrEnabled || !currentPageData || status.busy || selectionMode || hasOcrLoadedForCurrentPage) {
      return
    }

    void handleRunOcr({ mode: 'auto' })
  }, [currentPageData, hasOcrLoadedForCurrentPage, isAutoOcrEnabled, selectionMode, status.busy])

  async function loadVocab(search = '') {
    try {
      const data = await api.fetchVocab(search)
      setVocabItems(data.items)
    } catch (error) {
      setStatus({
        busy: false,
        message: '',
        error: getErrorMessage(error, 'Could not load saved vocabulary.'),
      })
    }
  }

  async function handleDocumentUpload(file, type) {
    if (!file) {
      return
    }

    setStatus({ busy: true, message: `Loading ${type.toUpperCase()}...`, error: '' })
    setDocumentData(null)
    setCurrentPage(1)
    closePopups()
    setOcrByPage({})
    setSelectionMode(null)

    try {
      const data = await api.uploadDocument(file, type)
      completeDocumentLoad({
        data,
        source: {
          title: file.name,
          type,
          sourcePath: file.path || '',
        },
        pageToOpen: 1,
        statusMessage: `${file.name} loaded.`,
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, `Could not load ${type}.`) })
    }
  }

  async function handleOpenDocument(type) {
    if (!isDesktopApp) {
      return
    }

    const picked = await window.electronShell.selectDocument(type)
    if (!picked?.path) {
      return
    }

    setStatus({ busy: true, message: `Loading ${type.toUpperCase()}...`, error: '' })
    setDocumentData(null)
    setCurrentPage(1)
    closePopups()
    setOcrByPage({})
    setSelectionMode(null)

    try {
      const data = await api.loadLocalDocument(picked.path, type)
      completeDocumentLoad({
        data,
        source: {
          title: picked.name,
          type,
          sourcePath: picked.path,
        },
        pageToOpen: 1,
        statusMessage: `${picked.name} loaded.`,
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, `Could not load ${type}.`) })
    }
  }

  async function handleResumeBook(item, { startOver = false } = {}) {
    if (!item?.sourcePath) {
      setStatus({ busy: false, message: '', error: 'This saved book cannot be reopened automatically yet.' })
      return
    }

    setStatus({ busy: true, message: `Opening ${item.title}...`, error: '' })
    setDocumentData(null)
    setCurrentPage(1)
    closePopups()
    setOcrByPage({})
    setSelectionMode(null)

    try {
      const data = await api.loadLocalDocument(item.sourcePath, item.type)
      completeDocumentLoad({
        data,
        source: item,
        pageToOpen: startOver ? 1 : item.lastPage,
        statusMessage: startOver
          ? `${item.title} reopened from page 1.`
          : `${item.title} reopened at page ${item.lastPage}.`,
      })
    } catch (error) {
      setStatus({
        busy: false,
        message: '',
        error: getErrorMessage(error, `Could not reopen ${item.title}. It may have moved or been deleted.`),
      })
    }
  }

  async function handleRunOcr(options = {}) {
    const { mode = 'manual' } = options
    if (!currentPageData) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(ocrByPage, currentPageData.page_num)) {
      if (mode === 'manual') {
        setStatus({ busy: false, message: 'OCR boxes already loaded for this page.', error: '' })
      }
      return
    }

    setStatus({
      busy: true,
      message: mode === 'auto' ? 'Auto OCR is running on this page...' : 'Running OCR on this page...',
      error: '',
    })
    closePopups()

    try {
      const data = await api.runOcr(currentPageData.image_url)
      setOcrByPage((previous) => ({
        ...previous,
        [currentPageData.page_num]: data.boxes,
      }))
      setStatus({
        busy: false,
        message:
          data.boxes.length
            ? `Found ${data.boxes.length} text boxes.`
            : 'No text boxes found on this page.',
        error: '',
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'OCR failed.') })
    }
  }

  async function handleRunRegionOcr(regionSelection) {
    if (!currentPageData) {
      return
    }

    setStatus({ busy: true, message: 'Running OCR on selected region...', error: '' })
    closePopups()

    try {
      const data = await api.runRegionOcr(currentPageData.image_url, regionSelection)
      setOcrByPage((previous) => ({
        ...previous,
        [currentPageData.page_num]: data.boxes,
      }))
      setSelectionMode(null)
      setStatus({
        busy: false,
        message: data.boxes.length
          ? `Found ${data.boxes.length} text boxes in the selected region.`
          : 'No text found in the selected region.',
        error: '',
      })
      if (data.boxes.length === 1) {
        handleSelectBox(data.boxes[0], regionSelection.anchor)
      }
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Region OCR failed.') })
    }
  }

  async function handleSendRegionToAi(regionSelection) {
    if (!currentPageData) {
      return
    }

    setStatus({ busy: true, message: `Preparing clip for ${aiProvider.label}...`, error: '' })
    closePopups()

    try {
      const pageImageUrl = api.resolveAssetUrl(currentPageData.image_url)
      const clipResult = await cropRegionFromPage(pageImageUrl, regionSelection)
      const prompt = buildAiRegionPrompt({
        pageNum: currentPage,
        sourceText: selection?.sourceText || '',
      })

      const clipboardResult = await writeAiClipboard(clipResult.blob, prompt)
      openExternalUrl(aiProvider.url)

      if (!clipboardResult.imageCopied) {
        downloadBlob(clipResult.blob, clipResult.filename)
      }

      setSelectionMode(null)
      setStatus({
        busy: false,
        message: clipboardResult.imageCopied
          ? `${aiProvider.label} opened. Prompt and image clip copied to your clipboard. Paste into ${aiProvider.label}.`
          : `${aiProvider.label} opened. Prompt copied to clipboard and the image clip was downloaded for upload. Paste the prompt into ${aiProvider.label} and attach the downloaded image.`,
        error: '',
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, `Could not prepare the ${aiProvider.label} clip.`) })
    }
  }

  async function handleSelectBox(box, anchor) {
    setStatus((previous) => ({ ...previous, error: '' }))
    const overrideKey = buildOcrOverrideKey(documentData?.id, currentPageData?.page_num, box.id)
    const sourceText = ocrEditOverrides[overrideKey] || box.text
    try {
      const data = await api.segmentText(sourceText)
      const words = data.words.length ? data.words : [sourceText]
      setSelection({
        anchor,
        words,
        sourceText,
        originalText: box.text,
        boxId: box.id,
        pageNum: currentPageData?.page_num || currentPage,
        documentId: documentData?.id || '',
      })
      setLookupResult(null)
      setLookupHistory([])
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not segment text.') })
    }
  }

  function handleSelectionTextChange(nextText) {
    setOcrEditOverrides((current) => {
      const overrideKey = buildOcrOverrideKey(selection?.documentId, selection?.pageNum, selection?.boxId)
      if (!overrideKey) {
        return current
      }

      return {
        ...current,
        [overrideKey]: nextText,
      }
    })

    setSelection((previous) => {
      if (!previous) {
        return previous
      }

      return {
        ...previous,
        sourceText: nextText,
      }
    })
  }

  async function handleResegmentSelection(nextText, options = {}) {
    const { preferredWords = null } = options
    const normalizedText = nextText.trim()
    if (!normalizedText) {
      return
    }

    setStatus((previous) => ({ ...previous, error: '' }))
    try {
      const data = await api.segmentText(normalizedText)
      const overrideKey = buildOcrOverrideKey(selection?.documentId, selection?.pageNum, selection?.boxId)
      if (overrideKey) {
        setOcrEditOverrides((current) => ({
          ...current,
          [overrideKey]: normalizedText,
        }))
      }
      setSelection((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          sourceText: normalizedText,
          words: preferredWords?.length ? preferredWords : data.words.length ? data.words : [normalizedText],
        }
      })
      setLookupResult(null)
      setLookupHistory([])
      setStatus({
        busy: false,
        message: preferredWords?.length
          ? 'Updated OCR text and replaced the lookup words with your manual combine.'
          : 'Updated OCR text and refreshed word segmentation.',
        error: '',
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not re-segment the edited text.') })
    }
  }

  async function handleLookupEditedText(nextText) {
    const normalizedText = nextText.trim()
    if (!normalizedText) {
      return
    }

    handleSelectionTextChange(normalizedText)
    setLookupHistory([])
    setStatus((previous) => ({ ...previous, error: '' }))
    try {
      const data = await api.lookupWord(normalizedText, dictionaryLang)
      setLookupResult(data)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not look up the edited text.') })
    }
  }

  async function handleWordPick(word, options = {}) {
    const { pushHistory = true } = options
    try {
      if (pushHistory && lookupResult?.word) {
        const currentKey = `${lookupResult.word}:${lookupResult.lang}`
        const nextKey = `${word}:${dictionaryLang}`
        if (currentKey !== nextKey) {
          setLookupHistory((previous) => [...previous, { word: lookupResult.word, lang: lookupResult.lang }])
        }
      }
      const data = await api.lookupWord(word, dictionaryLang)
      setLookupResult(data)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not look up the selected word.') })
    }
  }

  async function handleLookupLanguageChange(lang) {
    if (lookupResult?.word && lookupResult.lang !== lang) {
      setLookupHistory((previous) => [...previous, { word: lookupResult.word, lang: lookupResult.lang }])
    }
    setDictionaryLang(lang)
    if (!lookupResult?.word) {
      return
    }

    try {
      const data = await api.lookupWord(lookupResult.word, lang)
      setLookupResult(data)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not switch lookup language.') })
    }
  }

  async function handleLookupBack() {
    const previous = lookupHistory[lookupHistory.length - 1]
    if (!previous) {
      return
    }

    setLookupHistory((history) => history.slice(0, -1))
    setDictionaryLang(previous.lang)
    try {
      const data = await api.lookupWord(previous.word, previous.lang)
      setLookupResult(data)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not go back to the previous lookup.') })
    }
  }

  async function handleSaveWord() {
    if (!lookupResult || !selection) {
      return
    }

    setIsSaving(true)
    try {
      await api.saveVocab({
        word: lookupResult.word,
        definition: lookupResult.definitions.map((entry) => `${entry.pos}: ${entry.meaning}`).join(' | '),
        definition_lang: lookupResult.lang,
        context_sentence: selection.sourceText,
        comic_source: documentData?.id || '',
        page_num: currentPage,
      })
      await loadVocab(vocabSearch)
      setStatus({ busy: false, message: `Saved "${lookupResult.word}" to vocab.`, error: '' })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not save the word.') })
    } finally {
      setIsSaving(false)
    }
  }

  function handleSearchWord(word) {
    if (!word) {
      return
    }

    const query = encodeURIComponent(word)
    openExternalUrl(`https://www.google.com/search?q=${query}`)
  }

  async function handleSearchAi(word) {
    const phrase = word?.trim()
    if (!phrase) {
      return
    }

    const prompt = buildAiLookupPrompt({
      phrase,
      pageNum: currentPage,
      contextText: selection?.sourceText || '',
    })

    try {
      await writePromptClipboard(prompt)
      openExternalUrl(aiProvider.url)
      setStatus({
        busy: false,
        message: `${aiProvider.label} opened and the prompt was copied to your clipboard. Paste it into ${aiProvider.label}.`,
        error: '',
      })
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, `Could not prepare the ${aiProvider.label} prompt.`) })
    }
  }

  async function handleDeleteWord(id) {
    try {
      await api.deleteVocab(id)
      await loadVocab(vocabSearch)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not delete the saved word.') })
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const blob = await api.exportVocab()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'thai-comic-reader-anki.csv'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setStatus({ busy: false, message: '', error: getErrorMessage(error, 'Could not export vocabulary.') })
    } finally {
      setIsExporting(false)
    }
  }

  function closePopups() {
    setSelection(null)
    setLookupResult(null)
    setLookupHistory([])
  }

  function completeDocumentLoad({ data, source, pageToOpen, statusMessage }) {
    setDocumentData(data)
    setCurrentPage(clampPage(pageToOpen, data.total_pages))
    const libraryId = rememberBook(source, data, pageToOpen)
    setCurrentDocumentSource(
      libraryId
        ? {
            ...source,
            libraryId,
          }
        : null,
    )
    setStatus({ busy: false, message: statusMessage, error: '' })
  }

  function rememberBook(source, data, pageToOpen) {
    if (!source?.sourcePath) {
      return ''
    }

    const nextItem = {
      id: buildLibraryItemId(source.type, source.sourcePath),
      title: source.title,
      type: source.type,
      sourcePath: source.sourcePath,
      coverImageUrl: data.pages?.[0]?.image_url || '',
      totalPages: data.total_pages,
      lastPage: clampPage(pageToOpen, data.total_pages),
      lastOpenedAt: new Date().toISOString(),
    }

    setLibraryItems((previous) => upsertLibraryItem(previous, nextItem))
    return nextItem.id
  }

  return (
    <div className="app-shell">
      <Toolbar
        appName="Thai Comic Reader Basic"
        onOpenPdf={(event) => {
          if (isDesktopApp) {
            void handleOpenDocument('pdf')
            return
          }
          handleDocumentUpload(event.target.files?.[0], 'pdf')
        }}
        onOpenImage={(event) => {
          if (isDesktopApp) {
            void handleOpenDocument('image')
            return
          }
          handleDocumentUpload(event.target.files?.[0], 'image')
        }}
        onRunOcr={handleRunOcr}
        onToggleAutoOcr={() => setIsAutoOcrEnabled((previous) => !previous)}
        onToggleHelp={() => setIsHelpOpen((previous) => !previous)}
        onToggleSettings={() => setIsSettingsOpen((previous) => !previous)}
        onToggleRegionMode={() => {
          setSelectionMode((previous) => (previous === 'ocr' ? null : 'ocr'))
          closePopups()
        }}
        onToggleAiMode={() => {
          setSelectionMode((previous) => (previous === 'ai' ? null : 'ai'))
          closePopups()
        }}
        onPrevPage={() => {
          setCurrentPage((page) => Math.max(1, page - 1))
          closePopups()
        }}
        onNextPage={() => {
          setCurrentPage((page) => Math.min(documentData?.total_pages || 1, page + 1))
          closePopups()
        }}
        canRunOcr={Boolean(currentPageData)}
        pageNum={currentPageData?.page_num || 0}
        totalPages={documentData?.total_pages || 0}
        dictionaryLang={dictionaryLang}
        onDictionaryLangChange={setDictionaryLang}
        aiProviderLabel={aiProvider.label}
        isBusy={status.busy}
        isHelpOpen={isHelpOpen}
        isSettingsOpen={isSettingsOpen}
        isAutoOcrEnabled={isAutoOcrEnabled}
        selectionMode={selectionMode}
        usesNativePicker={isDesktopApp}
      />

      {(status.message || status.error) && (
        <div className={`status-banner ${status.error ? 'status-banner--error' : ''}`}>
          {status.error || status.message}
        </div>
      )}

      {isHelpOpen && (
        <section className="help-panel">
          <div className="help-panel__header">
            <div>
              <h2>How To Use It</h2>
              <p>Quick guide for the Electron reader.</p>
            </div>
            <button className="button button--ghost" onClick={() => setIsHelpOpen(false)}>
              Close
            </button>
          </div>
          <div className="help-panel__grid">
            <article className="help-card">
              <h3>Basic Flow</h3>
              <ol>
                <li>Open a PDF or image.</li>
                <li>Move between pages with the arrow buttons or keyboard arrows.</li>
                <li>Run full-page OCR with <strong>O</strong> when you want text boxes.</li>
                <li>Click a highlighted text box to segment words and look them up.</li>
                <li>Open <strong>Edit / Re-Segment OCR</strong> when you want to correct OCR, combine split words, or use the Thai keyboard.</li>
              </ol>
            </article>
            <article className="help-card">
              <h3>Fastest OCR</h3>
              <ol>
                <li>Use the <strong>Auto OCR</strong> toggle in the toolbar if you want new pages to start OCR automatically as you open or flip through them.</li>
                <li>Use <strong>OCR Region</strong> or press <strong>R</strong> for a speech bubble instead of the whole page.</li>
                <li>The first OCR on a new book can take a little while while the OCR engine warms up, especially on larger or denser pages.</li>
                <li>Repeat OCR on the same page or region is now cached and should return faster.</li>
                <li>For huge pages, region OCR will usually feel much snappier than full-page OCR.</li>
                <li>Use <strong>Re-Segment / Update</strong> after keyboard edits if you want the lookup chips to refresh from your corrected text.</li>
              </ol>
            </article>
            <article className="help-card">
              <h3>AI Assist</h3>
              <ol>
                <li>Press <strong>G</strong> or click <strong>Ask {aiProvider.label}</strong>.</li>
                <li>Drag a box over the panel you want help with.</li>
                <li>The app opens your selected AI and copies the prompt to your clipboard automatically, so paste it when the page opens.</li>
                <li>If your Mac allows it, the image slice is copied to the clipboard too. If not, the slice is downloaded for you to attach manually.</li>
              </ol>
            </article>
            <article className="help-card">
              <h3>AI Settings</h3>
              <p>Choose which AI opens for popup `Search AI` and region `Ask AI` actions.</p>
              <div className="help-card__ai-options" role="tablist" aria-label="AI provider">
                {AI_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    className={`button button--ghost ${aiProviderId === provider.id ? 'button--active' : ''}`}
                    onClick={() => setAiProviderId(provider.id)}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </article>
            <article className="help-card">
              <h3>Shortcuts</h3>
              <p><strong>Left / Right</strong>: change page</p>
              <p><strong>O</strong>: run OCR on the current page</p>
              <p><strong>R</strong>: toggle region OCR mode</p>
              <p><strong>G</strong>: toggle AI region mode</p>
              <p><strong>?</strong>: open or close this help</p>
              <p><strong>Esc</strong>: close popups, help, or selection mode</p>
            </article>
          </div>
        </section>
      )}

      {isSettingsOpen && (
        <section className="help-panel">
          <div className="help-panel__header">
            <div>
              <h2>Settings</h2>
              <p>Shared controls for reading, AI, and your saved local data.</p>
            </div>
            <button className="button button--ghost" onClick={() => setIsSettingsOpen(false)}>
              Close
            </button>
          </div>
          <div className="help-panel__grid">
            <article className="help-card">
              <h3>Reading</h3>
              <p>Choose how much the app does automatically while you move through a book.</p>
              <div className="help-card__ai-options" role="group" aria-label="Reading settings">
                <button
                  className={`button button--ghost ${isAutoOcrEnabled ? 'button--active' : ''}`}
                  onClick={() => setIsAutoOcrEnabled((previous) => !previous)}
                >
                  {isAutoOcrEnabled ? 'Auto OCR On' : 'Auto OCR Off'}
                </button>
              </div>
            </article>
            <article className="help-card">
              <h3>AI Provider</h3>
              <p>Popup `Search AI` and region `Ask AI` both use the provider selected here.</p>
              <div className="help-card__ai-options" role="tablist" aria-label="AI provider settings">
                {AI_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    className={`button button--ghost ${aiProviderId === provider.id ? 'button--active' : ''}`}
                    onClick={() => setAiProviderId(provider.id)}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </article>
            <article className="help-card">
              <h3>Library</h3>
              <p>{libraryItems.length} saved books in your local library.</p>
              <p>
                {currentDocumentSource?.libraryId
                  ? 'The active book is pinned at the top of the library with progress and last-opened details.'
                  : 'Open a book from Electron to add it to the shareable bookshelf view.'}
              </p>
            </article>
            <article className="help-card">
              <h3>Corrections</h3>
              <p>{Object.keys(ocrEditOverrides).length} saved OCR text overrides.</p>
              <p>Those edits stay local on this machine and are reused when the same OCR box is opened again.</p>
            </article>
          </div>
        </section>
      )}

      <main className={`layout ${isSidebarCollapsed ? 'layout--sidebar-collapsed' : ''}`}>
        <ComicViewer
          page={currentPageData}
          pageImageSrc={currentPageImageSrc}
          boxes={ocrBoxes}
          selectedBoxId={selection?.boxId}
          onSelectBox={handleSelectBox}
          onClosePopups={closePopups}
          selectionMode={selectionMode}
          onRegionSelect={(regionSelection) => {
            if (selectionMode === 'ai') {
              void handleSendRegionToAi(regionSelection)
              return
            }
            void handleRunRegionOcr(regionSelection)
          }}
          isBusy={status.busy}
        >
          <WordPopup
            selection={selection}
            lookup={lookupResult}
            onWordPick={handleWordPick}
            onSelectionTextChange={handleSelectionTextChange}
            onResegmentSelection={handleResegmentSelection}
            onLookupEditedText={handleLookupEditedText}
            onLookupLanguageChange={handleLookupLanguageChange}
            onLookupBack={handleLookupBack}
            onSave={handleSaveWord}
            onCopy={(word) => navigator.clipboard.writeText(word)}
            onSearchWord={handleSearchWord}
            onSearchAi={handleSearchAi}
            canGoBack={lookupHistory.length > 0}
            savedWords={savedWordSet}
            isSaving={isSaving}
            error={status.error}
          />
        </ComicViewer>

        {isSidebarCollapsed ? (
          <button className="sidebar-peek" onClick={() => setIsSidebarCollapsed(false)}>
            Show Library
          </button>
        ) : null}

        <VocabSidebar
          items={vocabItems}
          search={vocabSearch}
          onSearchChange={setVocabSearch}
          onDelete={handleDeleteWord}
          onExport={handleExport}
          isExporting={isExporting}
          libraryItems={libraryViewItems}
          activeLibraryItemId={currentDocumentSource?.libraryId || ''}
          onResumeBook={(item) => void handleResumeBook(item)}
          onRestartBook={(item) => void handleResumeBook(item, { startOver: true })}
          onRemoveBook={(itemId) => {
            setLibraryItems((previous) => previous.filter((item) => item.id !== itemId))
            if (currentDocumentSource?.libraryId === itemId) {
              setCurrentDocumentSource(null)
            }
          }}
          isLibraryBusy={status.busy}
          resolveAssetUrl={api.resolveAssetUrl}
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
        />
      </main>
    </div>
  )
}

function buildLibraryItemId(type, sourcePath) {
  return `${type}:${sourcePath}`
}

function upsertLibraryItem(items, nextItem) {
  const filtered = items.filter((item) => item.id !== nextItem.id)
  return [nextItem, ...filtered].sort((left, right) => {
    const leftTime = Date.parse(left.lastOpenedAt || '') || 0
    const rightTime = Date.parse(right.lastOpenedAt || '') || 0
    return rightTime - leftTime
  })
}

function clampPage(pageNum, totalPages) {
  const normalized = Number.parseInt(String(pageNum || 1), 10)
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1
  }

  return Math.min(normalized, Math.max(1, totalPages || 1))
}

function buildProgressLabel(lastPage, totalPages) {
  if (!totalPages) {
    return 'Progress not available yet.'
  }

  const progress = Math.max(1, Math.round((Math.min(lastPage || 1, totalPages) / totalPages) * 100))
  return `${progress}% read`
}

function formatRelativeTime(value) {
  if (!value) {
    return 'Opened time unknown.'
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return 'Opened time unknown.'
  }

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) {
    return 'Opened just now'
  }
  if (diffMinutes < 60) {
    return `Opened ${diffMinutes}m ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `Opened ${diffHours}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `Opened ${diffDays}d ago`
}

function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.detail || fallbackMessage
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function buildAiRegionPrompt({ pageNum, sourceText }) {
  const contextLine = sourceText ? `OCR hint or nearby text: ${sourceText}` : 'No OCR hint was provided.'
  return [
    'This is a clipped region from a Thai comic or manga page.',
    `Page context: page ${pageNum}.`,
    contextLine,
    'Please help with the following:',
    '1. Transcribe any Thai text exactly as it appears.',
    '2. Translate it into natural English.',
    '3. Explain tone, slang, particles, and any implied context.',
    '4. If there are multiple possible readings, explain the ambiguity.',
  ].join('\n')
}

function buildAiLookupPrompt({ phrase, pageNum, contextText }) {
  return [
    'Please help with this Thai comic word or phrase.',
    `Word or phrase: ${phrase}`,
    `Page context: page ${pageNum}.`,
    contextText ? `Nearby OCR/context: ${contextText}` : 'No extra context was provided.',
    'Please:',
    '1. Translate it naturally into English.',
    '2. Explain likely meaning, tone, particles, and slang if relevant.',
    '3. If it could be segmented differently, show the alternatives.',
  ].join('\n')
}

async function cropRegionFromPage(imageUrl, region) {
  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = region.width
  canvas.height = region.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create an image canvas.')
  }

  context.drawImage(
    image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  )

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result)
        return
      }
      reject(new Error('Could not encode the clipped image.'))
    }, 'image/png')
  })

  return {
    blob,
    filename: `thai-comic-clip-${Date.now()}.png`,
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the page image for clipping.'))
    image.src = src
  })
}

async function writeAiClipboard(blob, prompt) {
  let textCopied = false
  let imageCopied = false

  if (navigator.clipboard?.write && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/plain': new Blob([prompt], { type: 'text/plain' }),
          'image/png': blob,
        }),
      ])
      return { textCopied: true, imageCopied: true }
    } catch {
      // Fall through to text-only clipboard handling.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(prompt)
    textCopied = true
  }

  return { textCopied, imageCopied }
}

async function writePromptClipboard(prompt) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard text copy is not available.')
  }

  await navigator.clipboard.writeText(prompt)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function openExternalUrl(url) {
  if (window.electronShell?.openExternal) {
    void window.electronShell.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

export default App
