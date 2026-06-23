const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PDFDocument } = require('pdf-lib');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUTS_DIR = path.join(ROOT, 'outputs');
const STATE_DIR = path.join(OUTPUTS_DIR, 'state');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const SETTINGS_FILE = path.join(STATE_DIR, 'settings.json');
const ACADEMY_LOGO_FILE = path.join(ROOT, 'src', 'assets', 'academy', 'logo_color.png');
const ACADEMY_ISOTIPO_FILE = path.join(ROOT, 'src', 'assets', 'academy', 'isotipo_color.png');
const AUTH_MODES = ['apiKey', 'adc', 'openrouter'];

const REQUIRED_COLUMNS = [
  'id',
  'titulo',
  'concepto_clave',
  'publico_objetivo',
  'capitulo_referencia',
  'pagina_referencia',
  'sugerencia_visual',
  'estado'
];
const VALID_STATES = ['pendiente', 'generada', 'en_revision', 'aprobada', 'error'];
const IMAGE_MODELS = ['nano-banana-pro', 'nano-banana-2', 'nano-banana'];
const ACADEMY_BRAND_PROMPT_SUMMARY = [
  'Lineamientos fijos de marca Academy by Total Therapy:',
  'Academy es la unidad educativa de Total Therapy para formaciones presenciales y online en fisioterapia invasiva, especialmente puncion seca. El tono debe ser medico, academico, preciso, confiable y editorial.',
  'Usar siempre estetica Academy: tipografia Poppins; composiciones limpias, geometricas y profesionales; jerarquia fuerte con titulares breves, texto muy legible y alto contraste.',
  'Paleta oficial: Midnight #050039, Academy Navy #283078, Electric Indigo #5667FF y Academy Orange #FF4F26 como acento tipo punto gatillo. Usar secundarios con moderacion: Soft Yellow #FFE888, Cloud Gray #EFEFEF, Lavender Mist #CFD6FF, Cream Peach #FFF1EE y Deep Teal #0A4677.',
  'Aplicar regla visual 60/30/10: dominar con navy/indigo, apoyar con fondos claros o secundarios y reservar naranja para CTAs, puntos gatillo, marcas de enfasis o pequenos acentos.',
  'Iconografia: lineal, geometrica, medica/educativa, trazo uniforme, sin rellenos decorativos ni sombras pesadas. Imagenes: fisioterapia, aula clinica, anatomia profesional, agujas o referencias de puncion seca solo cuando aporte claridad.',
  'Evitar formas organicas tipo blobs, estetica generica de IA, exceso de texto, anatomia incorrecta, imagenes confusas, patrones decorativos sobre fotos y cualquier cambio no autorizado de logo o isotipo.',
  'Formato de cada slide: pensado para carrusel educativo en redes sociales.',
  'Usar el logo o isotipo solo desde las imagenes de referencia adjuntas.'
].join('\n');

let mainWindow;
let state = {
  ideas: [],
  carousels: [],
  queue: []
};
let generationJob = null;
let settings = {
  authMode: 'apiKey',
  apiKey: '',
  openrouterApiKey: '',
  googleCloudProjectId: '',
  model: 'nano-banana-pro',
  outputDir: OUTPUTS_DIR,
  slideCount: 4,
  quality: 'standard',
  maxCredits: 20,
  retryDelayMs: 1200,
  maxRetries: 2,
  simulateGeneration: true
};

