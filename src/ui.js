const byId = (id) => document.getElementById(id);
const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function initUI({ lens = null, sound = null, specimens = [] } = {}) {
  const canvas = byId('weather-canvas');
  const scrollContainer = document.querySelector('.scroll-container');
  const langToggle = byId('lang-toggle');
  const soundToggle = byId('sound-toggle');
  const soundState = soundToggle?.querySelector('.sound-state');
  const progressBar = byId('progress-bar');
  const progressLabel = byId('progress-label');
  const captureButton = byId('capture-btn');
  const captureStatus = byId('capture-status');
  const densityInput = byId('density');
  const turbulenceInput = byId('turbulence');
  const spectrumInput = byId('spectrum');
  const densityOutput = byId('density-output');
  const turbulenceOutput = byId('turbulence-output');
  const spectrumOutput = byId('spectrum-output');
  const sections = [...document.querySelectorAll('.specimen')];
  const cleanups = [];
  const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let language = 'en';
  let currentMode = 0;
  let statusTimer = null;

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function localized(en, zh) {
    return language === 'zh' ? zh : en;
  }

  function setStatus(en, zh, timeout = 2400) {
    if (!captureStatus) return;
    window.clearTimeout(statusTimer);
    captureStatus.textContent = localized(en, zh);
    if (timeout > 0) {
      statusTimer = window.setTimeout(() => {
        captureStatus.textContent = '';
      }, timeout);
    }
  }

  function applyLanguage() {
    const zh = language === 'zh';
    document.documentElement.lang = zh ? 'zh-TW' : 'en';
    document.body.classList.toggle('lang-zh', zh);
    langToggle?.setAttribute('aria-pressed', String(zh));
    langToggle?.setAttribute('aria-label', zh ? 'Switch to English' : '切換為繁體中文');
    soundToggle?.setAttribute(
      'aria-label',
      sound?.isEnabled()
        ? localized('Turn atmospheric sound off', '關閉大氣聲場')
        : localized('Turn atmospheric sound on', '開啟大氣聲場')
    );
  }

  function handleLanguage() {
    language = language === 'en' ? 'zh' : 'en';
    applyLanguage();
  }

  function handleSound() {
    if (!sound) {
      setStatus('Sound is unavailable on this device.', '此裝置無法播放聲場。');
      return;
    }
    const enabled = sound.toggle();
    soundToggle?.setAttribute('aria-pressed', String(enabled));
    soundToggle?.classList.toggle('is-on', enabled);
    if (soundState) soundState.textContent = enabled ? '01' : '00';
    applyLanguage();
  }

  function updateProgress() {
    if (!scrollContainer) return;
    const distance = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const progress = distance > 0 ? clamp01(scrollContainer.scrollTop / distance) : 0;
    progressBar?.style.setProperty('--progress', String(progress));
    if (progressLabel) progressLabel.textContent = `${String(Math.round(progress * 100)).padStart(3, '0')}%`;
    lens?.setScrollProgress(progress);
  }

  function activateMode(mode) {
    if (!Number.isFinite(mode) || mode === currentMode) return;
    currentMode = mode;
    document.body.dataset.mode = String(mode);
    lens?.setMode(mode);
    sound?.setMode(mode);
    sections.forEach((section) => {
      const active = Number(section.dataset.mode) === mode;
      section.classList.toggle('is-active', active);
      section.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  const observer = 'IntersectionObserver' in window && scrollContainer
    ? new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) activateMode(Number(visible.target.dataset.mode));
    }, { root: scrollContainer, threshold: [0.38, 0.58, 0.78] })
    : null;

  sections.forEach((section) => observer?.observe(section));

  function readParameters() {
    const values = {
      density: Number(densityInput?.value ?? 56) / 100,
      turbulence: Number(turbulenceInput?.value ?? 48) / 100,
      spectrum: Number(spectrumInput?.value ?? 52) / 100
    };
    if (densityOutput) densityOutput.value = String(Math.round(values.density * 100));
    if (turbulenceOutput) turbulenceOutput.value = String(Math.round(values.turbulence * 100));
    if (spectrumOutput) spectrumOutput.value = String(Math.round(values.spectrum * 100));
    lens?.setLabParams(values);
    sound?.setParams(values);
  }

  function handleCapture() {
    if (!lens) {
      setStatus('Live capture requires WebGL.', '即時擷取需要 WebGL。');
      return;
    }

    captureButton?.classList.add('is-capturing');
    try {
      const dataUrl = lens.capture();
      if (!dataUrl) throw new Error('No image data was returned.');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `weather-specimen-${String(currentMode + 1).padStart(2, '0')}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setStatus('Specimen preserved.', '標本已保存。');
    } catch (error) {
      console.warn('Unable to capture the specimen.', error);
      setStatus('Capture failed. Please try again.', '擷取失敗，請再試一次。');
    } finally {
      window.setTimeout(() => captureButton?.classList.remove('is-capturing'), 420);
    }
  }

  function handlePointer(event) {
    if (!lens || event.pointerType === 'touch') return;
    const x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
    lens.setPointer(x, y);
  }

  function handleKeyboard(event) {
    if (!event.altKey || !scrollContainer) return;
    if (event.target instanceof HTMLInputElement) return;
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const currentIndex = Math.max(0, sections.findIndex((section) => section.classList.contains('is-active')));
    const target = sections[Math.min(sections.length - 1, Math.max(0, currentIndex + direction))];
    target?.scrollIntoView({ behavior: mediaQuery?.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function handleMotionChange(event) {
    lens?.setReducedMotion(event.matches);
  }

  function handleResize() {
    lens?.resize();
    updateProgress();
  }

  listen(langToggle, 'click', handleLanguage);
  listen(soundToggle, 'click', handleSound);
  listen(scrollContainer, 'scroll', updateProgress, { passive: true });
  listen(densityInput, 'input', readParameters);
  listen(turbulenceInput, 'input', readParameters);
  listen(spectrumInput, 'input', readParameters);
  listen(captureButton, 'click', handleCapture);
  listen(window, 'pointermove', handlePointer, { passive: true });
  listen(document, 'keydown', handleKeyboard);
  listen(window, 'resize', handleResize, { passive: true });

  if (mediaQuery?.addEventListener) {
    listen(mediaQuery, 'change', handleMotionChange);
  } else if (mediaQuery?.addListener) {
    mediaQuery.addListener(handleMotionChange);
    cleanups.push(() => mediaQuery.removeListener(handleMotionChange));
  }

  soundToggle?.classList.toggle('is-disabled', !sound);
  soundToggle?.setAttribute('aria-disabled', String(!sound));
  captureButton?.classList.toggle('is-disabled', !lens);
  captureButton?.setAttribute('aria-disabled', String(!lens));

  applyLanguage();
  readParameters();
  updateProgress();
  lens?.setMode(0);
  sound?.setMode(0);
  sections[0]?.setAttribute('aria-current', 'true');

  return () => {
    observer?.disconnect();
    window.clearTimeout(statusTimer);
    cleanups.splice(0).forEach((cleanup) => cleanup());
  };
}
