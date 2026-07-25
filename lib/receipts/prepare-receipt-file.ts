/** Vercel Serverless のリクエスト上限は約 4.5MB。multipart 余裕を見てこれ以下に抑える。 */
export const RECEIPT_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;

/** OCR用に画像を圧縮する目標サイズ */
export const RECEIPT_OCR_TARGET_BYTES = 1.8 * 1024 * 1024;

const MAX_IMAGE_EDGE = 2000;

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function isReceiptFileTooLarge(file: Pick<File, "size" | "type">): boolean {
  if (file.type.startsWith("image/")) {
    // 画像は圧縮できるので、圧縮後の上限だけ見る
    return false;
  }
  return file.size > RECEIPT_UPLOAD_MAX_BYTES;
}

export function receiptTooLargeMessage(file: Pick<File, "size" | "type">): string {
  return `ファイルが大きすぎます（${formatMegabytes(file.size)}）。目安は ${formatMegabytes(RECEIPT_UPLOAD_MAX_BYTES)} 以下です。画像で撮り直すか、圧縮してから再度お試しください。`;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の圧縮に失敗しました。"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function drawImageToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像の圧縮に対応していないブラウザです。");
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function scaledSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * カメラ写真など大きな画像を、Server Action / Vercel 上限内に収まるよう JPEG 圧縮する。
 * PDF や既に小さい画像はそのまま返す。
 */
export async function prepareReceiptFileForUpload(file: File): Promise<File> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) {
    if (isReceiptFileTooLarge(file)) {
      throw new Error(receiptTooLargeMessage(file));
    }
    return file;
  }

  if (file.size <= RECEIPT_OCR_TARGET_BYTES && file.type === "image/jpeg") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
    const canvas = await drawImageToCanvas(bitmap, width, height);

    let quality = 0.82;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > RECEIPT_OCR_TARGET_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size > RECEIPT_UPLOAD_MAX_BYTES) {
      throw new Error(
        `画像を圧縮しても大きすぎます（${formatMegabytes(blob.size)}）。もう少し離れて撮影するか、解像度を下げて再度お試しください。`,
      );
    }

    // 元より大きい場合は元ファイルを使う（既に小さなPNG等）
    if (blob.size >= file.size && file.size <= RECEIPT_UPLOAD_MAX_BYTES) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("大きすぎ")) {
      throw error;
    }
    if (file.size > RECEIPT_UPLOAD_MAX_BYTES) {
      throw new Error(receiptTooLargeMessage(file));
    }
    // 圧縮できない環境では、上限内ならそのまま送る
    return file;
  } finally {
    bitmap?.close();
  }
}
