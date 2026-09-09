/**
 * T5.2 — marker styling.
 *
 * Three independent channels, so no single one has to carry the whole message:
 *   colour → condition   (Paul Tol palette, safe under common colour blindness)
 *   shape  → species category
 *   size   → age band
 *
 * MapLibre cannot draw a triangle from a paint expression, so each
 * category × condition pair is drawn once into a canvas and registered as a map
 * image. Twenty-five small images, generated in a few milliseconds at load.
 */
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';

const SIZE = 44; // drawn at 2× and scaled down, so it stays crisp on retina

type Shape = (typeof CATEGORIES)[number]['shape'];

function drawShape(context: CanvasRenderingContext2D, shape: Shape, center: number, radius: number) {
  context.beginPath();
  switch (shape) {
    case 'triangle': {
      for (let index = 0; index < 3; index += 1) {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 3;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      break;
    }
    case 'diamond': {
      context.moveTo(center, center - radius);
      context.lineTo(center + radius, center);
      context.lineTo(center, center + radius);
      context.lineTo(center - radius, center);
      break;
    }
    case 'square': {
      const side = radius * 1.7;
      context.rect(center - side / 2, center - side / 2, side, side);
      break;
    }
    case 'hexagon': {
      for (let index = 0; index < 6; index += 1) {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 6;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      break;
    }
    default:
      context.arc(center, center, radius, 0, Math.PI * 2);
  }
  context.closePath();
}

export function markerImageId(category: string, condition: string): string {
  return `tree-${category}-${condition}`;
}

/** Renders one marker to an ImageData the map can register. */
export function renderMarker(shape: Shape, color: string): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const center = SIZE / 2;
  const radius = SIZE * 0.34;

  // A white halo keeps every marker legible against satellite imagery and dark
  // basemaps alike, including the grey used for dead trees.
  context.shadowColor = 'rgba(0,0,0,0.35)';
  context.shadowBlur = 3;
  drawShape(context, shape, center, radius);
  context.fillStyle = color;
  context.fill();

  context.shadowColor = 'transparent';
  context.lineWidth = 2.5;
  context.strokeStyle = '#ffffff';
  drawShape(context, shape, center, radius);
  context.stroke();

  return context.getImageData(0, 0, SIZE, SIZE);
}

export function registerMarkerImages(map: MapLibreMap) {
  for (const category of CATEGORIES) {
    for (const condition of CONDITIONS) {
      const id = markerImageId(category.value, condition.value);
      if (map.hasImage(id)) continue;
      const image = renderMarker(category.shape, condition.color);
      if (image) map.addImage(id, image, { pixelRatio: 2 });
    }
  }
}

/**
 * The data-driven expression that picks an image per feature. Built rather than
 * written out by hand so adding a category or condition needs no edit here.
 */
export function markerIconExpression(): unknown[] {
  const expression: unknown[] = ['concat', 'tree-', ['get', 'category'], '-', ['get', 'condition']];
  return expression;
}
