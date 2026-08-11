const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export function createWeatherSound() {
  let context = null;
  let master = null;
  let filter = null;
  let compressor = null;
  let lfo = null;
  let lfoDepth = null;
  let voices = [];
  let enabled = false;
  let disposed = false;
  let mode = 0;
  let params = { density: 0.56, turbulence: 0.48, spectrum: 0.52 };

  const modeFrequencies = [
    [73.42, 110],
    [65.41, 98],
    [82.41, 123.47],
    [55, 82.41]
  ];

  function setTarget(parameter, value, time = 0.4) {
    if (!context || !parameter) return;
    parameter.cancelScheduledValues(context.currentTime);
    parameter.setTargetAtTime(value, context.currentTime, Math.max(0.02, time));
  }

  function createGraph() {
    if (disposed || context) return Boolean(context);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    context = new AudioContextClass();
    master = context.createGain();
    filter = context.createBiquadFilter();
    compressor = context.createDynamicsCompressor();
    lfo = context.createOscillator();
    lfoDepth = context.createGain();

    master.gain.value = 0;
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 2.4;
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.08;
    compressor.release.value = 0.7;

    filter.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);

    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoDepth.gain.value = 80;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    const voiceTypes = ['sine', 'triangle', 'sine'];
    const detunes = [-7, 0, 9];
    voices = voiceTypes.map((type, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.detune.value = detunes[index];
      gain.gain.value = index === 1 ? 0.026 : 0.018;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      return { oscillator, gain };
    });

    applyState();
    return true;
  }

  function applyState() {
    if (!context || disposed) return;
    const pair = modeFrequencies[mode] || modeFrequencies[0];
    voices.forEach(({ oscillator, gain }, index) => {
      const octave = index === 2 ? 2 : 1;
      const frequency = pair[index % pair.length] * octave;
      setTarget(oscillator.frequency, frequency, 0.55);
      const densityGain = (0.009 + params.density * 0.024) * (index === 1 ? 1.12 : 0.82);
      setTarget(gain.gain, densityGain, 0.45);
    });

    setTarget(filter.frequency, 260 + params.spectrum * 1180 + mode * 55, 0.5);
    setTarget(filter.Q, 0.8 + params.turbulence * 5.5, 0.4);
    setTarget(lfo.frequency, 0.025 + params.turbulence * 0.19, 0.5);
    setTarget(lfoDepth.gain, 18 + params.turbulence * 190, 0.5);
    setTarget(master.gain, enabled ? 0.58 : 0, enabled ? 0.7 : 0.28);
  }

  function toggle() {
    if (disposed) return false;
    if (!context && !createGraph()) return false;
    context.resume?.().catch(() => {});
    enabled = !enabled;
    applyState();
    return enabled;
  }

  function setMode(nextMode) {
    mode = Math.round(Math.min(3, Math.max(0, Number(nextMode) || 0)));
    applyState();
  }

  function setParams(nextParams = {}) {
    if ('density' in nextParams) params.density = clamp01(nextParams.density);
    if ('turbulence' in nextParams) params.turbulence = clamp01(nextParams.turbulence);
    if ('spectrum' in nextParams) params.spectrum = clamp01(nextParams.spectrum);
    applyState();
  }

  function isEnabled() {
    return enabled;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;

    voices.forEach(({ oscillator }) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    });
    voices = [];

    if (lfo) {
      try {
        lfo.stop();
      } catch {
        // Already stopped.
      }
    }

    master?.disconnect();
    filter?.disconnect();
    compressor?.disconnect();
    lfo?.disconnect();
    lfoDepth?.disconnect();
    context?.close().catch(() => {});

    context = null;
    master = null;
    filter = null;
    compressor = null;
    lfo = null;
    lfoDepth = null;
  }

  return { toggle, setMode, setParams, isEnabled, dispose };
}
