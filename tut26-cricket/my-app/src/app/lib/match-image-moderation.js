import { createRequire } from "node:module";

const MODERATION_IMAGE_SIZE = 224;
const SENSITIVE_CLASS_THRESHOLDS = Object.freeze({
  Porn: 0.18,
  Hentai: 0.18,
  Sexy: 0.82,
});

let moderationRuntimePromise = null;
const require = createRequire(import.meta.url);

function normalizePredictions(predictions) {
  if (!Array.isArray(predictions)) return [];

  return predictions
    .map((prediction) => ({
      className: String(prediction?.className || ""),
      probability: Number(prediction?.probability || 0),
    }))
    .filter((prediction) => prediction.className);
}

export function evaluateSensitiveImagePredictions(predictions) {
  const normalizedPredictions = normalizePredictions(predictions);
  const scores = Object.fromEntries(
    normalizedPredictions.map((prediction) => [
      prediction.className,
      prediction.probability,
    ])
  );

  const blockedLabels = Object.entries(SENSITIVE_CLASS_THRESHOLDS)
    .filter(([className, threshold]) => (scores[className] || 0) >= threshold)
    .map(([className]) => className);

  if (blockedLabels.length > 0) {
    return {
      ok: false,
      blockedLabels,
      message: "This image appears too sensitive for match upload.",
      predictions: normalizedPredictions,
    };
  }

  return {
    ok: true,
    blockedLabels: [],
    message: "",
    predictions: normalizedPredictions,
  };
}

async function getModerationRuntime() {
  if (!moderationRuntimePromise) {
    moderationRuntimePromise = (async () => {
      const [{ load }, tfModule, sharpModule] = await Promise.all([
        Promise.resolve(require("nsfwjs")),
        import("@tensorflow/tfjs"),
        import("sharp"),
      ]);

      const tf = tfModule.default || tfModule;
      const sharp = sharpModule.default;

      tf.enableProdMode();
      if (!tf.getBackend()) {
        await tf.setBackend("cpu");
      }
      await tf.ready();

      const model = await load("MobileNetV2");
      return { model, sharp, tf };
    })();
  }

  return moderationRuntimePromise;
}

async function createModerationTensor(buffer) {
  const { sharp, tf } = await getModerationRuntime();
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(MODERATION_IMAGE_SIZE, MODERATION_IMAGE_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new Error("Unsupported image channel layout for moderation.");
  }

  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
}

export async function moderateMatchImageBuffer(buffer) {
  try {
    const { model } = await getModerationRuntime();
    const tensor = await createModerationTensor(buffer);

    try {
      const predictions = await model.classify(tensor, 5);
      return evaluateSensitiveImagePredictions(predictions);
    } finally {
      tensor.dispose();
    }
  } catch (error) {
    console.error("Image moderation failed:", error);
    throw new Error("Image moderation unavailable.");
  }
}
