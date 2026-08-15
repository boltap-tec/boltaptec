// Client-side image compression. Workers upload their own photo; we downscale
// and re-encode as JPEG until it fits under the size cap (default 100 KB) —
// friendlier than rejecting a large photo from a phone camera.

export const MAX_PHOTO_BYTES = 100 * 1024; // 100 KB

const dataUrlBytes = (dataUrl: string): number => {
  const i = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(i + 1);
  return Math.ceil((b64.length * 3) / 4);
};

export const compressImage = (file: File, maxBytes = MAX_PHOTO_BYTES, maxDim = 512): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported.')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let out = canvas.toDataURL('image/jpeg', quality);
        // step quality down until under the cap (or we hit the floor)
        while (dataUrlBytes(out) > maxBytes && quality > 0.3) {
          quality -= 0.12;
          out = canvas.toDataURL('image/jpeg', quality);
        }
        // still too big? shrink dimensions once more
        if (dataUrlBytes(out) > maxBytes) {
          const c2 = document.createElement('canvas');
          c2.width = Math.round(width * 0.7); c2.height = Math.round(height * 0.7);
          c2.getContext('2d')!.drawImage(img, 0, 0, c2.width, c2.height);
          out = c2.toDataURL('image/jpeg', 0.6);
        }
        resolve(out);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export const humanSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
