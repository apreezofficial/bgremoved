/**
 * Magic Wand Flood Fill for removing contiguous similar color regions.
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

  // Max Euclidean distance is sqrt(255^2 * 4) ≈ 510
  const threshold = (tolerance / 100) * 442;
  const thresholdSq = threshold * threshold;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [startX + startY * width];
  visited[startX + startY * width] = 1;

  let queueHead = 0;

  function colorDistSq(idx: number): number {
    const dr = data[idx] - targetR;
    const dg = data[idx + 1] - targetG;
    const db = data[idx + 2] - targetB;
    const da = data[idx + 3] - targetA;
    return dr * dr + dg * dg + db * db + da * da;
  }

  while (queueHead < queue.length) {
    const current = queue[queueHead++];
    const x = current % width;
    const y = Math.floor(current / width);
    const pixelIdx = current * 4;

    // Erase pixel (set alpha to 0)
    data[pixelIdx + 3] = 0;

    // Check 4-connected neighbors
    const neighbors = [
      x > 0 ? current - 1 : -1,
      x < width - 1 ? current + 1 : -1,
      y > 0 ? current - width : -1,
      y < height - 1 ? current + width : -1,
    ];

    for (const n of neighbors) {
      if (n !== -1 && !visited[n]) {
        visited[n] = 1;
        const nIdx = n * 4;
        if (data[nIdx + 3] > 0 && colorDistSq(nIdx) <= thresholdSq) {
          queue.push(n);
        }
      }
    }
  }

  return imageData;
}