function ensureDirs() {
  [
    OUTPUTS_DIR,
    path.join(OUTPUTS_DIR, 'ideas'),
    path.join(OUTPUTS_DIR, 'carruseles'),
    path.join(OUTPUTS_DIR, 'exports'),
    STATE_DIR
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function saveState() {
  writeJson(STATE_FILE, state);
}

function saveSettings() {
  const safeSettings = { ...settings };
  writeJson(SETTINGS_FILE, safeSettings);
}

function publicSettings() {
  return {
    ...settings,
    apiKey: settings.apiKey ? '********' : '',
    openrouterApiKey: settings.openrouterApiKey ? '********' : '',
    adcDetected: fs.existsSync('/Users/paul/.config/gcloud/application_default_credentials.json')
  };
}

function modelForProvider(model, provider) {
  if (model === 'nano-banana-pro') {
    return provider === 'vertex' ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-image';
  }
  if (model === 'nano-banana-2') {
    return provider === 'vertex' ? 'gemini-3.1-flash-image' : 'gemini-3.1-flash-image';
  }
  if (model === 'nano-banana') return 'gemini-2.5-flash-image';
  return model;
}

function modelForOpenRouter(model) {
  if (model === 'nano-banana-pro') return 'google/gemini-3-pro-image';
  if (model === 'nano-banana-2') return 'google/gemini-3.1-flash-image';
  if (model === 'nano-banana') return 'google/gemini-2.5-flash-image';
  return model;
}

function brandReferenceAssets() {
  return [
    { label: 'logo oficial Academy', file: ACADEMY_LOGO_FILE },
    { label: 'isotipo oficial Academy', file: ACADEMY_ISOTIPO_FILE }
  ].filter((asset) => fs.existsSync(asset.file));
}

function brandReferenceParts() {
  return brandReferenceAssets().flatMap((asset) => [
    { text: `Referencia visual adjunta: ${asset.label}. Usar solamente esta referencia para cualquier marca Academy visible.` },
    {
      inlineData: {
        mimeType: 'image/png',
        data: fs.readFileSync(asset.file).toString('base64')
      }
    }
  ]);
}

function brandReferenceDataUrls() {
  return brandReferenceAssets().map((asset) => ({
    type: 'image_url',
    image_url: {
      url: `data:image/png;base64,${fs.readFileSync(asset.file).toString('base64')}`
    }
  }));
}

async function getAccessTokenFromAdc() {
  const adcPath = '/Users/paul/.config/gcloud/application_default_credentials.json';
  const adc = readJson(adcPath, null);
  if (!adc) throw new Error('No se encontro la credencial ADC de Google Cloud.');
  if (adc.type !== 'authorized_user') {
    throw new Error(`ADC tipo "${adc.type}" no soportado todavia por la app.`);
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`No se pudo obtener access token con ADC: ${data.error || response.status}.`);
  }
  return data.access_token;
}

function imagePartFromResponse(responseJson) {
  const parts = responseJson?.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => part.inlineData?.data || part.inline_data?.data);
}

function isGenerationCancelled() {
  return Boolean(generationJob?.cancelled);
}

function cancelError() {
  const error = new Error('Generacion cancelada por el usuario.');
  error.code = 'GENERATION_CANCELLED';
  return error;
}

function isCancelError(error) {
  return error?.code === 'GENERATION_CANCELLED' || error?.name === 'AbortError';
}

