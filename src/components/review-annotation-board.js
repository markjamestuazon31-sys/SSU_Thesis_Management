const MAX_DATA_URL_LENGTH = 480000;
const MAX_RENDER_WIDTH = 1600;
const MAX_RENDER_HEIGHT = 2200;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

function pointFor(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function canvasDimensions(source) {
  const sourceWidth = Number(source.naturalWidth || source.width || 1);
  const sourceHeight = Number(source.naturalHeight || source.height || 1);
  const scale = Math.min(1, MAX_RENDER_WIDTH / sourceWidth, MAX_RENDER_HEIGHT / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function extensionFor(name) {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
}

function formatBytes(bytes = 0) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / (1024 ** index);
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

async function waitForImages(container) {
  const pending = [...container.querySelectorAll('img')]
    .filter((image) => !image.complete)
    .map((image) => new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }));
  await Promise.all(pending);
}

export function initReviewAnnotationBoard({
  canvasId = 'review-annotation-canvas',
  workspaceId = 'annotation-workspace',
  openId = 'annotation-open-fullscreen',
  closeId = 'annotation-close-fullscreen',
  pageLabelId = 'annotation-page-label',
  pageIndicatorId = 'annotation-page-indicator',
  fileNameId = 'annotation-file-name',
  headerFileNameId = 'annotation-header-file-name',
  statusId = 'annotation-viewer-status',
  statusSpinnerId = 'annotation-status-spinner',
  statusTitleId = 'annotation-status-title',
  statusDetailId = 'annotation-status-detail',
  statusProgressId = 'annotation-load-progress',
  statusProgressBarId = 'annotation-load-progress-bar',
  retryId = 'annotation-retry',
  canvasShellId = 'annotation-canvas-shell',
  docxSourceId = 'annotation-docx-source',
  toolbarSelector = '[data-annotation-tool]',
  previousId = 'annotation-previous-page',
  nextId = 'annotation-next-page',
  undoId = 'annotation-undo',
  clearId = 'annotation-clear',
  colorId = 'annotation-color',
  widthId = 'annotation-width',
  zoomOutId = 'annotation-zoom-out',
  zoomInId = 'annotation-zoom-in',
  zoomFitId = 'annotation-zoom-fit',
  zoomLabelId = 'annotation-zoom-label',
  modeNoteId = 'annotation-mode-note',
} = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;

  const workspace = document.getElementById(workspaceId);
  const openButton = document.getElementById(openId);
  const closeButton = document.getElementById(closeId);
  const pageLabel = document.getElementById(pageLabelId);
  const pageIndicator = document.getElementById(pageIndicatorId);
  const fileName = document.getElementById(fileNameId);
  const headerFileName = document.getElementById(headerFileNameId);
  const status = document.getElementById(statusId);
  const statusSpinner = document.getElementById(statusSpinnerId);
  const statusTitle = document.getElementById(statusTitleId);
  const statusDetail = document.getElementById(statusDetailId);
  const statusProgress = document.getElementById(statusProgressId);
  const statusProgressBar = document.getElementById(statusProgressBarId);
  const retryButton = document.getElementById(retryId);
  const canvasShell = document.getElementById(canvasShellId);
  const docxSource = document.getElementById(docxSourceId);
  const previous = document.getElementById(previousId);
  const next = document.getElementById(nextId);
  const color = document.getElementById(colorId);
  const width = document.getElementById(widthId);
  const undo = document.getElementById(undoId);
  const clear = document.getElementById(clearId);
  const zoomOut = document.getElementById(zoomOutId);
  const zoomIn = document.getElementById(zoomInId);
  const zoomFit = document.getElementById(zoomFitId);
  const zoomLabel = document.getElementById(zoomLabelId);
  const modeNote = document.getElementById(modeNoteId);
  const toolButtons = [...document.querySelectorAll(toolbarSelector)];

  const operations = [];
  let active = null;
  let background = null;
  let tool = 'circle';
  let documentKind = '';
  let sourceMetadata = null;
  let pdfDocument = null;
  let pdfObjectUrl = '';
  let docxPages = [];
  let pageNumber = 1;
  let pageCount = 0;
  let rendering = false;
  let loaded = false;
  let markupEnabled = false;
  let destroyed = false;
  let renderSequence = 0;
  let restoreFocus = null;
  let zoomMode = 'fit';
  let customZoom = 1;
  let currentDisplayScale = 1;

  function setSourceMetadata(metadata = {}) {
    const hasMetadata = Object.values(metadata || {}).some((value) => value !== '' && value !== null && value !== undefined && value !== 0);
    if (hasMetadata) sourceMetadata = { ...(sourceMetadata || {}), ...metadata };
    const existingName = fileName?.textContent?.trim() || headerFileName?.textContent?.trim();
    const name = sourceMetadata?.name || existingName || 'Student manuscript';
    if (fileName) fileName.textContent = name;
    if (headerFileName) headerFileName.textContent = name;
  }

  function setStatus({
    message,
    detail = '',
    state = 'loading',
    percent = null,
    retry = false,
  }) {
    if (status) {
      status.hidden = false;
      status.dataset.state = state;
    }
    if (statusSpinner) statusSpinner.hidden = state !== 'loading';
    if (statusTitle) statusTitle.textContent = String(message || 'Preparing manuscript…');
    if (statusDetail) {
      statusDetail.textContent = String(detail || '');
      statusDetail.hidden = !detail;
    }
    const hasProgress = Number.isFinite(Number(percent));
    if (statusProgress) statusProgress.hidden = !hasProgress;
    if (statusProgressBar) {
      statusProgressBar.style.width = `${clamp(Number(percent) || 0, 0, 100)}%`;
    }
    if (retryButton) retryButton.hidden = !retry;
    if (canvasShell) canvasShell.hidden = true;
  }

  function showCanvas() {
    if (status) status.hidden = true;
    if (canvasShell) canvasShell.hidden = false;
  }

  function fitScale() {
    if (!canvasShell || !canvas.width) return 1;
    const shellStyle = getComputedStyle(canvasShell);
    const horizontalPadding = (Number.parseFloat(shellStyle.paddingLeft) || 0)
      + (Number.parseFloat(shellStyle.paddingRight) || 0);
    const availableWidth = Math.max(1, canvasShell.clientWidth - horizontalPadding - 2);
    return Math.min(1, availableWidth / canvas.width);
  }

  function applyZoom() {
    if (!background || !canvas.width) return;
    currentDisplayScale = zoomMode === 'fit'
      ? fitScale()
      : clamp(customZoom, MIN_ZOOM, MAX_ZOOM);
    canvas.style.width = `${Math.max(1, Math.round(canvas.width * currentDisplayScale))}px`;
    canvas.style.height = 'auto';
    if (zoomLabel) zoomLabel.textContent = `${Math.round(currentDisplayScale * 100)}%`;
    zoomFit?.classList.toggle('active', zoomMode === 'fit');
  }

  function updateControls() {
    const viewerUnavailable = !loaded || rendering || !background;
    const drawingUnavailable = viewerUnavailable || !markupEnabled;
    toolButtons.forEach((button) => { button.disabled = drawingUnavailable; });
    if (color) color.disabled = drawingUnavailable;
    if (width) width.disabled = drawingUnavailable;
    if (undo) undo.disabled = drawingUnavailable || operations.length === 0;
    if (clear) clear.disabled = drawingUnavailable || operations.length === 0;
    if (zoomOut) zoomOut.disabled = viewerUnavailable;
    if (zoomIn) zoomIn.disabled = viewerUnavailable;
    if (zoomFit) zoomFit.disabled = viewerUnavailable;
    canvas.classList.toggle('annotation-readonly', !markupEnabled);
    if (modeNote) {
      modeNote.dataset.enabled = String(markupEnabled);
      modeNote.textContent = markupEnabled
        ? 'Markup mode is active. Draw only on the page areas that require revision.'
        : 'Read-only preview. Select “Request Revision” to enable circles, highlights, and freehand marks.';
    }
  }

  function updatePageControls() {
    const label = pageCount ? `Page ${pageNumber} of ${pageCount}` : 'Preparing manuscript…';
    if (pageIndicator) pageIndicator.textContent = label;
    if (pageLabel) pageLabel.value = pageCount
      ? `${label} — ${sourceMetadata?.name || 'Student manuscript'}`
      : '';
    if (previous) previous.disabled = rendering || pageNumber <= 1;
    if (next) next.disabled = rendering || !pageCount || pageNumber >= pageCount;
    updateControls();
  }

  function drawOperation(operation) {
    const strokeWidth = Number(operation.width || 5);
    context.save();
    context.strokeStyle = operation.color;
    context.lineWidth = operation.tool === 'highlight' ? strokeWidth * 4 : strokeWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = operation.tool === 'highlight' ? 0.28 : 1;
    context.beginPath();
    if (operation.tool === 'circle') {
      const centerX = (operation.start.x + operation.end.x) / 2;
      const centerY = (operation.start.y + operation.end.y) / 2;
      context.ellipse(
        centerX,
        centerY,
        Math.abs(operation.end.x - operation.start.x) / 2,
        Math.abs(operation.end.y - operation.start.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else {
      operation.points.forEach((point, index) => {
        if (index) context.lineTo(point.x, point.y);
        else context.moveTo(point.x, point.y);
      });
    }
    context.stroke();
    context.restore();
  }

  function render() {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (background) context.drawImage(background, 0, 0, canvas.width, canvas.height);
    operations.forEach(drawOperation);
    if (active) drawOperation(active);
    updateControls();
  }

  function useBackground(source) {
    const dimensions = canvasDimensions(source);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    background = source;
    zoomMode = 'fit';
    render();
    showCanvas();
    requestAnimationFrame(applyZoom);
  }

  function setTool(nextTool) {
    tool = nextTool;
    toolButtons.forEach((button) => {
      const selected = button.dataset.annotationTool === nextTool;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function pointerDown(event) {
    if (!markupEnabled || !loaded || rendering || !background) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const start = pointFor(canvas, event);
    active = {
      tool,
      color: String(color?.value || '#d7263d'),
      width: Number(width?.value || 6),
      start,
      end: start,
      points: [start],
    };
  }

  function pointerMove(event) {
    if (!active) return;
    event.preventDefault();
    const point = pointFor(canvas, event);
    active.end = point;
    if (active.tool !== 'circle') active.points.push(point);
    render();
  }

  function pointerUp(event) {
    if (!active) return;
    const point = pointFor(canvas, event);
    active.end = point;
    if (active.tool !== 'circle') active.points.push(point);
    const distance = Math.hypot(active.end.x - active.start.x, active.end.y - active.start.y);
    if (distance >= 3 || active.points.length > 3) operations.push(active);
    active = null;
    render();
  }

  async function renderPdfPage(number) {
    const page = await pdfDocument.getPage(number);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2.5,
      MAX_RENDER_WIDTH / unscaled.width,
      MAX_RENDER_HEIGHT / unscaled.height,
    );
    const viewport = page.getViewport({ scale });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.max(1, Math.floor(viewport.width));
    pageCanvas.height = Math.max(1, Math.floor(viewport.height));
    const pageContext = pageCanvas.getContext('2d', { alpha: false });
    if (!pageContext) throw new Error('The PDF page canvas could not be created.');
    pageContext.fillStyle = '#ffffff';
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    await page.render({ canvasContext: pageContext, viewport }).promise;
    return pageCanvas;
  }

  async function renderDocxPage(number) {
    const page = docxPages[number - 1];
    if (!page) throw new Error('The selected DOCX page is unavailable.');
    const module = await import('html2canvas');
    const html2canvas = module.default;
    return html2canvas(page, {
      backgroundColor: '#ffffff',
      logging: false,
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      foreignObjectRendering: false,
      width: Math.max(page.scrollWidth, page.clientWidth),
      height: Math.max(page.scrollHeight, page.clientHeight),
      windowWidth: Math.max(page.scrollWidth, page.clientWidth),
      windowHeight: Math.max(page.scrollHeight, page.clientHeight),
      scrollX: 0,
      scrollY: 0,
    });
  }

  async function renderPage(number, { discardMarks = false } = {}) {
    if (!pageCount || rendering) return false;
    const target = Math.min(pageCount, Math.max(1, Number(number) || 1));
    if (target !== pageNumber && operations.length && !discardMarks) {
      const confirmed = window.confirm('Changing pages will clear the visual marks on this page. Continue?');
      if (!confirmed) return false;
    }

    const sequence = ++renderSequence;
    rendering = true;
    operations.splice(0);
    active = null;
    pageNumber = target;
    updatePageControls();
    setStatus({
      message: `Rendering page ${pageNumber} of ${pageCount}…`,
      detail: 'The complete page is being prepared without cropping the uploaded manuscript.',
      state: 'loading',
    });

    try {
      const pageCanvas = documentKind === 'pdf'
        ? await renderPdfPage(pageNumber)
        : await renderDocxPage(pageNumber);
      if (destroyed || sequence !== renderSequence) return false;
      useBackground(pageCanvas);
      return true;
    } catch (error) {
      if (!destroyed && sequence === renderSequence) {
        setStatus({
          message: error.message || 'This manuscript page could not be rendered.',
          detail: 'The original upload is unchanged. Retry opening the manuscript or download the original file.',
          state: 'error',
          retry: true,
        });
      }
      throw error;
    } finally {
      if (sequence === renderSequence) {
        rendering = false;
        updatePageControls();
      }
    }
  }

  async function loadPdf(blob) {
    let pdfjs;
    let workerModule;

    try {
      [pdfjs, workerModule] = await Promise.all([
        import('pdfjs-dist/build/pdf.mjs'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
    } catch (error) {
      console.error('PDF.js failed to load.', error);
      throw new Error('The PDF preview module is unavailable. Run npm run repair:pdfjs, rebuild the app, and try again.');
    }

    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    pdfObjectUrl = URL.createObjectURL(blob);
    pdfDocument = await pdfjs.getDocument({
      url: pdfObjectUrl,
      enableXfa: true,
      isEvalSupported: false,
    }).promise;
    pageCount = Number(pdfDocument.numPages || 0);
    if (!pageCount) throw new Error('No readable pages were found in the PDF manuscript.');
  }

  async function loadDocx(blob) {
    if (!docxSource) throw new Error('The DOCX preview workspace is unavailable.');
    const { renderAsync } = await import('docx-preview');
    docxSource.replaceChildren();
    await renderAsync(blob, docxSource, null, {
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      useBase64URL: true,
      experimental: true,
    });
    await document.fonts?.ready;
    await waitForImages(docxSource);
    docxPages = [...docxSource.querySelectorAll('section.docx')];
    if (!docxPages.length) {
      const fallback = docxSource.querySelector('.docx') || docxSource.firstElementChild;
      if (fallback) docxPages = [fallback];
    }
    pageCount = docxPages.length;
    if (!pageCount) throw new Error('No readable pages were found in the DOCX manuscript.');
  }

  async function loadManuscript({ blob, metadata }) {
    if (!(blob instanceof Blob)) throw new Error('The student manuscript could not be opened.');
    setSourceMetadata(metadata || {});
    const extension = extensionFor(sourceMetadata?.name);
    documentKind = extension === 'pdf' || /pdf/i.test(sourceMetadata?.type || blob.type)
      ? 'pdf'
      : extension === 'docx' || /wordprocessingml/i.test(sourceMetadata?.type || blob.type)
        ? 'docx'
        : '';
    if (!documentKind) throw new Error('Only PDF and DOCX manuscripts can be reviewed visually.');

    loaded = false;
    operations.splice(0);
    active = null;
    background = null;
    pageNumber = 1;
    pageCount = 0;
    docxPages = [];
    renderSequence += 1;
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    pdfObjectUrl = '';
    await pdfDocument?.destroy?.();
    pdfDocument = null;
    updatePageControls();
    setStatus({
      message: `Opening the original ${documentKind.toUpperCase()} manuscript…`,
      detail: `${sourceMetadata?.name || 'Student manuscript'} • ${formatBytes(sourceMetadata?.size || blob.size)}`,
      state: 'loading',
      percent: 100,
    });

    try {
      if (documentKind === 'pdf') await loadPdf(blob);
      else await loadDocx(blob);
      if (destroyed) return;
      loaded = true;
      await renderPage(1, { discardMarks: true });
    } catch (error) {
      loaded = false;
      setStatus({
        message: error.message || 'The manuscript preview could not be created.',
        detail: 'The original uploaded file has not been changed. Retry or download the original manuscript.',
        state: 'error',
        retry: true,
      });
      throw error;
    } finally {
      updatePageControls();
    }
  }

  function openFullscreen() {
    if (!workspace || !workspace.hidden) return;
    restoreFocus = document.activeElement;
    workspace.hidden = false;
    document.body.classList.add('annotation-workspace-open');
    workspace.focus();
    requestAnimationFrame(applyZoom);
  }

  function closeFullscreen() {
    if (!workspace || workspace.hidden) return;
    workspace.hidden = true;
    document.body.classList.remove('annotation-workspace-open');
    restoreFocus?.focus?.();
    restoreFocus = null;
  }

  function exportDataUrl() {
    render();
    let scale = Math.min(1, 1200 / canvas.width, 1600 / canvas.height);
    let quality = 0.84;
    let result = '';
    let exportWidth = 0;
    let exportHeight = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      exportWidth = Math.max(200, Math.round(canvas.width * scale));
      exportHeight = Math.max(200, Math.round(canvas.height * scale));
      const output = document.createElement('canvas');
      output.width = exportWidth;
      output.height = exportHeight;
      const outputContext = output.getContext('2d', { alpha: false });
      if (!outputContext) throw new Error('The visual markup image could not be created.');
      outputContext.drawImage(canvas, 0, 0, exportWidth, exportHeight);
      result = output.toDataURL('image/jpeg', quality);
      if (result.length <= MAX_DATA_URL_LENGTH) break;
      quality = Math.max(0.48, quality - 0.08);
      scale *= 0.88;
    }
    if (result.length > MAX_DATA_URL_LENGTH) {
      throw new Error('The visual markup is too large. Clear some marks and try again.');
    }
    return { dataUrl: result, mimeType: 'image/jpeg', width: exportWidth, height: exportHeight };
  }

  function setMarkupEnabled(enabled) {
    markupEnabled = Boolean(enabled);
    if (!markupEnabled) active = null;
    updateControls();
    render();
  }

  function setTransferProgress(progress = {}) {
    if (progress.metadata) setSourceMetadata(progress.metadata);
    const percent = Number.isFinite(Number(progress.percent)) ? Number(progress.percent) : null;
    const total = Number(progress.totalBytes || progress.metadata?.size || 0);
    const loadedBytes = Number(progress.loadedBytes || 0);
    const detail = total > 0
      ? `${formatBytes(Math.min(loadedBytes, total))} of ${formatBytes(total)} loaded`
      : 'Checking the uploaded file record in Firebase Realtime Database…';
    const messages = {
      metadata: 'Checking the uploaded manuscript…',
      download: 'Loading the actual student manuscript…',
      assemble: 'Reconstructing the exact uploaded file…',
      ready: 'Original manuscript loaded. Preparing the first page…',
    };
    setStatus({
      message: messages[progress.phase] || 'Preparing the student manuscript…',
      detail,
      state: 'loading',
      percent,
    });
  }

  function showLoadError(message, detail = '') {
    loaded = false;
    updateControls();
    setStatus({
      message: message || 'The manuscript could not be opened.',
      detail: detail || 'Retry the load. The original student upload remains unchanged.',
      state: 'error',
      retry: true,
    });
  }

  function prepareManuscript(metadata = {}) {
    setSourceMetadata(metadata);
    setStatus({
      message: 'Open the actual student manuscript to begin reviewing.',
      detail: metadata?.name
        ? `${metadata.name}${metadata.size ? ` • ${formatBytes(metadata.size)}` : ''}`
        : 'The original PDF or DOCX will be loaded directly from the student submission.',
      state: 'info',
    });
  }

  const toolHandlers = toolButtons.map((button) => {
    const handler = () => setTool(button.dataset.annotationTool || 'circle');
    button.addEventListener('click', handler);
    return [button, handler];
  });
  const previousHandler = () => renderPage(pageNumber - 1).catch((error) => showLoadError(error.message));
  const nextHandler = () => renderPage(pageNumber + 1).catch((error) => showLoadError(error.message));
  const undoHandler = () => { operations.pop(); render(); };
  const clearHandler = () => { operations.splice(0); active = null; render(); };
  const openHandler = () => openFullscreen();
  const closeHandler = () => closeFullscreen();
  const zoomOutHandler = () => {
    customZoom = clamp((zoomMode === 'fit' ? currentDisplayScale : customZoom) - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    zoomMode = 'custom';
    applyZoom();
  };
  const zoomInHandler = () => {
    customZoom = clamp((zoomMode === 'fit' ? currentDisplayScale : customZoom) + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    zoomMode = 'custom';
    applyZoom();
  };
  const zoomFitHandler = () => { zoomMode = 'fit'; applyZoom(); };
  const resizeHandler = () => { if (zoomMode === 'fit') applyZoom(); };
  const keyHandler = (event) => {
    if (workspace?.hidden) return;
    if (event.key === 'Escape') closeFullscreen();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && markupEnabled) {
      event.preventDefault();
      undoHandler();
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      zoomInHandler();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '-') {
      event.preventDefault();
      zoomOutHandler();
    }
  };

  previous?.addEventListener('click', previousHandler);
  next?.addEventListener('click', nextHandler);
  undo?.addEventListener('click', undoHandler);
  clear?.addEventListener('click', clearHandler);
  openButton?.addEventListener('click', openHandler);
  closeButton?.addEventListener('click', closeHandler);
  zoomOut?.addEventListener('click', zoomOutHandler);
  zoomIn?.addEventListener('click', zoomInHandler);
  zoomFit?.addEventListener('click', zoomFitHandler);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', keyHandler);
  window.addEventListener('resize', resizeHandler);
  canvas.width = 960;
  canvas.height = 1280;
  setTool('circle');
  setMarkupEnabled(false);
  prepareManuscript();
  updatePageControls();

  return {
    openFullscreen,
    closeFullscreen,
    loadManuscript,
    prepareManuscript,
    setTransferProgress,
    showLoadError,
    setMarkupEnabled,
    isLoaded: () => loaded && Boolean(background),
    hasMarkup: () => operations.length > 0,
    exportAnnotation() {
      if (!operations.length) return null;
      if (!markupEnabled) throw new Error('Select Request Revision before attaching visual markup.');
      if (!loaded || !background) throw new Error('Wait for the manuscript page to finish loading.');
      return {
        ...exportDataUrl(),
        pageLabel: String(pageLabel?.value || '').trim().slice(0, 80),
        createdAt: Date.now(),
      };
    },
    destroy() {
      destroyed = true;
      renderSequence += 1;
      closeFullscreen();
      toolHandlers.forEach(([button, handler]) => button.removeEventListener('click', handler));
      previous?.removeEventListener('click', previousHandler);
      next?.removeEventListener('click', nextHandler);
      undo?.removeEventListener('click', undoHandler);
      clear?.removeEventListener('click', clearHandler);
      openButton?.removeEventListener('click', openHandler);
      closeButton?.removeEventListener('click', closeHandler);
      zoomOut?.removeEventListener('click', zoomOutHandler);
      zoomIn?.removeEventListener('click', zoomInHandler);
      zoomFit?.removeEventListener('click', zoomFitHandler);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('resize', resizeHandler);
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
      pdfDocument?.destroy?.();
      docxSource?.replaceChildren();
    },
  };
}
