function VocabSidebar({
  items,
  search,
  onSearchChange,
  onDelete,
  onExport,
  isExporting,
  libraryItems,
  activeLibraryItemId,
  onResumeBook,
  onRestartBook,
  onRemoveBook,
  isLibraryBusy,
  resolveAssetUrl,
  onToggleCollapse,
}) {
  const currentBook = libraryItems.find((item) => item.isActive)
  const shelfBooks = libraryItems.filter((item) => !item.isActive)

  return (
    <aside className="sidebar">
      <section className="sidebar__section sidebar__section--library">
        <div className="sidebar__header">
          <h2>Library</h2>
          <p>{libraryItems.length} saved</p>
          <button className="button button--ghost sidebar__collapse" onClick={onToggleCollapse}>
            Hide Panel
          </button>
        </div>

        <div className="sidebar__list sidebar__list--library">
          {libraryItems.length === 0 ? (
            <div className="sidebar__empty">Books you open will appear here so you can jump back in where you left off.</div>
          ) : (
            [currentBook, ...shelfBooks].filter(Boolean).map((item) => (
              <article key={item.id} className={`library-card ${activeLibraryItemId === item.id ? 'is-active' : ''}`}>
                <div className="library-card__row">
                  <div className="library-card__cover library-card__cover--small">
                    {item.coverImageUrl ? (
                      <img
                        src={resolveAssetUrl(item.coverImageUrl)}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                          const fallback = event.currentTarget.parentElement?.querySelector('.library-card__cover-fallback')
                          if (fallback) {
                            fallback.removeAttribute('hidden')
                          }
                        }}
                      />
                    ) : (
                      <div className="library-card__cover-fallback">{item.type.toUpperCase()}</div>
                    )}
                    {item.coverImageUrl ? (
                      <div className="library-card__cover-fallback" hidden>
                        {item.type.toUpperCase()}
                      </div>
                    ) : null}
                  </div>
                  <div className="library-card__content">
                    {item.isActive ? <span className="badge badge--ok">Current</span> : null}
                    <div className="library-card__header">
                      <strong>{item.title}</strong>
                      <span>{item.type.toUpperCase()}</span>
                    </div>
                    <p>
                      Resume from page {item.lastPage || 1}
                      {item.totalPages ? ` of ${item.totalPages}` : ''}
                    </p>
                    <p>{item.progressLabel}</p>
                    <p>{item.lastOpenedLabel}</p>
                  </div>
                </div>
                <div className="library-card__actions">
                  <button className="button button--secondary" onClick={() => onResumeBook(item)} disabled={isLibraryBusy}>
                    Resume
                  </button>
                  <button className="button button--ghost" onClick={() => onRestartBook(item)} disabled={isLibraryBusy}>
                    Start Over
                  </button>
                  <button className="button button--ghost button--danger" onClick={() => onRemoveBook(item.id)} disabled={isLibraryBusy}>
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="sidebar__section sidebar__section--grow">
        <div className="sidebar__header">
          <h2>Vocabulary</h2>
          <p>{items.length} saved</p>
        </div>

        <input
          className="sidebar__search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search saved words"
        />

        <div className="sidebar__list">
          {items.length === 0 ? (
            <div className="sidebar__empty">Words you save from OCR lookups will appear here.</div>
          ) : (
            items.map((item) => (
              <details key={item.id} className="vocab-card">
                <summary>
                  <div>
                    <strong>{item.word}</strong>
                    <span>{item.definition_lang.toUpperCase()}</span>
                  </div>
                </summary>
                <p>{item.definition || 'No definition saved.'}</p>
                {item.context_sentence ? <p className="vocab-card__context">{item.context_sentence}</p> : null}
                <button
                  className="button button--ghost button--danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${item.word}" from vocab?`)) {
                      onDelete(item.id)
                    }
                  }}
                >
                  Delete
                </button>
              </details>
            ))
          )}
        </div>

        <button className="button sidebar__export" onClick={onExport} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Export to Anki CSV'}
        </button>
      </section>
    </aside>
  )
}

export default VocabSidebar
