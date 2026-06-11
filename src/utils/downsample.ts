/**
 * Downsamples time-series data using the Largest Triangle Three Buckets (LTTB) algorithm.
 * visually preserves peaks, valleys, and the general shape of the data.
 * 
 * @param data Array of data points, each containing [x, y] (e.g., [timestamp, bpm])
 * @param threshold The target number of points to downsample to (e.g., 500)
 */
export function downsampleLTTB<T extends { x: number; y: number }>(
    data: T[],
    threshold: number
  ): T[] {
    const dataLength = data.length;
    if (threshold >= dataLength || threshold === 0) {
      return data; // No downsampling needed
    }
  
    const sampled: T[] = [];
    let sampledIndex = 0;
  
    // Bucket size. Leave room for the start and end points.
    const bucketSize = (dataLength - 2) / (threshold - 2);
  
    let a = 0; // Initially, first point is the key point (A)
    let maxAreaPoint: T = data[0];
    let nextA = 0;
  
    sampled[sampledIndex++] = data[a]; // Always add the first point
  
    for (let i = 0; i < threshold - 2; i++) {
      // Calculate point average for the next bucket (C)
      let avgX = 0;
      let avgY = 0;
      let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;
  
      const avgRangeLength = avgRangeEnd - avgRangeStart;
  
      for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
        avgX += data[avgRangeStart].x;
        avgY += data[avgRangeStart].y;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
  
      // Get the range for the current bucket (B)
      let rangeOffs = Math.floor(i * bucketSize) + 1;
      const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
  
      // Point A coordinates
      const pointAX = data[a].x;
      const pointAY = data[a].y;
  
      let maxArea = -1;
  
      for (; rangeOffs < rangeTo; rangeOffs++) {
        // Calculate triangle area over three points: A, current point B, and average point C
        const area =
          Math.abs(
            (pointAX - avgX) * (data[rangeOffs].y - pointAY) -
              (pointAX - data[rangeOffs].x) * (avgY - pointAY)
          ) * 0.5;
  
        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = data[rangeOffs];
          nextA = rangeOffs; // Next A is this selected point B
        }
      }
  
      sampled[sampledIndex++] = maxAreaPoint; // Save selected point
      a = nextA; // Move A to next bucket's selected point
    }
  
    sampled[sampledIndex++] = data[dataLength - 1]; // Always add the last point
  
    return sampled;
  }