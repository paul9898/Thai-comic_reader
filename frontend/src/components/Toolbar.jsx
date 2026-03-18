function Toolbar({
  appName,
  onOpenPdf,
  onOpenImage,
  onRunOcr,
  onToggleAutoOcr,
  onToggleHelp,
  onToggleSettings,
  onToggleRegionMode,
  onToggleAiMode,
  onPrevPage,
  onNextPage,
  canRunOcr,
  pageNum,
  totalPages,
  dictionaryLang,
  onDictionaryLangChange,
  aiProviderLabel,
  isBusy,
  isHelpOpen,
  isSettingsOpen,
  isAutoOcrEnabled,
  selectionMode,
  usesNativePicker,
}) {
  return (
    <header className="toolbar">
      <div className="toolbar__group">
        <div className="toolbar__brand">
          <span className="toolbar__eyebrow">Cross-platform baseline</span>
          <strong>{appName}</strong>
        </div>
        {usesNativePicker ? (
          <>
            <button className="button button--file" onClick={onOpenPdf}>
              Open PDF
            </button>
            <button className="button button--file button--secondary" onClick={onOpenImage}>
              Open Image
            </button>
          </>
        ) : (
          <>
            <label className="button button--file">
              <input type="file" accept="application/pdf" onChange={onOpenPdf} hidden />
              Open PDF
            </label>
            <label className="button button--file button--secondary">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onOpenImage} hidden />
              Open Image
            </label>
          </>
        )}
      </div>

      <div className="toolbar__group toolbar__group--center">
        <button className="button button--ghost" onClick={onPrevPage} disabled={pageNum <= 1}>
          {'<'}
        </button>
        <div className="toolbar__pager">
          Page {pageNum || 0} of {totalPages || 0}
        </div>
        <button className="button button--ghost" onClick={onNextPage} disabled={pageNum >= totalPages}>
          {'>'}
        </button>
      </div>

      <div className="toolbar__group">
        <div className="lang-toggle" role="tablist" aria-label="Dictionary language">
          <button
            className={`lang-toggle__button ${dictionaryLang === 'en' ? 'is-active' : ''}`}
            onClick={() => onDictionaryLangChange('en')}
          >
            EN
          </button>
          <button
            className={`lang-toggle__button ${dictionaryLang === 'th' ? 'is-active' : ''}`}
            onClick={() => onDictionaryLangChange('th')}
          >
            TH
          </button>
        </div>
        <button
          className={`button button--ghost ${isAutoOcrEnabled ? 'button--active' : ''}`}
          onClick={onToggleAutoOcr}
          title="Automatically run OCR when you open or change to a new page"
        >
          {isAutoOcrEnabled ? 'Auto OCR On' : 'Auto OCR Off'}
        </button>
        <button
          className={`button button--ghost ${isHelpOpen ? 'button--active' : ''}`}
          onClick={onToggleHelp}
          title="Shortcut: ?"
        >
          Help
        </button>
        <button
          className={`button button--ghost ${isSettingsOpen ? 'button--active' : ''}`}
          onClick={onToggleSettings}
          title="App settings"
        >
          Settings
        </button>
        <button
          className={`button button--secondary ${selectionMode === 'ocr' ? 'button--active' : ''}`}
          onClick={onToggleRegionMode}
          disabled={!canRunOcr || isBusy}
          title="Shortcut: R"
        >
          {selectionMode === 'ocr' ? 'Cancel Region' : 'OCR Region (R)'}
        </button>
        <button
          className={`button button--secondary ${selectionMode === 'ai' ? 'button--active' : ''}`}
          onClick={onToggleAiMode}
          disabled={!canRunOcr || isBusy}
          title="Shortcut: G"
        >
          {selectionMode === 'ai' ? 'Cancel AI' : `Ask ${aiProviderLabel} (G)`}
        </button>
        <button className="button" onClick={onRunOcr} disabled={!canRunOcr || isBusy} title="Shortcut: O">
          {isBusy ? 'Working...' : 'Run OCR (O)'}
        </button>
      </div>
    </header>
  )
}

export default Toolbar
