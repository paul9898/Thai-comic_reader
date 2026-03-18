import { useEffect, useRef, useState } from 'react'

function ComicViewer({
  page,
  pageImageSrc,
  boxes,
  selectedBoxId,
  onSelectBox,
  onClosePopups,
  selectionMode,
  onRegionSelect,
  isBusy,
  children,
}) {
  const imageRef = useRef(null)
  const overlayRef = useRef(null)
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 })
  const [dragRect, setDragRect] = useState(null)

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return undefined
    }

    const updateSize = () => {
      setRenderSize({
        width: image.clientWidth,
        height: image.clientHeight,
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [page?.image_url])

  if (!page) {
    return (
      <section className="viewer viewer--empty">
        <div className="viewer__empty-card">
          <h2>Thai Comic Reader Basic</h2>
          <p>Open a PDF or image to start reading with offline OCR, region capture, and dictionary lookup.</p>
        </div>
      </section>
    )
  }

  const scaleX = renderSize.width && page.width ? renderSize.width / page.width : 1
  const scaleY = renderSize.height && page.height ? renderSize.height / page.height : 1

  const pointerToImageSpace = (event) => {
    const overlay = overlayRef.current
    if (!overlay || !page) {
      return null
    }

    const rect = overlay.getBoundingClientRect()
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))

    return {
      clientX: event.clientX,
      clientY: event.clientY,
      displayX: x,
      displayY: y,
      imageX: Math.round(x / scaleX),
      imageY: Math.round(y / scaleY),
    }
  }

  const beginRegionSelection = (event) => {
    if (!selectionMode || isBusy) {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    overlayRef.current?.setPointerCapture?.(event.pointerId)
    const point = pointerToImageSpace(event)
    if (!point) {
      return
    }
    setDragRect({
      startDisplayX: point.displayX,
      startDisplayY: point.displayY,
      currentDisplayX: point.displayX,
      currentDisplayY: point.displayY,
      startImageX: point.imageX,
      startImageY: point.imageY,
    })
  }

  const updateRegionSelection = (event) => {
    if (!dragRect) {
      return
    }
    event.preventDefault()
    const point = pointerToImageSpace(event)
    if (!point) {
      return
    }
    setDragRect((previous) =>
      previous
        ? {
            ...previous,
            currentDisplayX: point.displayX,
            currentDisplayY: point.displayY,
            currentImageX: point.imageX,
            currentImageY: point.imageY,
          }
        : previous,
    )
  }

  const finishRegionSelection = (event) => {
    if (!dragRect) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    overlayRef.current?.releasePointerCapture?.(event.pointerId)
    const point = pointerToImageSpace(event)
    const endImageX = point?.imageX ?? dragRect.currentImageX ?? dragRect.startImageX
    const endImageY = point?.imageY ?? dragRect.currentImageY ?? dragRect.startImageY
    const x = Math.min(dragRect.startImageX, endImageX)
    const y = Math.min(dragRect.startImageY, endImageY)
    const width = Math.abs(endImageX - dragRect.startImageX)
    const height = Math.abs(endImageY - dragRect.startImageY)
    setDragRect(null)

    if (width < 20 || height < 20) {
      return
    }
    onRegionSelect({
      x,
      y,
      width,
      height,
      anchor: {
        x: event.clientX,
        y: event.clientY,
      },
    })
  }

  const regionStyle = dragRect
    ? {
        left: `${Math.min(dragRect.startDisplayX, dragRect.currentDisplayX ?? dragRect.startDisplayX)}px`,
        top: `${Math.min(dragRect.startDisplayY, dragRect.currentDisplayY ?? dragRect.startDisplayY)}px`,
        width: `${Math.abs((dragRect.currentDisplayX ?? dragRect.startDisplayX) - dragRect.startDisplayX)}px`,
        height: `${Math.abs((dragRect.currentDisplayY ?? dragRect.startDisplayY) - dragRect.startDisplayY)}px`,
      }
    : null

  return (
    <section className="viewer" onClick={onClosePopups}>
      <div className="viewer__stage">
        <img
          ref={imageRef}
          className="viewer__image"
          src={pageImageSrc}
          alt={`Comic page ${page.page_num}`}
          onLoad={() =>
            setRenderSize({
              width: imageRef.current?.clientWidth ?? 0,
              height: imageRef.current?.clientHeight ?? 0,
            })
          }
        />
        <div
          ref={overlayRef}
          className={`viewer__overlay-layer ${selectionMode ? 'is-region-mode' : ''}`}
          onPointerDown={beginRegionSelection}
          onPointerMove={updateRegionSelection}
          onPointerUp={finishRegionSelection}
          onPointerCancel={finishRegionSelection}
        >
          {boxes.map((box) => {
            const [xMin, yMin, xMax, yMax] = box.bbox
            return (
              <button
                key={box.id}
                type="button"
                className={`ocr-box ${selectedBoxId === box.id ? 'is-selected' : ''}`}
                style={{
                  left: `${xMin * scaleX}px`,
                  top: `${yMin * scaleY}px`,
                  width: `${(xMax - xMin) * scaleX}px`,
                  height: `${(yMax - yMin) * scaleY}px`,
                }}
                onClick={(event) => {
                  if (selectionMode) {
                    return
                  }
                  event.stopPropagation()
                  onSelectBox(box, { x: event.clientX, y: event.clientY })
                }}
                title={box.text}
              />
            )
          })}
          {regionStyle ? <div className="ocr-region-selection" style={regionStyle} /> : null}
          {children}
        </div>
      </div>
    </section>
  )
}

export default ComicViewer
