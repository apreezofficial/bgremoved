/**
 * Magic Wand Flood Fill for removing contiguous similar color regions.
 * High-performance typed-array queue implementation.
 */
export function applyMagicWand(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number // 0 to 100
): ImageData {
  const { width, height, data } = imageData;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return imageData;
  }

  const startIndex = (startY * width + startX) * 4;
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  // If already fully transparent, nothing to erase
  if (targetA === 0) return imageData;

  const threshold = (tolerance / 100) * 442;
  const thresholdSq = threshold * threshold;

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);

  let queueHead = 0;
  let queueTail = 0;

  const startPos = startX + startY * width;
  queue[queueTail++] = startPos;
  visited[startPos] = 1;

  while (queueHead < queueTail) {
    const current = queue[queueHead++];
    const x = current % width;
    const pixelIdx = current * 4;

    // Erase pixel (set alpha to 0)
    data[pixelIdx + 3] = 0;

    const nLeft = x > 0 ? current - 1 : -1;
    const nRight = x < width - 1 ? current + 1 : -1;
    const nUp = current >= width ? current - width : -1;
    const nDown = current + width < totalPixels ? current + width : -1;

    const neighbors = [nLeft, nRight, nUp, nDown];

    for (let i = 0; i < 4; i++) {
      const n = neighbors[i];
      if (n !== -1 && !visited[n]) {
        visited[n] = 1;
        const nIdx = n * 4;
        if (data[nIdx + 3] > 0) {
          const dr = data[nIdx] - targetR;
          const dg = data[nIdx + 1] - targetG;
          const db = data[nIdx + 2] - targetB;
          const da = data[nIdx + 3] - targetA;
          if (dr * dr + dg * dg + db * db + da * da <= thresholdSq) {
            queue[queueTail++] = n;
          }
        }
      }
    }
  }

  return imageData;
}
