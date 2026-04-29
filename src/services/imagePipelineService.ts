const IMAGE_PIPELINE_URL = process.env.REACT_APP_IMAGE_PIPELINE_URL;

if (!IMAGE_PIPELINE_URL) {
  throw new Error('REACT_APP_IMAGE_PIPELINE_URL TANIMLI DEGIL! Render env ekle.');
}

const IMAGE_PIPELINE_URLS = Array.from(
  new Set([
    String(IMAGE_PIPELINE_URL || '').trim(),
  ].filter(Boolean))
);

const SUPABASE_URL = String(process.env.REACT_APP_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

const CLEANED_PREFIX = 'cleaned';
const MAX_PIPELINE_INPUT_BYTES = 6 * 1024 * 1024;
const MAX_PIPELINE_DIMENSION = 1800;

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const ensureSupabaseConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase ortam degiskenleri eksik: REACT_APP_SUPABASE_URL ve REACT_APP_SUPABASE_ANON_KEY');
  }
};

const buildCleanedObjectPath = () => {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${CLEANED_PREFIX}/${stamp}-${random}.png`;
};

const loadImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image blob'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const optimizeForPipeline = async (file: File): Promise<File> => {
  const shouldOptimizeBySize = file.size > MAX_PIPELINE_INPUT_BYTES;

  let image: HTMLImageElement;
  try {
    image = await loadImageFromBlob(file);
  } catch {
    return file;
  }

  const width = Math.max(1, Number(image.naturalWidth || image.width || 0));
  const height = Math.max(1, Number(image.naturalHeight || image.height || 0));
  const maxSide = Math.max(width, height);
  const shouldOptimizeByDimension = maxSide > MAX_PIPELINE_DIMENSION;

  if (!shouldOptimizeBySize && !shouldOptimizeByDimension) {
    return file;
  }

  const scale = shouldOptimizeByDimension ? MAX_PIPELINE_DIMENSION / maxSide : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }

  // White underlay avoids transparent edge artifacts after downscaling.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const optimizedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92);
  });

  if (!optimizedBlob) {
    return file;
  }

  const nameWithoutExt = (file.name || 'image').replace(/\.[^.]+$/, '');
  return new File([optimizedBlob], `${nameWithoutExt}-optimized.jpg`, { type: 'image/jpeg' });
};

const flattenToWhiteBackground = async (inputBlob: Blob): Promise<Blob> => {
  const objectUrl = URL.createObjectURL(inputBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode cleaned image'));
      img.src = objectUrl;
    });

    const width = Math.max(1, Number(image.naturalWidth || image.width || 0));
    const height = Math.max(1, Number(image.naturalHeight || image.height || 0));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable');
    }

    // Enforce white background so product cards are always rendered on white.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new Error('Canvas serialization failed'));
        },
        'image/png',
        0.95
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const cleanImageInBackend = async (file: File): Promise<Blob> => {
  const optimizedFile = await optimizeForPipeline(file);

  const errors: string[] = [];

  for (const url of IMAGE_PIPELINE_URLS) {
    try {
      const formData = new FormData();
      formData.append('file', optimizedFile);

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          body: formData,
        },
        90_000
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        errors.push(`${url} -> ${response.status} ${body}`.trim());
        continue;
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        errors.push(`${url} -> empty PNG blob`);
        continue;
      }

      try {
        return await flattenToWhiteBackground(blob);
      } catch (error) {
        errors.push(`${url} -> white background flatten failed: ${String((error as any)?.message || error)}`);
        continue;
      }
    } catch (error: any) {
      errors.push(`${url} -> ${String(error?.message || error)}`);
    }
  }

  throw new Error(`Image pipeline backend failed on all endpoints: ${errors.join(' | ')}`);
};

export const cleanProductImageToPng = async (file: File): Promise<Blob> => {
  return cleanImageInBackend(file);
};

export const forceWhiteCanvasPng = async (file: File): Promise<Blob> => {
  return flattenToWhiteBackground(file);
};

const uploadCleanedToSupabase = async (pngBlob: Blob): Promise<string> => {
  ensureSupabaseConfig();

  const objectPath = buildCleanedObjectPath();
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/products/${objectPath}`;

  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: pngBlob,
    },
    90_000
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase upload failed (${response.status}): ${body}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/products/${objectPath}`;
};

export const processProductImage = async (file: File): Promise<string> => {
  console.info('[image-pipeline] request start');

  const pngBlob = await cleanImageInBackend(file);
  console.info('[image-pipeline] backend success');

  const finalUrl = await uploadCleanedToSupabase(pngBlob);
  console.info('[image-pipeline] cleaned upload success');
  console.info('[image-pipeline] final url', finalUrl);

  return finalUrl;
};
