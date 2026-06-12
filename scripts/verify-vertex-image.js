const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SETTINGS_FILE = path.join(ROOT, 'outputs', 'state', 'settings.json');
const ADC_FILE = '/Users/paul/.config/gcloud/application_default_credentials.json';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function modelForVertex(model) {
  if (model === 'nano-banana-pro') return 'gemini-3-pro-image-preview';
  if (model === 'nano-banana') return 'gemini-2.5-flash-image';
  return model;
}

async function getAccessToken() {
  const adc = readJson(ADC_FILE);
  if (adc.type !== 'authorized_user') {
    throw new Error(`ADC tipo "${adc.type}" no soportado por este verificador.`);
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
    throw new Error(`OAuth fallo: ${response.status} ${data.error || data.error_description || 'sin detalle'}`);
  }
  return data.access_token;
}

function findInlineImage(responseJson) {
  const parts = responseJson?.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => part.inlineData?.data || part.inline_data?.data);
}

async function main() {
  const settings = readJson(SETTINGS_FILE);
  const projectId = settings.googleCloudProjectId;
  if (!projectId) throw new Error('Falta Google Cloud Project ID en outputs/state/settings.json.');

  const model = modelForVertex(settings.model || 'nano-banana-pro');
  const accessToken = await getAccessToken();
  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;
  const prompt = [
    'Genera una imagen cuadrada 1:1 de prueba para Academy by Total Therapy.',
    'Debe verse como una portada editorial medica profesional sobre fisioterapia invasiva.',
    'Usa Poppins como estilo tipografico, navy #283078, indigo #5667FF y naranja #FF4F26 como punto gatillo.',
    'Incluye texto grande y legible: "Prueba Academy".',
    'No uses logos oficiales, no agregues datos clinicos inventados.'
  ].join(' ');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        role: 'USER',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: settings.quality === 'high' ? '2K' : '1K'
        }
      }
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    const message = responseJson?.error?.message || JSON.stringify(responseJson);
    throw new Error(`Vertex AI fallo: ${response.status} ${message}`);
  }

  const imagePart = findInlineImage(responseJson);
  if (!imagePart) {
    throw new Error('Vertex AI respondio sin imagen inline.');
  }

  const inlineData = imagePart.inlineData || imagePart.inline_data;
  const imageBuffer = Buffer.from(inlineData.data, 'base64');
  const outDir = path.join(ROOT, 'outputs', 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const imagePath = path.join(outDir, `vertex_auth_test_${stamp}.png`);
  const metaPath = path.join(outDir, `vertex_auth_test_${stamp}.json`);
  fs.writeFileSync(imagePath, imageBuffer);
  fs.writeFileSync(metaPath, JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    projectId,
    model,
    mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
    imagePath
  }, null, 2));

  console.log(JSON.stringify({ ok: true, model, imagePath, metaPath }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