function brandReferenceParts() {
  return [
    { label: 'logo oficial Academy', file: ACADEMY_LOGO_FILE },
    { label: 'isotipo oficial Academy', file: ACADEMY_ISOTIPO_FILE }
  ].filter((asset) => fs.existsSync(asset.file)).flatMap((asset) => [
    { text: `Referencia visual adjunta: ${asset.label}. Usar solamente esta referencia para cualquier marca Academy visible.` },
    {
      inlineData: {
        mimeType: 'image/png',
        data: fs.readFileSync(asset.file).toString('base64')
      }
    }
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGenerationError(error) {
  const message = String(error?.message || '').toLowerCase();
  return [
    'resource has been exhausted',
    'resource exhausted',
    'quota',
    '429',
    '503',
    '500',
    'fetch failed',
    'temporarily unavailable',
    'try again later'
  ].some((needle) => message.includes(needle));
}

async function withGenerationRetries(task) {
  const attempts = Math.max(1, Number(settings.maxRetries || 0) + 1);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (isGenerationCancelled()) throw cancelError();
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (isCancelError(error) || isGenerationCancelled()) throw cancelError();
      if (attempt >= attempts || !isRetryableGenerationError(error)) break;
      const delay = Number(settings.retryDelayMs || 1200) * attempt;
      await sleep(delay);
    }
  }
  throw lastError;
}

async function writeGeneratedImage(prompt, imagePath) {
  if (isGenerationCancelled()) throw cancelError();
  const authMode = settings.authMode || 'apiKey';
  if (authMode === 'openrouter') {
    return writeGeneratedImageOpenRouter(prompt, imagePath);
  }
  const provider = authMode === 'adc' ? 'vertex' : 'gemini';
  const model = modelForProvider(settings.model || 'nano-banana-pro', provider);
  const imageSize = settings.quality === 'high' ? '2K' : '1K';
  const body = {
    contents: [{
      role: 'USER',
      parts: [{ text: prompt }, ...brandReferenceParts()]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };
  if (provider === 'vertex') {
    body.generationConfig.imageConfig = { aspectRatio: '1:1', imageSize };
  } else {
    body.generationConfig.responseFormat = { image: { aspectRatio: '1:1', imageSize } };
  }

  let url;
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'vertex') {
    if (!settings.googleCloudProjectId) {
      throw new Error('Falta Google Cloud Project ID para usar ADC.');
    }
    const accessToken = await getAccessTokenFromAdc();
    headers.Authorization = `Bearer ${accessToken}`;
    url = `https://aiplatform.googleapis.com/v1/projects/${settings.googleCloudProjectId}/locations/global/publishers/google/models/${model}:generateContent`;
  } else {
    if (!settings.apiKey) {
      throw new Error('Falta API key para generar imagenes con Gemini API.');
    }
    headers['x-goog-api-key'] = settings.apiKey;
    url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;
  }

  const controller = new AbortController();
  if (generationJob) generationJob.controller = controller;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  });
  if (generationJob?.controller === controller) generationJob.controller = null;
  const responseJson = await response.json();
  if (!response.ok) {
    const message = responseJson?.error?.message || `HTTP ${response.status}`;
    throw new Error(`La generacion real fallo: ${message}`);
  }
  const imagePart = imagePartFromResponse(responseJson);
  if (!imagePart) {
    throw new Error('El modelo respondio sin imagen.');
  }
  const inlineData = imagePart.inlineData || imagePart.inline_data;
  fs.writeFileSync(imagePath, Buffer.from(inlineData.data, 'base64'));
  return {
    provider,
    model,
    mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
    imageSize
  };
}

