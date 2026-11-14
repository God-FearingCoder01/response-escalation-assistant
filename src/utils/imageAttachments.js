// Prepares screenshots for Ask REA: reads an image file, shrinks it so the request stays
// well under the host's body-size limit, and returns it as base64 JPEG plus a preview URL.
// Nothing is stored; the image only lives in memory until the question is sent.

export const IMAGE_LIMITS = {
  maxImages: 3,
  maxSourceBytes: 15 * 1024 * 1024, // refuse absurdly large originals before decoding
  maxEdgePx: 1600,
  maxBase64Chars: 1_300_000, // server accepts 1.4M per image
  maxTotalBase64Chars: 2_900_000, // server accepts 3.0M in total
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];

export function isImageFile(file) {
  return Boolean(file) && ACCEPTED_TYPES.includes(file.type);
}

export function imagesFromClipboardEvent(event) {
  const items = Array.from(event?.clipboardData?.items || []);
  return items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    img.src = url;
  });
}

function encode(img, edge, quality) {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent screenshots would turn black in JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

// Returns { mime, data, previewUrl, name } or throws an Error with a message for the agent.
export async function prepareImage(file) {
  if (!isImageFile(file)) throw new Error("Only PNG, JPEG, WebP, GIF or BMP images can be attached.");
  if (file.size > IMAGE_LIMITS.maxSourceBytes) throw new Error("That image is too large. Try a smaller screenshot.");
  const img = await loadImage(file);

  let edge = IMAGE_LIMITS.maxEdgePx;
  let quality = 0.85;
  let result = encode(img, edge, quality);
  // Step the size down until it fits; screenshots of text stay readable well past this.
  for (let attempt = 0; attempt < 6 && result.data.length > IMAGE_LIMITS.maxBase64Chars; attempt += 1) {
    edge = Math.round(edge * 0.8);
    quality = Math.max(0.6, quality - 0.05);
    result = encode(img, edge, quality);
  }
  if (result.data.length > IMAGE_LIMITS.maxBase64Chars) {
    throw new Error("That image is still too large after shrinking. Crop it and try again.");
  }
  return {
    mime: "image/jpeg",
    data: result.data,
    previewUrl: result.dataUrl,
    name: file.name || "screenshot",
  };
}

// Choose which of the conversation's screenshots go with this request: newest first, within
// the count and size limits the server enforces. Returns messages ready for the API.
export function withImageBudget(messages) {
  let count = 0;
  let total = 0;
  const out = new Array(messages.length);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const { role, content, images = [] } = messages[i];
    const kept = [];
    for (const image of images) {
      if (count >= IMAGE_LIMITS.maxImages) break;
      if (total + image.data.length > IMAGE_LIMITS.maxTotalBase64Chars) break;
      kept.push({ mime: image.mime, data: image.data });
      count += 1;
      total += image.data.length;
    }
    out[i] = kept.length ? { role, content, images: kept } : { role, content };
  }
  return out;
}
