const api = window.academyAPI;

const appState = {
  ideas: [],
  carousels: [],
  settings: {},
  selectedIds: new Set(),
  filter: 'todas',
  selectedCarouselId: null,
  selectedSlideIndex: 1,
  queue: new Map(),
  isGenerating: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

function statusLabel(status) {
  return {
    pendiente: 'pendiente',
    generada: 'generada',
    en_revision: 'revision',
    aprobada: 'aprobada',
    error: 'error',
    cancelada: 'cancelada'
  }[status] || status || 'pendiente';
}

function filteredIdeas() {
  if (appState.filter === 'todas') return appState.ideas;
  return appState.ideas.filter((idea) => idea.estado === appState.filter);
}

function renderMetrics() {
  const counts = appState.ideas.reduce((acc, idea) => {
    acc[idea.estado] = (acc[idea.estado] || 0) + 1;
    return acc;
  }, {});
  $('#metricPending').textContent = counts.pendiente || 0;
  $('#metricGenerated').textContent = counts.generada || 0;
  $('#metricReview').textContent = counts.en_revision || 0;
  $('#metricApproved').textContent = counts.aprobada || 0;
}

function renderIdeas() {
  const tbody = $('#ideasTable');
  const rows = filteredIdeas();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Importa un CSV valido para comenzar.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((idea) => {
    const carousel = appState.carousels.find((item) => item.ideaId === idea.id);
    return `
      <tr>
        <td><input type="checkbox" data-select="${idea.id}" ${appState.selectedIds.has(idea.id) ? 'checked' : ''}></td>
        <td>${idea.id}</td>
        <td class="title-cell">${escapeHtml(idea.titulo)}</td>
        <td><div class="clamp">${escapeHtml(idea.concepto_clave)}</div></td>
        <td>${escapeHtml(idea.publico_objetivo)}</td>
        <td>${escapeHtml(idea.capitulo_referencia)}<br><span class="muted">${escapeHtml(idea.pagina_referencia)}</span></td>
        <td><span class="status-pill ${idea.estado}">${statusLabel(idea.estado)}</span></td>
        <td><button class="ghost-button" data-review="${carousel?.carouselId || ''}" ${carousel ? '' : 'disabled'}>Ver</button></td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderQueue() {
  const list = $('#queueList');
  const items = Array.from(appState.queue.values());
  if (!items.length) {
    list.innerHTML = '<p class="muted">Sin generaciones activas.</p>';
    return;
  }
  list.innerHTML = items.map((item) => {
    const pct = Math.round((item.slideIndex / item.slideCount) * 100);
    return `
      <div class="queue-item">
        <strong>${escapeHtml(item.carouselId)}</strong>
        <span class="muted">Slide ${item.slideIndex}/${item.slideCount} - ${escapeHtml(item.status)}</span>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }).join('');
}

function renderGenerationControls() {
  $('#generateSelected').disabled = appState.isGenerating;
  $('#cancelGeneration').disabled = !appState.isGenerating;
}

function selectedCarousel() {
  return appState.carousels.find((item) => item.carouselId === appState.selectedCarouselId) || appState.carousels[0];
}

function renderReview() {
  const carousel = selectedCarousel();
  if (!carousel) {
    $('#slidePreview').style.display = 'none';
    $('#emptyPreview').style.display = 'block';
    $('#reviewTitle').textContent = 'Sin seleccion';
    $('#reviewMeta').textContent = 'Importa y genera una idea para revisar sus slides.';
    $('#promptEditor').value = '';
    $('#slideCounter').textContent = '0/0';
    $('#thumbs').innerHTML = '';
    setReviewActionsDisabled(true);
    return;
  }
  setReviewActionsDisabled(false);
  appState.selectedCarouselId = carousel.carouselId;
  const idea = appState.ideas.find((item) => item.id === carousel.ideaId);
  const slide = carousel.slides.find((item) => item.index === appState.selectedSlideIndex) || carousel.slides[0];
  appState.selectedSlideIndex = slide?.index || 1;
  $('#reviewTitle').textContent = idea?.titulo || carousel.carouselId;
  $('#reviewMeta').textContent = `${carousel.status} - ${carousel.slideCount} slides - ${carousel.outputDir}`;
  $('#promptEditor').value = slide?.prompt || '';
  $('#slideCounter').textContent = `${appState.selectedSlideIndex}/${carousel.slideCount}`;
  $('#slidePreview').src = slide?.path ? `file://${slide.path}?t=${Date.now()}` : '';
  $('#slidePreview').style.display = slide?.path ? 'block' : 'none';
  $('#emptyPreview').style.display = slide?.path ? 'none' : 'block';
  $('#thumbs').innerHTML = carousel.slides.map((item) => `
    <button class="${item.index === appState.selectedSlideIndex ? 'active' : ''}" data-slide="${item.index}">
      <img src="file://${item.path}?t=${Date.now()}" alt="Slide ${item.index}">
    </button>
  `).join('');
}

function setReviewActionsDisabled(disabled) {
  [
    '#regenerateSlide',
    '#regenerateCarousel',
    '#approveCarousel',
    '#exportCarousel',
    '#deleteCarousel'
  ].forEach((selector) => {
    const element = $(selector);
    if (element) element.disabled = disabled;
  });
}

function renderSettings() {
  $('#adcStatus').textContent = appState.settings.adcDetected ? 'detectado' : 'no detectado';
  $('#authMode').value = appState.settings.authMode || 'apiKey';
  $('#apiKey').value = appState.settings.apiKey || '';
  $('#projectId').value = appState.settings.googleCloudProjectId || '';
  const modelSelect = $('#model');
  const storedModel = appState.settings.model || 'nano-banana-pro';
  const hasModelOption = Array.from(modelSelect.options).some((option) => option.value === storedModel);
  modelSelect.value = hasModelOption ? storedModel : 'nano-banana-pro';
  $('#quality').value = appState.settings.quality || 'standard';
  $('#simulateGeneration').checked = Boolean(appState.settings.simulateGeneration);
  $('#slideCount').value = String(appState.settings.slideCount || 4);
}

function renderAll() {
  renderMetrics();
  renderIdeas();
  renderQueue();
  renderGenerationControls();
  renderReview();
  renderSettings();
}

async function refreshInitialData() {
  const data = await api.getInitialData();
  appState.ideas = data.ideas || [];
  appState.carousels = data.carousels || [];
  appState.settings = data.settings || {};
  renderAll();
}

function activateTab(tab) {
  $$('.nav-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  $$('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  $(`#${tab}Panel`).classList.add('active');
}

function bindEvents() {
  $$('.nav-tab').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tab)));
  $('#importCsv').addEventListener('click', async () => {
    try {
      const result = await api.importCsv();
      if (!result.canceled) {
        appState.ideas = result.ideas;
        appState.selectedIds.clear();
        toast(`CSV importado: ${result.ideas.length} ideas.`);
        renderAll();
      }
    } catch (error) {
      toast(error.message);
    }
  });
  $('#openOutputs').addEventListener('click', () => api.openPath(appState.settings.outputDir));
  $('#filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    appState.filter = button.dataset.filter;
    $$('.filter').forEach((item) => item.classList.toggle('active', item === button));
    renderIdeas();
  });
  $('#ideasTable').addEventListener('change', (event) => {
    const input = event.target.closest('[data-select]');
    if (!input) return;
    if (input.checked) appState.selectedIds.add(input.dataset.select);
    else appState.selectedIds.delete(input.dataset.select);
  });
  $('#ideasTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-review]');
    if (!button || !button.dataset.review) return;
    appState.selectedCarouselId = button.dataset.review;
    appState.selectedSlideIndex = 1;
    activateTab('review');
    renderReview();
  });
  $('#selectAll').addEventListener('change', (event) => {
    filteredIdeas().forEach((idea) => {
      if (event.target.checked) appState.selectedIds.add(idea.id);
      else appState.selectedIds.delete(idea.id);
    });
    renderIdeas();
  });
  $('#applyRange').addEventListener('click', () => {
    const match = $('#rangeInput').value.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return toast('Usa un rango como 1-7.');
    const start = Number(match[1]);
    const end = Number(match[2]);
    appState.ideas.forEach((idea, index) => {
      const position = index + 1;
      if (position >= start && position <= end) appState.selectedIds.add(idea.id);
    });
    renderIdeas();
  });
  $('#generateSelected').addEventListener('click', async () => {
    const ideaIds = Array.from(appState.selectedIds);
    if (!ideaIds.length) return toast('Selecciona al menos una idea.');
    appState.isGenerating = true;
    appState.queue.clear();
    renderAll();
    try {
      const result = await api.startBatch({ ideaIds, slideCount: Number($('#slideCount').value) });
      appState.queue.clear();
      appState.carousels = mergeCarousels(appState.carousels, result.carousels);
      appState.ideas = result.ideas;
      toast(result.cancelled ? 'Generacion cancelada.' : `Generados ${result.carousels.length} carruseles.`);
      renderAll();
    } catch (error) {
      toast(error.message);
    } finally {
      appState.isGenerating = false;
      renderAll();
    }
  });
  $('#cancelGeneration').addEventListener('click', async () => {
    if (!appState.isGenerating) return;
    const result = await api.cancelGeneration();
    toast(result.cancelled ? 'Cancelando generacion...' : result.message);
  });
  $('#thumbs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-slide]');
    if (!button) return;
    appState.selectedSlideIndex = Number(button.dataset.slide);
    renderReview();
  });
  $('#prevSlide').addEventListener('click', () => moveSlide(-1));
  $('#nextSlide').addEventListener('click', () => moveSlide(1));
  $('#approveCarousel').addEventListener('click', async () => {
    const carousel = selectedCarousel();
    if (!carousel) return;
    const result = await api.updateCarouselStatus({ carouselId: carousel.carouselId, status: 'aprobada' });
    appState.ideas = result.ideas;
    appState.carousels = mergeCarousels(appState.carousels, [result.carousel]);
    toast('Carrusel aprobado.');
    renderAll();
  });
  $('#regenerateSlide').addEventListener('click', async () => {
    const carousel = selectedCarousel();
    if (!carousel) return;
    const updated = await api.regenerateSlide({
      carouselId: carousel.carouselId,
      slideIndex: appState.selectedSlideIndex,
      prompt: $('#promptEditor').value
    });
    appState.carousels = mergeCarousels(appState.carousels, [updated]);
    toast('Slide regenerado.');
    renderReview();
  });
  $('#regenerateCarousel').addEventListener('click', async () => {
    const carousel = selectedCarousel();
    if (!carousel) return;
    const updated = await api.regenerateCarousel({ ideaId: carousel.ideaId, slideCount: carousel.slideCount });
    appState.carousels = mergeCarousels(appState.carousels, [updated]);
    toast('Carrusel regenerado.');
    renderAll();
  });
  $('#exportCarousel').addEventListener('click', async () => {
    const carousel = selectedCarousel();
    if (!carousel) return;
    const result = await api.exportCarousel({ carouselId: carousel.carouselId });
    toast(`Exportado en ${result.dest}`);
  });
  $('#exportApproved').addEventListener('click', async () => {
    const result = await api.exportApprovedBatch();
    toast(`Exportados ${result.count} carruseles aprobados.`);
  });
  $('#deleteCarousel').addEventListener('click', async () => {
    const carousel = selectedCarousel();
    if (!carousel) return;
    const ok = window.confirm('Eliminar este carrusel y mover su carpeta a la papelera?');
    if (!ok) return;
    const result = await api.deleteCarousel({ carouselId: carousel.carouselId });
    appState.carousels = result.carousels;
    appState.ideas = result.ideas;
    appState.selectedCarouselId = null;
    appState.selectedSlideIndex = 1;
    toast('Carrusel eliminado.');
    renderAll();
  });
  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    appState.settings = await api.saveSettings({
      authMode: $('#authMode').value,
      apiKey: $('#apiKey').value,
      googleCloudProjectId: $('#projectId').value,
      model: $('#model').value,
      quality: $('#quality').value,
      slideCount: Number($('#slideCount').value),
      simulateGeneration: $('#simulateGeneration').checked
    });
    toast('Settings guardados.');
    renderSettings();
  });
  api.onGenerationProgress((payload) => {
    appState.queue.set(payload.carouselId, payload);
    if (payload.status === 'cancelando') appState.isGenerating = true;
    renderQueue();
    renderGenerationControls();
  });
}

function mergeCarousels(current, incoming) {
  const byId = new Map(current.map((item) => [item.carouselId, item]));
  incoming.forEach((item) => byId.set(item.carouselId, item));
  return Array.from(byId.values());
}

function moveSlide(delta) {
  const carousel = selectedCarousel();
  if (!carousel) return;
  const next = appState.selectedSlideIndex + delta;
  appState.selectedSlideIndex = Math.min(carousel.slideCount, Math.max(1, next));
  renderReview();
}

bindEvents();
refreshInitialData().catch((error) => toast(error.message));
