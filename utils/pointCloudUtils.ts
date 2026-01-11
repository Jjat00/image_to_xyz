import { PointCloudData } from '../types';

/**
 * Loads an image from a source URL (base64 or http).
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Converts RGB and Depth images into a set of 3D points (XYZ) and Colors (RGB).
 */
export const generatePointsFromImages = async (
  rgbSrc: string,
  depthSrc: string,
  sampleRate: number = 2,
  depthScale: number = 10
): Promise<PointCloudData> => {
  
  const [rgbImg, depthImg] = await Promise.all([
    loadImage(rgbSrc),
    loadImage(depthSrc)
  ]);

  // Use the dimensions of the RGB image as the source of truth
  const width = rgbImg.width;
  const height = rgbImg.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error("Could not create canvas context");

  // Draw RGB image to get color data
  ctx.drawImage(rgbImg, 0, 0, width, height);
  const rgbData = ctx.getImageData(0, 0, width, height).data;

  // Draw Depth image to get Z data
  // Note: We stretch the depth image to match RGB dimensions in case of slight mismatch
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(depthImg, 0, 0, width, height);
  const depthData = ctx.getImageData(0, 0, width, height).data;

  // Calculate number of points based on sample rate
  const numPoints = Math.floor(width / sampleRate) * Math.floor(height / sampleRate);
  
  const positions = new Float32Array(numPoints * 3);
  const colors = new Float32Array(numPoints * 3);

  let pIndex = 0;

  // Center offsets
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += sampleRate) {
    for (let x = 0; x < width; x += sampleRate) {
      const pixelIndex = (y * width + x) * 4;

      // Extract Color (normalize to 0-1 for Three.js)
      const r = rgbData[pixelIndex] / 255;
      const g = rgbData[pixelIndex + 1] / 255;
      const b = rgbData[pixelIndex + 2] / 255;

      // Extract Depth (grayscale value)
      // Since it's grayscale, R=G=B, we can just take R.
      // 0 = black (far), 255 = white (near).
      // However, usually in 3D, negative Z is into screen. 
      // Let's map 0-255 to a Z range. 
      const rawDepth = depthData[pixelIndex];
      const z = (rawDepth / 255) * depthScale;

      // Simple perspective projection approximation
      // Map pixel (x,y) to world (X,Y) based on image plane
      const u = (x - cx) / width;
      const v = -(y - cy) / height; // Flip Y for 3D coords

      // Adjust XY spread based on depth to create perspective cone effect
      // Or keep it orthographic-like for simpler visualization. 
      // Let's do a simple extrusion:
      const X = u * 10; // spread factor
      const Y = v * 10 * (height / width); // maintain aspect ratio
      const Z = z; 

      positions[pIndex] = X;
      positions[pIndex + 1] = Y;
      positions[pIndex + 2] = Z;

      colors[pIndex] = r;
      colors[pIndex + 1] = g;
      colors[pIndex + 2] = b;

      pIndex += 3;
    }
  }

  return { positions, colors, width, height };
};
