export interface CompressImageOptions {
  /** Target square dimension in pixels (default: 600x600) */
  targetSize?: number;
  /** WebP compression quality from 0.0 to 1.0 (default: 0.82) */
  quality?: number;
}

export interface CompressedImageResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  format: 'image/webp' | 'image/jpeg';
  originalFileName: string;
  originalSizeBytes: number;
}

/**
 * Loads a user-uploaded image file, crops it to a 1:1 center square,
 * resizes it to targetSize x targetSize (default 600x600 px),
 * and compresses it to modern WebP format.
 */
export async function compressAndCropSquareToWebP(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressedImageResult> {
  const targetSize = options.targetSize ?? 600;
  const quality = options.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    // Basic file validation
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan merupakan format gambar valid.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);

        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        if (!naturalWidth || !naturalHeight) {
          reject(new Error('Gagal membaca dimensi gambar.'));
          return;
        }

        // Center square crop coordinates
        const minDim = Math.min(naturalWidth, naturalHeight);
        const sourceX = (naturalWidth - minDim) / 2;
        const sourceY = (naturalHeight - minDim) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Gagal membuat context rendering canvas.'));
          return;
        }

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw cropped center square to target canvas
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          minDim,
          minDim,
          0,
          0,
          targetSize,
          targetSize
        );

        // Convert to WebP format with quality setting
        let format: 'image/webp' | 'image/jpeg' = 'image/webp';
        let dataUrl = canvas.toDataURL('image/webp', quality);

        // Graceful fallback to JPEG if browser doesn't export webp
        if (!dataUrl.startsWith('data:image/webp')) {
          format = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }

        // Approximate bytes from base64 length (base64 string is ~4/3 larger than raw bytes)
        const base64Index = dataUrl.indexOf(',');
        const base64Content = base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
        const sizeBytes = Math.round((base64Content.length * 3) / 4);

        resolve({
          dataUrl,
          sizeBytes,
          width: targetSize,
          height: targetSize,
          format,
          originalFileName: file.name,
          originalSizeBytes: file.size,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Gagal memproses gambar.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal memuat file gambar. Pastikan file tidak rusak.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Format bytes into human-readable string (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
