// import { normalizeText } from "./normalize";

// browser onlyyyyy

type ImageSource = string | Blob | HTMLImageElement;

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

  // context.filter = "contrast(200%)";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;

    // NOT perceive brightness
    const grayscale = Math.round(r * 0.318 + g * 0.602 + b * 0.080);
    // let value = Math.max(0, grayscale - merged.threshold);
    // value = (value / merged.threshold) * 255;
    const value = grayscale < merged.threshold ? 0 : 255
    // const value = grayscale

    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  document.getElementById("canvas-host")?.appendChild(canvas);

  return canvas;
}
