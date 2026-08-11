import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const BACKGROUND_VERTEX = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BACKGROUND_FRAGMENT = `
  precision highp float;

  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uMode;
  uniform float uPreviousMode;
  uniform float uTransition;
  uniform float uDensity;
  uniform float uTurbulence;
  uniform float uSpectrum;

  varying vec2 vUv;

  const float PI = 3.14159265359;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);

    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);

    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * valueNoise(point);
      point = turn * point * 2.03 + vec2(13.7, 7.9);
      amplitude *= 0.49;
    }
    return value;
  }

  float ridged(vec2 point) {
    float value = fbm(point);
    return 1.0 - abs(value * 2.0 - 1.0);
  }

  float falloff(float nearEdge, float farEdge, float value) {
    return 1.0 - smoothstep(nearEdge, farEdge, value);
  }

  vec3 spectrumShift(vec3 cold, vec3 warm, float amount) {
    return mix(cold, warm, clamp(amount, 0.0, 1.0));
  }

  vec3 renderGlassRain(vec2 point, float time) {
    vec3 ink = vec3(0.008, 0.026, 0.031);
    vec3 slate = vec3(0.055, 0.125, 0.132);
    vec3 moon = vec3(0.68, 0.82, 0.82);
    vec3 bronze = vec3(0.65, 0.42, 0.25);

    vec2 drift = vec2(time * 0.012, -time * 0.018);
    float lowCloud = fbm(point * 1.45 + drift + vec2(0.0, 0.3));
    float veil = fbm(point * 3.2 - drift * 1.7);
    float horizon = exp(-abs(point.y + 0.03) * 2.2);
    vec3 color = mix(ink, slate, smoothstep(0.3, 0.88, lowCloud) * 0.72);
    color += moon * horizon * 0.055 * (0.5 + veil);

    float density = mix(0.08, 0.28, uDensity);
    float rain = 0.0;
    float flare = 0.0;

    for (int layer = 0; layer < 3; layer++) {
      float index = float(layer);
      float scale = 54.0 + index * 34.0;
      vec2 rainPoint = point;
      rainPoint.x += rainPoint.y * (0.16 + index * 0.025);
      vec2 grid = rainPoint * vec2(scale, scale * 0.22);
      vec2 cell = floor(grid);
      float random = hash21(cell + index * 19.1);
      float gate = step(1.0 - density * (1.0 - index * 0.16), random);
      float localX = abs(fract(grid.x + random * 0.35) - 0.5);
      float localY = abs(fract(grid.y - time * (0.72 + index * 0.19) + random) - 0.5);
      float streak = falloff(0.0, 0.035, localX)
        * falloff(0.08, 0.48, localY) * gate;
      rain += streak * (0.7 - index * 0.16);
      flare += streak * falloff(0.0, 0.28, abs(point.x - 0.18));
    }

    float caustic = pow(max(0.0, ridged(point * 4.5 + vec2(time * 0.03, -time * 0.015)) - 0.72), 2.0);
    float shaft = exp(-abs(point.x + point.y * 0.16 - 0.2) * 4.2)
      * smoothstep(-0.62, 0.5, point.y);
    vec3 rainTint = spectrumShift(moon, bronze, uSpectrum * 0.52);

    color += rainTint * rain * 0.72;
    color += rainTint * flare * 0.48;
    color += moon * caustic * 0.13;
    color += spectrumShift(vec3(0.11, 0.21, 0.23), bronze, uSpectrum * 0.35)
      * shaft * 0.12 * (0.3 + lowCloud);
    return color;
  }

  vec3 renderMagneticFog(vec2 point, float time) {
    vec3 ink = vec3(0.008, 0.024, 0.027);
    vec3 fogGrey = vec3(0.24, 0.31, 0.30);
    vec3 oxidized = vec3(0.20, 0.48, 0.43);
    vec3 silver = vec3(0.63, 0.72, 0.68);

    vec2 slow = vec2(time * 0.018, -time * 0.011);
    vec2 warp = vec2(
      fbm(point * 1.2 + slow),
      fbm(point * 1.2 - slow + vec2(8.4, 2.1))
    ) - 0.5;
    vec2 flowPoint = point + warp * (0.32 + uTurbulence * 0.58);

    float body = fbm(flowPoint * 2.0 + vec2(time * 0.012, 0.0));
    float filament = ridged(flowPoint * 4.7 - vec2(time * 0.026, time * 0.008));
    float depth = fbm(point * 0.78 + vec2(-time * 0.006, time * 0.004));
    float mass = smoothstep(0.28, 0.82, body + depth * 0.22);

    vec3 fogTint = spectrumShift(fogGrey, oxidized, 0.35 + uSpectrum * 0.48);
    vec3 color = mix(ink, fogTint, mass * (0.48 + uDensity * 0.25));
    color += silver * pow(max(0.0, filament - 0.72), 2.4) * 0.42;

    vec2 fieldCenter = point - vec2(0.18, -0.03);
    float radius = length(fieldCenter * vec2(0.92, 1.15));
    float angle = atan(fieldCenter.y, fieldCenter.x);
    float field = abs(sin(radius * 18.0 - angle * 2.0 + time * 0.09));
    field = smoothstep(0.985, 1.0, field);
    field *= falloff(0.15, 0.8, radius);
    color += oxidized * field * 0.014;

    float breathingLight = exp(-length(point - vec2(0.24, 0.06)) * 2.2);
    color += spectrumShift(oxidized, silver, uSpectrum) * breathingLight * 0.075;
    return color;
  }

  float jaggedNoise(float y, float seed, float scale) {
    float position = y * scale;
    float cell = floor(position);
    float local = fract(position);
    float first = hash21(vec2(cell, seed)) - 0.5;
    float second = hash21(vec2(cell + 1.0, seed)) - 0.5;
    return mix(first, second, local);
  }

  float lightningPath(float y, float seed) {
    return jaggedNoise(y, seed, 13.0) * 0.12
      + jaggedNoise(y, seed + 8.7, 37.0) * 0.035;
  }

  float lightningStroke(vec2 point, float time) {
    float mainCenter = -0.08 + lightningPath(point.y, 1.7);
    float mainDistance = abs(point.x - mainCenter);
    float mainCore = falloff(0.0, 0.0032, mainDistance)
      * smoothstep(-0.7, -0.55, point.y)
      * falloff(0.58, 0.72, point.y);
    float mainGlow = falloff(0.003, 0.024, mainDistance)
      * smoothstep(-0.7, -0.55, point.y)
      * falloff(0.58, 0.72, point.y) * 0.16;

    float branchStartA = 0.03;
    float branchCenterA = -0.08 + lightningPath(branchStartA, 1.7)
      + (point.y - branchStartA) * 0.56 + lightningPath(point.y, 4.2) * 0.8;
    float branchDistanceA = abs(point.x - branchCenterA);
    float branchA = (
      falloff(0.0, 0.0027, branchDistanceA)
      + falloff(0.0027, 0.018, branchDistanceA) * 0.12
    )
      * smoothstep(branchStartA, branchStartA + 0.07, point.y)
      * falloff(0.52, 0.64, point.y);

    float branchStartB = 0.20;
    float branchCenterB = -0.08 + lightningPath(branchStartB, 1.7)
      - (point.y - branchStartB) * 0.46 + lightningPath(point.y, 7.9);
    float branchDistanceB = abs(point.x - branchCenterB);
    float branchB = (
      falloff(0.0, 0.0024, branchDistanceB)
      + falloff(0.0024, 0.016, branchDistanceB) * 0.11
    )
      * smoothstep(branchStartB, branchStartB + 0.06, point.y)
      * falloff(0.55, 0.66, point.y);

    float pulse = 0.9 + pow(max(0.0, sin(time * 1.45 + 1.2)), 18.0) * 2.6;
    return (mainCore + mainGlow + branchA * 0.82 + branchB * 0.74) * pulse;
  }

  vec3 renderReverseLightning(vec2 point, float time) {
    vec3 ink = vec3(0.006, 0.016, 0.024);
    vec3 storm = vec3(0.055, 0.075, 0.095);
    vec3 steel = vec3(0.28, 0.38, 0.46);
    vec3 electric = spectrumShift(
      vec3(0.64, 0.82, 0.98),
      vec3(0.82, 0.70, 0.56),
      uSpectrum * 0.45
    );

    vec2 cloudPoint = point * vec2(1.1, 1.65);
    float cloud = fbm(cloudPoint * 1.36 + vec2(time * 0.009, 0.18));
    float cloudDetail = ridged(cloudPoint * 3.4 - vec2(time * 0.015, 0.0));
    float canopy = smoothstep(-0.62, 0.55, point.y);
    vec3 color = mix(ink, storm, smoothstep(0.25, 0.84, cloud) * canopy);
    color += steel * pow(max(0.0, cloudDetail - 0.79), 2.0) * 0.17 * canopy;

    vec2 boltPoint = point;
    boltPoint.x -= uPointer.x * 0.045;
    float bolt = lightningStroke(boltPoint, time);
    float center = -0.08 + lightningPath(point.y, 1.7);
    float halo = exp(-abs(point.x - center) * 34.0)
      * smoothstep(-0.72, -0.48, point.y)
      * falloff(0.52, 0.74, point.y);
    float ground = exp(-abs(point.y + 0.61) * 22.0) * exp(-abs(point.x + 0.08) * 3.0);
    float flash = pow(max(0.0, sin(time * 1.45 + 1.2)), 18.0);

    color += electric * bolt * 3.8;
    color += electric * halo * (0.028 + flash * 0.22);
    color += electric * ground * (0.16 + flash * 0.5);
    return color;
  }

  vec3 renderTidalAurora(vec2 point, float time) {
    vec3 ink = vec3(0.006, 0.020, 0.029);
    vec3 deepBlue = vec3(0.04, 0.10, 0.14);
    vec3 mint = vec3(0.28, 0.72, 0.58);
    vec3 pearl = vec3(0.72, 0.78, 0.68);
    vec3 violet = vec3(0.37, 0.31, 0.55);

    float sky = smoothstep(-0.7, 0.7, point.y);
    float cloud = fbm(point * 1.5 + vec2(time * 0.006, 0.0));
    vec3 color = mix(ink, deepBlue, sky * 0.48 + cloud * 0.12);

    float curtains = 0.0;
    vec3 curtainColor = vec3(0.0);
    for (int ribbon = 0; ribbon < 4; ribbon++) {
      float index = float(ribbon);
      float phase = index * 1.73;
      float center = 0.16 + index * 0.085
        + sin(point.x * (1.65 + index * 0.12) + time * (0.16 + index * 0.018) + phase) * (0.075 + index * 0.012)
        + sin(point.x * 4.2 - time * 0.09 + phase) * 0.018;
      float distanceToRibbon = abs(point.y - center);
      float ribbonBody = exp(-distanceToRibbon * (12.0 + index * 2.0));
      float strand = 0.36 + 0.64 * pow(
        abs(sin(point.x * (38.0 + index * 7.0) + phase + fbm(point * 2.0) * 3.0)),
        5.0
      );
      float fade = smoothstep(-0.72, -0.22, point.x) * falloff(0.42, 0.84, point.x);
      float amount = ribbonBody * strand * fade * (0.38 - index * 0.052);
      vec3 ribbonTint = mix(mint, index > 1.5 ? violet : pearl, 0.22 + index * 0.18 + uSpectrum * 0.28);
      curtains += amount;
      curtainColor += ribbonTint * amount;
    }

    float tidalGlow = exp(-abs(point.y - 0.19) * 3.6) * 0.09;
    float lowerMist = fbm(point * 2.1 - vec2(time * 0.008, 0.0))
      * falloff(-0.65, 0.08, point.y);
    color += curtainColor * (1.08 + uDensity * 0.56);
    color += mix(mint, pearl, uSpectrum) * tidalGlow;
    color += deepBlue * lowerMist * 0.23;

    vec2 starSpace = (point + vec2(1.2, 0.8)) * 58.0;
    vec2 starGrid = floor(starSpace);
    vec2 starLocal = fract(starSpace) - 0.5;
    float starRandom = hash21(starGrid);
    float star = step(0.994, starRandom)
      * falloff(0.0, 0.12, length(starLocal))
      * smoothstep(0.05, 0.34, point.y);
    color += pearl * star * (0.24 + 0.22 * sin(time + starRandom * 10.0));
    return color;
  }

  vec3 renderWeather(float mode, vec2 point, float time) {
    if (mode < 0.5) return renderGlassRain(point, time);
    if (mode < 1.5) return renderMagneticFog(point, time);
    if (mode < 2.5) return renderReverseLightning(point, time);
    return renderTidalAurora(point, time);
  }

  void main() {
    vec2 point = (gl_FragCoord.xy - 0.5 * uResolution.xy) / max(1.0, uResolution.y);
    point += uPointer * vec2(0.016, 0.012);

    float slowedTime = uTime * mix(0.62, 1.15, uTurbulence);
    vec3 previous = renderWeather(uPreviousMode, point, slowedTime);
    vec3 current = renderWeather(uMode, point, slowedTime);

    float transitionNoise = valueNoise(point * 2.4 + vec2(uTime * 0.05, 0.0)) - 0.5;
    float transitionEdge = mix(-0.18, 1.18, uTransition) + transitionNoise * 0.1;
    float reveal = 1.0 - smoothstep(
      transitionEdge - 0.12,
      transitionEdge + 0.12,
      vUv.y
    );
    vec3 color = mix(previous, current, reveal);

    float vignette = falloff(0.18, 1.05, length(point * vec2(0.78, 1.05)));
    color *= 0.68 + vignette * 0.44;
    float grain = hash21(gl_FragCoord.xy + fract(uTime) * 117.0) - 0.5;
    color += grain * 0.012;

    color = color / (color + vec3(0.92));
    color = pow(max(color, 0.0), vec3(0.92));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const AEROSOL_VERTEX = `
  uniform float uTime;
  uniform float uMode;
  uniform float uDensity;
  uniform float uTurbulence;
  uniform vec2 uPointer;

  attribute float aSeed;
  attribute float aSize;
  varying float vAlpha;
  varying float vMode;

  const float TAU = 6.28318530718;

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  void main() {
    vec3 point = position;
    float visible = step(aSeed, mix(0.08, 0.58, uDensity));
    float alpha = 0.0;

    if (uMode < 0.5) {
      float speed = mix(0.42, 1.05, aSeed);
      point.y = 4.8 - mod(4.8 - point.y + uTime * speed, 9.6);
      point.x += point.y * 0.12;
      alpha = visible * 0.18;
    } else if (uMode < 1.5) {
      float turn = uTime * (0.025 + uTurbulence * 0.08) + aSeed * 0.4;
      point.xz = rotate2d(turn) * point.xz;
      point.y += sin(uTime * 0.15 + aSeed * TAU) * 0.28;
      alpha = visible * (0.06 + aSize * 0.12);
    } else if (uMode < 2.5) {
      float life = fract(uTime * 0.11 + aSeed);
      point.y = -4.2 + life * 8.4;
      point.x *= 0.16 + life * 0.22;
      point.z *= 0.35;
      alpha = step(aSeed, 0.12) * sin(life * 3.14159265) * 0.3;
    } else {
      point.y += sin(point.x * 0.7 + uTime * 0.2 + aSeed * TAU) * 0.34;
      point.x += sin(uTime * 0.08 + aSeed * 9.0) * 0.16;
      alpha = visible * 0.12;
    }

    point.x += uPointer.x * (0.08 + max(0.0, point.z) * 0.02);
    point.y += uPointer.y * 0.06;

    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp((1.0 + aSize * 2.8) * (270.0 / max(1.0, -viewPosition.z)), 0.8, 5.0);
    vAlpha = alpha;
    vMode = uMode;
  }