async function writeGeneratedImageOpenRouter(prompt, imagePath) {
  if (!settings.openrouterApiKey) {
    throw new Error('Falta API key de OpenRouter para generar imagenes.');
  }
  const model = modelForOpenRouter(settings.model || 'nano-banana-pro');
  const resolution = settings.quality === 'high' ? '2K' : '1K';
  const body = {
    model,
    prompt,
    aspect_ratio: '1:1',
    output_format: 'png'
  };
  const supportsResolution = model !== 'google/gemini-2.5-flash-image';
  if (supportsResolution) body.resolution = resolution;
  const refs = brandReferenceDataUrls();
  if (refs.length) body.input_references = refs;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.openrouterApiKey}`
  };
  const controller = new AbortController();
  if (generationJob) generationJob.controller = controller;
  const response = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  });
  if (generationJob?.controller === controller) generationJob.controller = null;
  const responseJson = await response.json();
  if (!response.ok) {
    const message = responseJson?.error?.message || responseJson?.message || `HTTP ${response.status}`;
    throw new Error(`La generacion con OpenRouter fallo: ${message}`);
  }
  const image = responseJson?.data?.[0];
  if (!image?.b64_json) {
    throw new Error('OpenRouter respondio sin imagen.');
  }
  fs.writeFileSync(imagePath, Buffer.from(image.b64_json, 'base64'));
  return {
    provider: 'openrouter',
    model,
    mimeType: 'image/png',
    imageSize: resolution
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1040,
    minHeight: 720,
    title: 'Academy Carousel Generator',
    backgroundColor: '#f7f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  if (!rows.length) throw new Error('El CSV esta vacio.');
  const headers = rows[0].map((cell) => cell.trim());
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`El CSV no cumple las columnas obligatorias. Faltan: ${missing.join(', ')}.`);
  }
  return rows.slice(1).map((cells, index) => {
    const item = {};
    headers.forEach((header, cellIndex) => {
      item[header] = (cells[cellIndex] || '').trim();
    });
    if (!VALID_STATES.includes(item.estado)) {
      throw new Error(`La fila ${index + 2} tiene un estado invalido: "${item.estado}".`);
    }
    return item;
  });
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70) || 'sin-titulo';
}

function carouselIdForIdea(idea) {
  const serial = String(idea.id || state.carousels.length + 1).padStart(3, '0');
  return `carrusel_${serial}_${slugify(idea.titulo)}`;
}

// Resuelve el contenido (informacion y grafico) que recibe cada slide.
// Portada (1) y cierre (ultimo) comparten el concepto global y el visual "hero"
// para que la primera y la ultima grafica se sientan coherentes entre si.
// Cada slide intermedio usa su propio sub-concepto y su propio grafico (columnas
// slideN_concepto / slideN_visual). Si la fila no trae esas columnas, cae al
// concepto/visual global para mantener compatibilidad con CSV antiguos.
function slidePlan(idea, slideIndex, slideCount) {
  const isFirstSlide = slideIndex === 1;
  const isLastSlide = slideIndex === slideCount;
  if (isFirstSlide || isLastSlide) {
    return { concepto: idea.concepto_clave, visual: idea.sugerencia_visual, isBody: false };
  }
  const concepto = String(idea[`slide${slideIndex}_concepto`] || '').trim();
  const visual = String(idea[`slide${slideIndex}_visual`] || '').trim();
  return {
    concepto: concepto || idea.concepto_clave,
    visual: visual || idea.sugerencia_visual,
    isBody: true
  };
}

function academyPrompt(idea, slideIndex, slideCount) {
  const isFirstSlide = slideIndex === 1;
  const isLastSlide = slideIndex === slideCount;
  const arc = [
    'Portada llamativa con gancho clinico, una sola idea visual fuerte y muy poco texto.',
    'Explica el concepto clave con una analogia visual medica clara.',
    'Muestra aplicacion practica para fisioterapeutas con jerarquia visual.',
    'Resume aprendizaje accionable y cierre orientado a formacion Academy.',
    'Incluye checklist de revision clinica y llamada a profundizar.'
  ];
  const { concepto, visual, isBody } = slidePlan(idea, slideIndex, slideCount);
  const referenceRule = isLastSlide
    ? `Este es el ultimo slide: incluir al pie una referencia discreta y legible: "${idea.capitulo_referencia}, paginas ${idea.pagina_referencia}".`
    : 'No incluir referencia, capitulo, pagina, bibliografia, fuente ni texto legal en esta imagen. La referencia queda solo para metadata y para el ultimo slide.';
  const coverRule = isFirstSlide
    ? 'Regla especial de portada: debe ser visualmente llamativa, con maximo 8 palabras principales visibles, sin parrafos explicativos, sin subtitulos largos y sin referencia bibliografica.'
    : isBody
      ? 'Evitar sobrecargar el slide: usar textos cortos, jerarquia clara y solo los rótulos necesarios para explicar la idea.'
      : '';
  const varietyRule = isBody
    ? 'Este es un slide de desarrollo: su grafico debe ser claramente DISTINTO al de la portada y al de los otros slides de desarrollo. No repitas la misma ilustracion, el mismo tipo de diagrama ni la misma composicion entre slides; usa exactamente la representacion descrita en la sugerencia visual de este slide (p. ej. uno anatomico, otro una tabla comparativa, otro un diagrama de mecanismo o de proceso) para aportar informacion nueva.'
    : isLastSlide
      ? 'La portada y el cierre pueden compartir un mismo motivo visual "hero" para dar coherencia de apertura y cierre al carrusel.'
      : '';
  return [
    `Crear slide ${slideIndex}/${slideCount} para carrusel educativo de Academy by Total Therapy.`,
    `Tema general del carrusel: ${idea.titulo}.`,
    `Enfoque informativo de ESTE slide: ${concepto}.`,
    `Publico objetivo: ${idea.publico_objetivo}.`,
    `Sugerencia visual de ESTE slide: ${visual}.`,
    `Rol del slide: ${arc[slideIndex - 1] || arc[3]}.`,
    coverRule,
    varietyRule,
    referenceRule,
    'Si usas marca visible, colocar el logo oficial Academy pequeno en una esquina respetando area de proteccion.',
    ACADEMY_BRAND_PROMPT_SUMMARY
  ].filter(Boolean).join('\n');
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPlaceholderPng(filePath, slideIndex) {
  const width = 1080;
  const height = 1080;
  const palette = [
    [40, 48, 120],
    [86, 103, 255],
    [255, 232, 136],
    [255, 241, 238],
    [239, 239, 239]
  ];
  const bg = palette[(slideIndex - 1) % palette.length];
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 4;
      const accent = (x - 840) ** 2 + (y - 190) ** 2 < 130 ** 2;
      const line = y > 760 && y < 790 && x > 120 && x < 930;
      const orangeDot = (x - 180) ** 2 + (y - 180) ** 2 < 54 ** 2;
      const color = orangeDot ? [255, 79, 38] : accent ? [207, 214, 255] : line ? [255, 79, 38] : bg;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('generation:progress', payload);
  }
}

async function generateCarousel(idea, options = {}) {
  const slideCount = Number(options.slideCount || settings.slideCount || 4);
  const carouselId = carouselIdForIdea(idea);
  const outputDir = path.join(settings.outputDir || OUTPUTS_DIR, 'carruseles', carouselId);
  fs.mkdirSync(outputDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const slides = [];
  const errors = [];
  const generationDetails = [];
  let cancelled = false;

  for (let slideIndex = 1; slideIndex <= slideCount; slideIndex += 1) {
    if (isGenerationCancelled()) {
      cancelled = true;
      errors.push({ slideIndex, message: 'Generacion cancelada por el usuario.' });
      sendProgress({ ideaId: idea.id, carouselId, slideIndex, slideCount, status: 'cancelada' });
      break;
    }
    const prompt = academyPrompt(idea, slideIndex, slideCount);
    const filename = `slide_${String(slideIndex).padStart(2, '0')}.png`;
    const imagePath = path.join(outputDir, filename);
    sendProgress({ ideaId: idea.id, carouselId, slideIndex, slideCount, status: 'generando' });
    try {
      const detail = settings.simulateGeneration
        ? { provider: 'simulado', model: settings.model, mimeType: 'image/png', imageSize: '1K' }
        : await withGenerationRetries(() => writeGeneratedImage(prompt, imagePath));
      if (settings.simulateGeneration) createPlaceholderPng(imagePath, slideIndex);
      generationDetails.push({ index: slideIndex, ...detail });
      slides.push({ index: slideIndex, filename, path: imagePath, prompt, status: 'generada', generation: detail });
      writeJson(path.join(outputDir, 'metadata.json'), {
        idea,
        carouselId,
        prompts: slides.map((slide) => ({ index: slide.index, prompt: slide.prompt })),
        model: detail.model || settings.model,
        parameters: {
          slideCount,
          quality: settings.quality,
          simulateGeneration: Boolean(settings.simulateGeneration)
        },
        date: createdAt,
        status: 'generando',
        imagePaths: slides.map((slide) => slide.path),
        generationDetails,
        errors
      });
      sendProgress({ ideaId: idea.id, carouselId, slideIndex, slideCount, status: 'generada' });
    } catch (error) {
      if (isCancelError(error) || isGenerationCancelled()) {
        cancelled = true;
        errors.push({ slideIndex, message: 'Generacion cancelada por el usuario.' });
        sendProgress({ ideaId: idea.id, carouselId, slideIndex, slideCount, status: 'cancelada' });
        break;
      }
      errors.push({ slideIndex, message: error.message });
      sendProgress({ ideaId: idea.id, carouselId, slideIndex, slideCount, status: 'error', error: error.message });
    }
  }

  const status = cancelled ? 'cancelada' : errors.length ? 'error' : 'generada';
  const carousel = {
    ideaId: idea.id,
    carouselId,
    status,
    slideCount,
    outputDir,
    slides,
    createdAt,
    updatedAt: new Date().toISOString(),
    errors
  };
  writeJson(path.join(outputDir, 'metadata.json'), {
    idea,
    carouselId,
    prompts: slides.map((slide) => ({ index: slide.index, prompt: slide.prompt })),
    model: generationDetails[0]?.model || settings.model,
    parameters: {
      slideCount,
      quality: settings.quality,
      simulateGeneration: Boolean(settings.simulateGeneration)
    },
    date: createdAt,
    status,
    imagePaths: slides.map((slide) => slide.path),
    generationDetails,
    errors
  });

  state.carousels = state.carousels.filter((item) => item.ideaId !== idea.id);
  state.carousels.push(carousel);
  state.ideas = state.ideas.map((item) => item.id === idea.id ? { ...item, estado: cancelled ? 'pendiente' : status } : item);
  saveState();
  return carousel;
}

ipcMain.handle('app:initialData', () => ({
  ideas: state.ideas,
  carousels: state.carousels,
  settings: publicSettings()
}));

ipcMain.handle('ideas:importCsv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar CSV de ideas',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const source = result.filePaths[0];
  const text = fs.readFileSync(source, 'utf8');
  const ideas = parseCsv(text);
  const dest = path.join(OUTPUTS_DIR, 'ideas', `ideas-${new Date().toISOString().slice(0, 10)}.csv`);
  fs.copyFileSync(source, dest);
  state.ideas = ideas;
  saveState();
  return { ideas, copiedTo: dest };
});

ipcMain.handle('settings:save', (_event, incoming) => {
  const next = { ...settings, ...incoming };
  if (incoming.apiKey === '********') next.apiKey = settings.apiKey;
  if (incoming.openrouterApiKey === '********') next.openrouterApiKey = settings.openrouterApiKey;
  if (!AUTH_MODES.includes(next.authMode)) next.authMode = 'apiKey';
  next.slideCount = Number(next.slideCount) === 5 ? 5 : 4;
  if (!IMAGE_MODELS.includes(next.model)) next.model = 'nano-banana-pro';
  settings = next;
  saveSettings();
  return publicSettings();
});

ipcMain.handle('generation:startBatch', async (_event, payload) => {
  if (generationJob?.active) {
    throw new Error('Ya hay una generacion en curso.');
  }
  generationJob = { active: true, cancelled: false, controller: null };
  const ids = payload?.ideaIds || [];
  const ideas = state.ideas.filter((idea) => ids.includes(idea.id));
  const results = [];
  try {
    for (const idea of ideas) {
      if (isGenerationCancelled()) break;
      results.push(await generateCarousel(idea, { slideCount: payload.slideCount }));
    }
    return { carousels: results, ideas: state.ideas, cancelled: isGenerationCancelled() };
  } finally {
    generationJob = null;
  }
});

ipcMain.handle('generation:cancel', () => {
  if (!generationJob?.active) {
    return { cancelled: false, message: 'No hay una generacion activa.' };
  }
  generationJob.cancelled = true;
  if (generationJob.controller) generationJob.controller.abort();
  sendProgress({ status: 'cancelando', carouselId: 'lote', slideIndex: 0, slideCount: 1 });
  return { cancelled: true };
});

ipcMain.handle('generation:regenerateCarousel', async (_event, payload) => {
  const idea = state.ideas.find((item) => item.id === payload.ideaId);
  if (!idea) throw new Error('No se encontro la idea para regenerar.');
  return generateCarousel(idea, { slideCount: payload.slideCount });
});

ipcMain.handle('generation:regenerateSlide', async (_event, payload) => {
  const carousel = state.carousels.find((item) => item.carouselId === payload.carouselId);
  if (!carousel) throw new Error('No se encontro el carrusel.');
  const slide = carousel.slides.find((item) => item.index === payload.slideIndex);
  if (!slide) throw new Error('No se encontro el slide.');
  const detail = settings.simulateGeneration
    ? { provider: 'simulado', model: settings.model, mimeType: 'image/png', imageSize: '1K' }
    : await withGenerationRetries(() => writeGeneratedImage(payload.prompt || slide.prompt, slide.path));
  if (settings.simulateGeneration) createPlaceholderPng(slide.path, slide.index);
  slide.prompt = payload.prompt || slide.prompt;
  slide.generation = detail;
  slide.updatedAt = new Date().toISOString();
  carousel.updatedAt = slide.updatedAt;
  saveState();
  return carousel;
});

ipcMain.handle('carousel:updateStatus', (_event, payload) => {
  const carousel = state.carousels.find((item) => item.carouselId === payload.carouselId);
  if (!carousel) throw new Error('No se encontro el carrusel.');
  carousel.status = payload.status;
  carousel.updatedAt = new Date().toISOString();
  state.ideas = state.ideas.map((idea) => idea.id === carousel.ideaId ? { ...idea, estado: payload.status } : idea);
  saveState();
  const metadataPath = path.join(carousel.outputDir, 'metadata.json');
  const metadata = readJson(metadataPath, {});
  writeJson(metadataPath, { ...metadata, status: payload.status });
  return { carousel, ideas: state.ideas };
});

ipcMain.handle('carousel:delete', async (_event, payload) => {
  const carousel = state.carousels.find((item) => item.carouselId === payload.carouselId);
  if (!carousel) throw new Error('No se encontro el carrusel.');
  if (fs.existsSync(carousel.outputDir)) {
    await shell.trashItem(carousel.outputDir);
  }
  state.carousels = state.carousels.filter((item) => item.carouselId !== payload.carouselId);
  state.ideas = state.ideas.map((idea) => (
    idea.id === carousel.ideaId ? { ...idea, estado: 'pendiente' } : idea
  ));
  saveState();
  return { deletedCarouselId: payload.carouselId, ideas: state.ideas, carousels: state.carousels };
});

async function buildCarouselPdf(carousel, destPath) {
  const pdf = await PDFDocument.create();
  const PAGE = 600;
  for (const slide of carousel.slides) {
    const pngBytes = fs.readFileSync(slide.path);
    const png = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([PAGE, PAGE]);
    const scale = Math.min(PAGE / png.width, PAGE / png.height);
    const w = png.width * scale;
    const h = png.height * scale;
    page.drawImage(png, { x: (PAGE - w) / 2, y: (PAGE - h) / 2, width: w, height: h });
  }
  fs.writeFileSync(destPath, await pdf.save());
  return destPath;
}

ipcMain.handle('export:approvedBatch', () => {
  const approved = state.carousels.filter((item) => item.status === 'aprobada');
  const dest = path.join(OUTPUTS_DIR, 'exports', `lote_aprobado_${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(dest, { recursive: true });
  approved.forEach((carousel) => {
    const carouselDest = path.join(dest, carousel.carouselId);
    fs.mkdirSync(carouselDest, { recursive: true });
    carousel.slides.forEach((slide) => fs.copyFileSync(slide.path, path.join(carouselDest, slide.filename)));
  });
  return { count: approved.length, dest };
});

