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

        {currentBook ? (
          <article className="library-card library-card--hero is-active">
            <div className="library-card__hero">
              <div className="library-card__cover">
                {currentBook.coverImageUrl ? (
                  <img src={resolveAssetUrl(currentBook.coverImageUrl)} alt="" />
                ) : (
                  <div className="library-card__cover-fallback">{currentBook.type.toUpperCase()}</div>
                )}
              </div>
              <div className="library-card__hero-copy">
                <span className="badge badge--ok">Currently Reading</span>
                <strong>{currentBook.title}</strong>
                <p>
                  Page {currentBook.lastPage || 1}
                  {currentBook.totalPages ? ` of ${currentBook.totalPages}` : ''}
                </p>
                <p>{currentBook.progressLabel}</p>
                <p>{currentBook.lastOpenedLabel}</p>
              </div>
            </div>
            <div className="library-card__actions">
              <button className="button button--secondary" onClick={() => onResumeBook(currentBook)} disabled={isLibraryBusy}>
                Resume
              </button>
              <button className="button button--ghost" onClick={() => onRestartBook(currentBook)} disabled={isLibraryBusy}>
                Start Over
              </button>
            </div>
          </article>
        ) : null}

        <div className="sidebar__list sidebar__list--library">
          {libraryItems.length === 0 ? (
            <div className="sidebar__empty">Books you open in the app will appear here with their last page.</div>
          ) : (
            shelfBooks.map((item) => (
              <article key={item.id} className={`library-card ${activeLibraryItemId === item.id ? 'is-active' : ''}`}>
                <div className="library-card__header">
                  <strong>{item.title}</strong>
                  <span>{item.type.toUpperCase()}</span>
                </div>
                <p>
                  Resume from page {item.lastPage || 1}
                  {item.totalPages ? ` of ${item.totalPages}` : ''}
                </p>
                <p>{item.lastOpenedLabel}</p>
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
            <div className="sidebar__empty">Saved words will appear here.</div>
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