`;

const AEROSOL_FRAGMENT = `
  precision highp float;

  uniform float uSpectrum;
  varying float vAlpha;
  varying float vMode;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float halo = 1.0 - smoothstep(0.04, 0.5, length(point));
    if (halo < 0.01) discard;

    vec3 color;
    if (vMode < 0.5) {
      color = mix(vec3(0.58, 0.74, 0.76), vec3(0.72, 0.49, 0.30), uSpectrum * 0.35);
    } else if (vMode < 1.5) {
      color = mix(vec3(0.34, 0.55, 0.50), vec3(0.68, 0.72, 0.66), uSpectrum);
    } else if (vMode < 2.5) {
      color = vec3(0.70, 0.84, 0.96);
    } else {
      color = mix(vec3(0.32, 0.71, 0.58), vec3(0.50, 0.42, 0.68), uSpectrum);
    }
    gl_FragColor = vec4(color, halo * vAlpha);
  }
`;

const RAIN_VERTEX = `
  uniform float uTime;
  uniform float uVisibility;
  uniform float uTurbulence;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 point = position;
    float speed = 0.9 + aSeed * 1.5;
    point.y = 5.0 - mod(5.0 - point.y + uTime * speed, 10.0);
    point.x += point.y * (0.08 + uTurbulence * 0.05);
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vAlpha = uVisibility * (0.08 + aSeed * 0.2);
  }