ipcMain.handle('export:carousel', (_event, payload) => {
  const carousel = state.carousels.find((item) => item.carouselId === payload.carouselId);
  if (!carousel) throw new Error('No se encontro el carrusel.');
  const dest = path.join(OUTPUTS_DIR, 'exports', carousel.carouselId);
  fs.mkdirSync(dest, { recursive: true });
  carousel.slides.forEach((slide) => fs.copyFileSync(slide.path, path.join(dest, slide.filename)));
  return { dest };
});

ipcMain.handle('export:carouselPdf', async (_event, payload) => {
  const carousel = state.carousels.find((item) => item.carouselId === payload.carouselId);
  if (!carousel) throw new Error('No se encontro el carrusel.');
  const destDir = path.join(OUTPUTS_DIR, 'exports', 'pdf');
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, `${carousel.carouselId}.pdf`);
  await buildCarouselPdf(carousel, destPath);
  return { dest: destPath };
});

ipcMain.handle('export:approvedBatchPdf', async () => {
  const approved = state.carousels.filter((item) => item.status === 'aprobada');
  if (!approved.length) throw new Error('No hay carruseles aprobados para exportar.');
  const destDir = path.join(OUTPUTS_DIR, 'exports', `lote_aprobado_pdf_${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(destDir, { recursive: true });
  for (const carousel of approved) {
    await buildCarouselPdf(carousel, path.join(destDir, `${carousel.carouselId}.pdf`));
  }
  return { count: approved.length, dest: destDir };
});

ipcMain.handle('shell:openPath', (_event, targetPath) => shell.openPath(targetPath || OUTPUTS_DIR));

app.whenReady().then(() => {
  ensureDirs();
  const storedState = readJson(STATE_FILE, state);
  state = {
    ideas: storedState.ideas || [],
    carousels: storedState.carousels || [],
    queue: storedState.queue || []
  };
  settings = { ...settings, ...readJson(SETTINGS_FILE, {}) };
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
