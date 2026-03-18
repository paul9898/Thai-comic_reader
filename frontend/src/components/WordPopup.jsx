import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const THAI_KEYBOARD_ROWS = [
  ['ก', 'ข', 'ค', 'ฆ', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ญ'],
  ['ด', 'ต', 'ถ', 'ท', 'น', 'บ', 'ป', 'ผ', 'พ', 'ม'],
  ['ย', 'ร', 'ล', 'ว', 'ศ', 'ษ', 'ส', 'ห', 'อ', 'ฮ'],
  ['ะ', 'า', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'โ'],
  ['ไ', 'ใ', 'ำ', 'ั', '็', '่', '้', '๊', '๋', '์'],
]

function WordPopup({
  selection,
  lookup,
  onWordPick,
  onSelectionTextChange,
  onResegmentSelection,
  onLookupEditedText,
  onLookupLanguageChange,
  onLookupBack,
  onSave,
  onCopy,
  onSearchWord,
  onSearchAi,
  canGoBack,
  savedWords,
  isSaving,
  error,
}) {
  const popupRef = useRef(null)
  const editorRef = useRef(null)
  const [position, setPosition] = useState(null)
  const [draftText, setDraftText] = useState('')
  const [joinSelection, setJoinSelection] = useState([])
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useLayoutEffect(() => {
    const popup = popupRef.current
    if (!popup || !selection) {
      setPosition(null)
      return
    }

    const margin = 16
    const offset = 12
    const rect = popup.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = selection.anchor.x + offset
    let top = selection.anchor.y + offset

    if (left + rect.width > viewportWidth - margin) {
      left = Math.max(margin, selection.anchor.x - rect.width - offset)
    }
    if (top + rect.height > viewportHeight - margin) {
      top = Math.max(margin, selection.anchor.y - rect.height - offset)
    }

    left = Math.min(left, viewportWidth - rect.width - margin)
    top = Math.min(top, viewportHeight - rect.height - margin)
    left = Math.max(margin, left)
    top = Math.max(margin, top)

    setPosition({ left, top })
  }, [selection, lookup, error, draftText, isEditorOpen, isKeyboardOpen, joinSelection.length])

  useEffect(() => {
    setDraftText(selection?.sourceText || '')
  }, [selection?.sourceText])

  useEffect(() => {
    setJoinSelection([])
    setIsEditorOpen(false)
    setIsKeyboardOpen(false)
  }, [selection?.boxId])

  if (!selection) {
    return null
  }

  const { anchor, words, sourceText } = selection
  const selectedWord = lookup?.word
  const isSaved = selectedWord ? savedWords.has(selectedWord) : false
  const isThaiReferenceFallback =
    lookup?.lang === 'en' &&
    lookup?.definitions?.length > 0 &&
    lookup.definitions.every((definition) => definition.pos === 'thai reference')
  const enableThaiCrossReference = lookup?.lang === 'th'
  const selectedJoinWords = joinSelection.map((index) => words[index]).filter(Boolean)

  function toggleJoinWord(index) {
    setJoinSelection((previous) =>
      previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index].sort((a, b) => a - b),
    )
  }

  async function applyJoinedWords(separator = '') {
    if (!selectedJoinWords.length) {
      return
    }

    const joined = selectedJoinWords.join(separator)
    setDraftText(joined)
    setIsEditorOpen(true)
    onSelectionTextChange(joined)
    await onResegmentSelection(joined, { preferredWords: [joined] })
  }

  function updateDraftText(nextValue) {
    setDraftText(nextValue)
    onSelectionTextChange(nextValue)
  }

  function insertAtCursor(textToInsert) {
    const editor = editorRef.current
    if (!editor) {
      updateDraftText(`${draftText}${textToInsert}`)
      return
    }

    const start = editor.selectionStart ?? draftText.length
    const end = editor.selectionEnd ?? draftText.length
    const nextValue = `${draftText.slice(0, start)}${textToInsert}${draftText.slice(end)}`
    const nextCaret = start + textToInsert.length

    updateDraftText(nextValue)

    requestAnimationFrame(() => {
      editor.focus()
      editor.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function deleteAtCursor() {
    const editor = editorRef.current
    if (!editor) {
      updateDraftText(draftText.slice(0, -1))
      return
    }

    const start = editor.selectionStart ?? draftText.length
    const end = editor.selectionEnd ?? draftText.length
    if (start !== end) {
      const nextValue = `${draftText.slice(0, start)}${draftText.slice(end)}`
      updateDraftText(nextValue)
      requestAnimationFrame(() => {
        editor.focus()
        editor.setSelectionRange(start, start)
      })
      return
    }

    if (start <= 0) {
      return
    }

    const nextValue = `${draftText.slice(0, start - 1)}${draftText.slice(end)}`
    const nextCaret = start - 1
    updateDraftText(nextValue)
    requestAnimationFrame(() => {
      editor.focus()
      editor.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <div
      ref={popupRef}
      className="word-popup"
      style={{
        left: `${position?.left ?? anchor.x}px`,
        top: `${position?.top ?? anchor.y}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="word-popup__section">
        <div className="word-popup__label">Lookup Words</div>
        <div className="word-popup__chips">
          {words.map((word) => (
            <button
              key={`${word}-${sourceText}`}
              className={`chip ${selectedWord === word ? 'is-active' : ''}`}
              onClick={() => onWordPick(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      <div className="word-popup__section">
        <button
          type="button"
          className="word-popup__toggle"
          onClick={() => setIsEditorOpen((previous) => !previous)}
        >
          <span>Edit / Re-Segment OCR</span>
          <span className="word-popup__toggle-indicator">{isEditorOpen ? 'Hide' : 'Show'}</span>
        </button>

        {isEditorOpen ? (
          <div className="word-popup__editor-panel">
            {words.length > 1 ? (
              <>
                <div className="word-popup__label word-popup__label--subtle">Combine Split Words</div>
                <div className="word-popup__chips">
                  {words.map((word, index) => (
                    <button
                      key={`${word}-${sourceText}-join-${index}`}
                      className={`chip chip--join ${joinSelection.includes(index) ? 'is-active' : ''}`}
                      onClick={() => toggleJoinWord(index)}
                    >
                      {word}
                    </button>
                  ))}
                </div>
                <div className="word-popup__actions word-popup__actions--editor">
                  <button
                    className="button button--secondary"
                    onClick={() => void applyJoinedWords('')}
                    disabled={!selectedJoinWords.length}
                  >
                    Combine Selected
                  </button>
                  <button
                    className="button button--secondary"
                    onClick={() => void applyJoinedWords(' ')}
                    disabled={selectedJoinWords.length < 2}
                  >
                    Combine With Space
                  </button>
                </div>
              </>
            ) : null}
            <textarea
              ref={editorRef}
              className="word-popup__editor"
              value={draftText}
              onFocus={() => setIsKeyboardOpen(true)}
              onClick={() => setIsKeyboardOpen(true)}
              onChange={(event) => {
                const nextValue = event.target.value
                updateDraftText(nextValue)
              }}
              rows={3}
              placeholder="Fix OCR text or combine words here"
            />
            <button
              type="button"
              className="word-popup__toggle word-popup__toggle--inner"
              onClick={() => setIsKeyboardOpen((previous) => !previous)}
            >
              <span>Thai Keyboard</span>
              <span className="word-popup__toggle-indicator">{isKeyboardOpen ? 'Hide' : 'Show'}</span>
            </button>
            {isKeyboardOpen ? (
              <div className="thai-keyboard">
                {THAI_KEYBOARD_ROWS.map((row, rowIndex) => (
                  <div key={`thai-row-${rowIndex}`} className="thai-keyboard__row">
                    {row.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="thai-keyboard__key"
                        onClick={() => insertAtCursor(key)}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="thai-keyboard__row thai-keyboard__row--actions">
                  <button type="button" className="thai-keyboard__key thai-keyboard__key--wide" onClick={() => insertAtCursor(' ')}>
                    Space
                  </button>
                  <button type="button" className="thai-keyboard__key thai-keyboard__key--wide" onClick={() => insertAtCursor('ๆ')}>
                    ๆ
                  </button>
                  <button type="button" className="thai-keyboard__key thai-keyboard__key--wide" onClick={() => insertAtCursor('ฯ')}>
                    ฯ
                  </button>
                  <button type="button" className="thai-keyboard__key thai-keyboard__key--wide thai-keyboard__key--danger" onClick={deleteAtCursor}>
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
            <div className="word-popup__actions word-popup__actions--editor">
              <button
                className="button button--secondary"
                onClick={() => onResegmentSelection(draftText)}
                disabled={!draftText.trim()}
              >
                Re-Segment / Update
              </button>
              <button
                className="button button--secondary"
                onClick={() => onLookupEditedText(draftText)}
                disabled={!draftText.trim()}
              >
                Lookup Full Text
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {lookup && (
        <div className="word-popup__section">
          <div className="word-popup__header">
            <div>
              {canGoBack ? (
                <button type="button" className="button button--secondary word-popup__back" onClick={onLookupBack}>
                  Back
                </button>
              ) : null}
              <h3>{lookup.word}</h3>
              <p>{lookup.transliteration || 'No transliteration available'}</p>
            </div>
            <div className="lang-toggle word-popup__lang-toggle" role="tablist" aria-label="Popup dictionary language">
              <button
                className={`lang-toggle__button ${lookup.lang === 'en' ? 'is-active' : ''}`}
                onClick={() => onLookupLanguageChange('en')}
              >
                EN
              </button>
              <button
                className={`lang-toggle__button ${lookup.lang === 'th' ? 'is-active' : ''}`}
                onClick={() => onLookupLanguageChange('th')}
              >
                TH
              </button>
            </div>
          </div>

          {lookup.found ? (
            <>
              {isThaiReferenceFallback ? (
                <div className="word-popup__notice">
                  English definition not found. Showing Thai reference entries instead.
                </div>
              ) : null}
              <div className="definition-list">
                {lookup.definitions.map((definition, index) => (
                  <div key={`${definition.pos}-${index}`} className="definition-list__item">
                    <span>{definition.pos}</span>
                    <p>
                      {renderDefinitionMeaning(definition.meaning, {
                        enabled: enableThaiCrossReference,
                        onPickWord: onWordPick,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">No offline definition found for this word yet.</p>
          )}

          <div className="word-popup__context">
            <div className="word-popup__label">Context</div>
            <p>{sourceText}</p>
          </div>

          <div className="word-popup__actions">
            <button className="button" onClick={onSave} disabled={!lookup.found || isSaved || isSaving}>
              {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save to Vocab'}
            </button>
            <button className="button button--secondary" onClick={() => onCopy(lookup.word)}>
              Copy
            </button>
            <button className="button button--secondary" onClick={() => onSearchWord(lookup.word)}>
              Search Web
            </button>
            <button className="button button--secondary" onClick={() => onSearchAi(lookup.word)}>
              Search AI
            </button>
          </div>
          {error ? <div className="inline-error">{error}</div> : null}
        </div>
      )}
    </div>
  )
}

function renderDefinitionMeaning(meaning, { enabled, onPickWord }) {
  if (!enabled) {
    return meaning
  }

  const parts = meaning.split(/([\u0E00-\u0E7F]+)/g)
  return parts.map((part, index) => {
    if (!/^[\u0E00-\u0E7F]+$/.test(part)) {
      return <span key={`${part}-${index}`}>{part}</span>
    }

    return (
      <button
        key={`${part}-${index}`}
        type="button"
        className="definition-link"
        onClick={() => onPickWord(part)}
      >
        {part}
      </button>
    )
  })
}

export default WordPopup