`;

const RAIN_FRAGMENT = `
  precision highp float;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(0.62, 0.78, 0.80, vAlpha);
  }
`;

export function createWeatherLens(canvas, { reducedMotion = false } = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('A canvas element is required to create the weather lens.');
  }

  const compact = window.innerWidth < 768;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x02090c, 1);
  renderer.autoClear = false;

  const backgroundScene = new THREE.Scene();
  const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
  const backgroundMaterial = new THREE.ShaderMaterial({
    vertexShader: BACKGROUND_VERTEX,
    fragmentShader: BACKGROUND_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2() },
      uTime: { value: 8.0 },
      uMode: { value: 0 },
      uPreviousMode: { value: 0 },
      uTransition: { value: 1 },
      uDensity: { value: 0.56 },
      uTurbulence: { value: 0.48 },
      uSpectrum: { value: 0.52 }
    }
  });
  backgroundScene.add(new THREE.Mesh(backgroundGeometry, backgroundMaterial));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 40);
  camera.position.set(0, 0, 7.2);

  const atmosphere = new THREE.Group();
  scene.add(atmosphere);

  const aerosolCount = compact || coarsePointer ? 180 : 420;
  const aerosolPositions = new Float32Array(aerosolCount * 3);
  const aerosolSeeds = new Float32Array(aerosolCount);
  const aerosolSizes = new Float32Array(aerosolCount);

  for (let index = 0; index < aerosolCount; index += 1) {
    const offset = index * 3;
    aerosolPositions[offset] = (Math.random() - 0.5) * 10.5;
    aerosolPositions[offset + 1] = (Math.random() - 0.5) * 8.5;
    aerosolPositions[offset + 2] = (Math.random() - 0.5) * 5.0;
    aerosolSeeds[index] = Math.random();
    aerosolSizes[index] = Math.random();
  }

  const aerosolGeometry = new THREE.BufferGeometry();
  aerosolGeometry.setAttribute('position', new THREE.BufferAttribute(aerosolPositions, 3));
  aerosolGeometry.setAttribute('aSeed', new THREE.BufferAttribute(aerosolSeeds, 1));
  aerosolGeometry.setAttribute('aSize', new THREE.BufferAttribute(aerosolSizes, 1));

  const aerosolMaterial = new THREE.ShaderMaterial({
    vertexShader: AEROSOL_VERTEX,
    fragmentShader: AEROSOL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 8.0 },
      uMode: { value: 0 },
      uDensity: { value: 0.56 },
      uTurbulence: { value: 0.48 },
      uSpectrum: { value: 0.52 },
      uPointer: { value: new THREE.Vector2() }
    }
  });
  atmosphere.add(new THREE.Points(aerosolGeometry, aerosolMaterial));

  const rainCount = compact ? 48 : 110;
  const rainPositions = new Float32Array(rainCount * 6);
  const rainSeeds = new Float32Array(rainCount * 2);

  for (let index = 0; index < rainCount; index += 1) {
    const base = index * 6;
    const seed = Math.random();
    const x = (Math.random() - 0.5) * 11.5;
    const y = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 4.5;
    const length = 0.16 + Math.random() * 0.55;
    rainPositions[base] = x;
    rainPositions[base + 1] = y;
    rainPositions[base + 2] = z;
    rainPositions[base + 3] = x - length * 0.09;
    rainPositions[base + 4] = y - length;
    rainPositions[base + 5] = z;
    rainSeeds[index * 2] = seed;
    rainSeeds[index * 2 + 1] = seed;
  }

  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeometry.setAttribute('aSeed', new THREE.BufferAttribute(rainSeeds, 1));
  const rainMaterial = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 8.0 },
      uVisibility: { value: 1 },
      uTurbulence: { value: 0.48 }
    }
  });
  atmosphere.add(new THREE.LineSegments(rainGeometry, rainMaterial));

  const state = {
    mode: 0,
    previousMode: 0,
    transition: 1,
    density: 0.56,
    turbulence: 0.48,
    spectrum: 0.52,
    scroll: 0,
    time: 8.0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    reducedMotion: Boolean(reducedMotion),
    disposed: false
  };

  const drawingBufferSize = new THREE.Vector2();
  let rafId = null;
  let previousTimestamp = performance.now();

  function syncUniforms() {
    backgroundMaterial.uniforms.uTime.value = state.time;
    backgroundMaterial.uniforms.uMode.value = state.mode;
    backgroundMaterial.uniforms.uPreviousMode.value = state.previousMode;
    backgroundMaterial.uniforms.uTransition.value = state.transition;
    backgroundMaterial.uniforms.uDensity.value = state.density;
    backgroundMaterial.uniforms.uTurbulence.value = state.turbulence;
    backgroundMaterial.uniforms.uSpectrum.value = state.spectrum;
    backgroundMaterial.uniforms.uPointer.value.copy(state.pointer);

    aerosolMaterial.uniforms.uTime.value = state.time;
    aerosolMaterial.uniforms.uMode.value = state.mode;
    aerosolMaterial.uniforms.uDensity.value = state.density;
    aerosolMaterial.uniforms.uTurbulence.value = state.turbulence;
    aerosolMaterial.uniforms.uSpectrum.value = state.spectrum;
    aerosolMaterial.uniforms.uPointer.value.copy(state.pointer);

    rainMaterial.uniforms.uTime.value = state.time;
    rainMaterial.uniforms.uTurbulence.value = state.turbulence;
    rainMaterial.uniforms.uVisibility.value = state.mode === 0
      ? Math.min(1, state.transition * 1.4)
      : Math.max(0, 1 - state.transition * 1.4);
  }

  function render() {
    renderer.autoClear = true;
    renderer.render(backgroundScene, backgroundCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function update(delta, transitionDelta = delta) {
    state.pointer.lerp(state.pointerTarget, state.reducedMotion ? 1 : 0.045);
    state.transition = Math.min(1, state.transition + transitionDelta * 0.72);
    if (state.transition >= 1) state.previousMode = state.mode;
    state.time += delta;

    const mobile = window.innerWidth < 768;
    atmosphere.position.x = mobile ? 0 : 0.55;
    atmosphere.position.y = (0.5 - state.scroll) * 0.18;
    atmosphere.rotation.z = (state.scroll - 0.5) * 0.025;
    camera.position.x += (state.pointer.x * 0.22 - camera.position.x) * 0.03;
    camera.position.y += (state.pointer.y * 0.14 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    syncUniforms();
  }

  function frame(timestamp) {
    rafId = null;
    if (state.disposed || state.reducedMotion) return;
    const elapsed = Math.min(0.25, Math.max(0, (timestamp - previousTimestamp) / 1000));
    const delta = Math.min(0.05, elapsed);
    previousTimestamp = timestamp;
    update(delta, elapsed);
    render();
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (state.disposed || state.reducedMotion || rafId !== null) return;
    previousTimestamp = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function renderOnce() {
    if (state.disposed) return;
    update(0);
    render();
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const mobile = width < 768;
    camera.aspect = width / height;
    camera.fov = mobile ? 52 : 46;
    camera.position.z = mobile ? 7.8 : 7.2;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(drawingBufferSize);
    backgroundMaterial.uniforms.uResolution.value.copy(drawingBufferSize);
    renderOnce();
  }

  function setMode(index) {
    const nextMode = Math.round(Math.min(3, Math.max(0, Number(index) || 0)));
    if (nextMode === state.mode) return;
    state.previousMode = state.mode;
    state.mode = nextMode;
    state.transition = 0;
    if (state.reducedMotion) {
      state.transition = 1;
      renderOnce();
    }
  }

  function setPointer(x, y) {
    state.pointerTarget.set(
      Math.min(1, Math.max(-1, Number(x) || 0)),
      Math.min(1, Math.max(-1, Number(y) || 0))
    );
    if (state.reducedMotion) renderOnce();
  }

  function setScrollProgress(value) {
    state.scroll = clamp01(value);
    if (state.reducedMotion) renderOnce();
  }

  function setLabParams(params = {}) {
    if ('density' in params) state.density = clamp01(params.density);
    if ('turbulence' in params) state.turbulence = clamp01(params.turbulence);
    if ('spectrum' in params) state.spectrum = clamp01(params.spectrum);
    if (state.reducedMotion) renderOnce();
  }

  function setReducedMotion(value) {
    const next = Boolean(value);
    if (next === state.reducedMotion) return;
    state.reducedMotion = next;
    if (next) {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      state.transition = 1;
      renderOnce();
    } else {
      startLoop();
    }
  }

  function capture() {
    if (state.disposed) return null;
    renderOnce();
    try {
      return renderer.domElement.toDataURL('image/png');
    } catch (error) {
      console.warn('Unable to capture the weather specimen.', error);
      return null;
    }
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;

    backgroundGeometry.dispose();
    backgroundMaterial.dispose();
    aerosolGeometry.dispose();
    aerosolMaterial.dispose();
    rainGeometry.dispose();
    rainMaterial.dispose();
    renderer.dispose();
  }

  resize();
  syncUniforms();
  renderOnce();
  startLoop();

  return {
    setMode,
    setPointer,
    setScrollProgress,
    setLabParams,
    setReducedMotion,
    resize,
    capture,
    dispose,
    renderer,
    scene,
    camera
  };
}
