import './styles.css';
import { createWeatherLens } from './weather-lens.js';
import { createWeatherSound } from './sound.js';
import { initUI } from './ui.js';
import { specimens } from './content.js';

const canvas = document.getElementById('weather-canvas');
const fallback = document.getElementById('webgl-fallback');
const loader = document.getElementById('loader');

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext
      && (probe.getContext('webgl2') || probe.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function revealExperience() {
  requestAnimationFrame(() => {
    document.documentElement.classList.add('is-ready');
    window.setTimeout(() => loader?.remove(), 850);
  });
}

let lens = null;
let sound = null;
let cleanupUI = null;
let disposed = false;

function showFallback(message) {
  document.body.classList.add('no-webgl');
  fallback?.classList.add('is-visible');
  if (message) console.warn(message);
}

function teardown() {
  if (disposed) return;
  disposed = true;
  cleanupUI?.();
  sound?.dispose();
  lens?.dispose();
  canvas?.removeEventListener('webglcontextlost', handleContextLoss);
}

function handleContextLoss(event) {
  event.preventDefault();
  showFallback('The WebGL context was lost. Switched to the static archive.');
}

function boot() {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  try {
    sound = createWeatherSound();
  } catch (error) {
    console.warn('Atmospheric sound is unavailable.', error);
  }

  if (supportsWebGL() && canvas) {
    try {
      lens = createWeatherLens(canvas, { reducedMotion });
      canvas.addEventListener('webglcontextlost', handleContextLoss, false);
    } catch (error) {
      showFallback('Unable to initialize the live atmosphere.');
      console.warn(error);
    }
  } else {
    showFallback('WebGL is not supported by this browser.');
  }

  cleanupUI = initUI({ lens, sound, specimens });
  window.addEventListener('pagehide', teardown, { once: true });
  revealExperience();
}

boot();
