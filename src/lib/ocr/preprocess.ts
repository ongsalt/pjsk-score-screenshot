import { normalizeText } from "./normalize";

type ImageSource = string | Blob | Buffer | HTMLImageElement;

interface PreprocessOptions {
  scale: number;
  threshold: number;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  scale: 1,
  threshold: 142,
};

async function loadImage(source: ImageSource): Promise<HTMLImageElement> {
  if (typeof source !== "string" && source instanceof HTMLImageElement) {
    return source;
  }

  const image = new Image();
  image.decoding = "async";

  const sourceUrl =
    typeof source === "string" ? source : URL.createObjectURL(source);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image."));
      image.src = sourceUrl;
    });

    return image;
  } finally {
    if (typeof source !== "string") {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

export async function preprocessImage(
  source: ImageSource,
  options: Partial<PreprocessOptions> = {},
): Promise<HTMLCanvasElement> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const image = await loadImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(image.width * merged.scale));
  canvas.height = Math.max(1, Math.floor(image.height * merged.scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create canvas context.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;

    const grayscale = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    const value = grayscale > merged.threshold ? 255 : 0;

    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function sanitizeRawText(input: string): string {
  return normalizeText(input).replace(/\n{3,}/g, "\n\n");
}
