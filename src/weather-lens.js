import * as THREE from 'three';

const PALETTE = [
  new THREE.Color('#6A8CFF'),
  new THREE.Color('#67C7B5'),
  new THREE.Color('#DDA15E'),
  new THREE.Color('#B8A5FF')
];

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export function createWeatherLens(canvas, { reducedMotion = false } = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('A canvas element is required to create the weather lens.');
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const compactViewport = window.innerWidth < 768;
  const particleCount = compactViewport || coarsePointer ? 1400 : 3200;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: !compactViewport,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.setClearColor(0x071f26, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#071F26');
  scene.fog = new THREE.FogExp2('#071F26', 0.046);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 0, 8.8);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.HemisphereLight('#E4ECE7', '#071F26', 1.4));
  const keyLight = new THREE.PointLight('#6A8CFF', 38, 18, 2);
  keyLight.position.set(4, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight('#DDA15E', 26, 15, 2);
  rimLight.position.set(-4, -3, 3);
  scene.add(rimLight);

  const lensGeometry = new THREE.IcosahedronGeometry(1.28, compactViewport ? 2 : 4);
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: '#173942',
    emissive: '#071F26',
    emissiveIntensity: 0.65,
    metalness: 0.08,
    roughness: 0.14,
    transmission: 0.72,
    thickness: 1.25,
    ior: 1.34,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide
  });
  const condenser = new THREE.Mesh(lensGeometry, lensMaterial);
  world.add(condenser);

  const edgeGeometry = new THREE.EdgesGeometry(lensGeometry, 18);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: '#E4ECE7',
    transparent: true,
    opacity: 0.25
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.scale.setScalar(1.012);
  condenser.add(edges);

  const coreGeometry = new THREE.IcosahedronGeometry(0.36, 2);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE[0],
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  condenser.add(core);

  const rings = [];
  const ringRadii = [2.05, 2.65, 3.25];
  ringRadii.forEach((radius, index) => {
    const geometry = new THREE.TorusGeometry(radius, index === 0 ? 0.018 : 0.012, 8, 128);
    const material = new THREE.MeshBasicMaterial({
      color: PALETTE[(index + 1) % PALETTE.length],
      transparent: true,
      opacity: 0.34 - index * 0.06,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.set(Math.PI * (0.34 + index * 0.13), index * 0.62, index * 0.24);
    world.add(ring);
    rings.push(ring);
  });

  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const bands = new Float32Array(particleCount);

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * 11;
    positions[offset + 1] = (Math.random() - 0.5) * 11;
    positions[offset + 2] = (Math.random() - 0.5) * 8;
    seeds[index] = Math.random();
    sizes[index] = Math.random();
    bands[index] = Math.random();
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  particleGeometry.setAttribute('aBand', new THREE.BufferAttribute(bands, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: 0 },
      uDensity: { value: 0.56 },
      uTurbulence: { value: 0.48 },
      uSpectrum: { value: 0.52 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMode;
      uniform float uDensity;
      uniform float uTurbulence;
      uniform float uSpectrum;
      uniform vec2 uPointer;

      attribute float aSeed;
      attribute float aSize;
      attribute float aBand;

      varying float vAlpha;
      varying float vShape;
      varying vec3 vColor;

      const float TAU = 6.28318530718;

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      float waveNoise(vec3 point) {
        return sin(dot(point, vec3(1.73, 2.31, 0.91)) + aSeed * 37.0)
          * 0.5 + sin(dot(point, vec3(-0.83, 1.41, 2.07)) - aSeed * 19.0) * 0.5;
      }

      void main() {
        vec3 point = position;
        float visible = step(aSeed, mix(0.14, 1.0, uDensity));
        float alpha = visible;
        float size = mix(2.2, 7.8, aSize);
        vec3 ice = vec3(0.416, 0.549, 1.0);
        vec3 amber = vec3(0.867, 0.631, 0.369);
        vec3 mint = vec3(0.404, 0.780, 0.710);
        vec3 lilac = vec3(0.722, 0.647, 1.0);
        vec3 vellum = vec3(0.894, 0.925, 0.906);
        vec3 color = mix(ice, amber, clamp(uSpectrum + aSeed * 0.35 - 0.18, 0.0, 1.0));
        float shape = 0.0;

        if (uMode < 0.5) {
          float speed = mix(1.3, 3.8, aSeed) * mix(0.5, 1.4, uTurbulence);
          point.y = 5.5 - mod((5.5 - position.y) + uTime * speed + aSeed * 5.0, 11.0);
          point.x += sin(point.y * 0.7 + aSeed * TAU) * (0.05 + uTurbulence * 0.22);
          point.z += cos(uTime * 0.24 + aSeed * 12.0) * 0.18;
          alpha *= smoothstep(5.5, 3.8, point.y) * smoothstep(-5.5, -4.2, point.y);
          size *= 0.75 + uTurbulence * 0.55;
          shape = 0.0;
        } else if (uMode < 1.5) {
          float radius = length(point.xz);
          float angle = uTime * (0.08 + uTurbulence * 0.34) + point.y * 0.2 + aSeed * 0.6;
          point.xz = rotate2d(angle) * point.xz;
          float drift = waveNoise(point * 0.45 + uTime * 0.08);
          point += vec3(drift, sin(uTime * 0.28 + aSeed * TAU), -drift)
            * (0.3 + uTurbulence * 0.72);
          point.y *= 0.72;
          alpha *= (0.28 + 0.54 * aSize) * smoothstep(7.0, 1.0, radius);
          color = mix(mint, lilac, clamp(uSpectrum + drift * 0.18, 0.0, 1.0));
          size *= 1.35 + uTurbulence;
          shape = 1.0;
        } else if (uMode < 2.5) {
          float life = fract(uTime * (0.2 + uTurbulence * 0.18) + aSeed);
          float fork = (aBand - 0.5) * 2.0;
          point.y = -5.2 + life * 10.6;
          point.x = fork * pow(life, 0.72) * 3.8
            + sin(life * 31.0 + aSeed * 80.0) * (0.06 + uTurbulence * 0.14);
          point.z *= 0.16;
          alpha *= step(aSeed, mix(0.05, 0.38, uDensity))
            * sin(life * 3.14159265) * (0.48 + aSize * 0.52);
          color = mix(ice, vellum, clamp(uSpectrum + aSize * 0.3, 0.0, 1.0));
          size *= 0.72;
          shape = 2.0;
        } else {
          float lane = (aBand - 0.5) * 7.5;
          point.x = lane + sin(uTime * 0.17 + aSeed * TAU) * 0.42;
          point.y = sin(lane * 0.72 + uTime * (0.48 + uTurbulence * 0.5) + aSeed * 2.0)
            * (1.2 + uTurbulence * 1.1) + position.y * 0.18;
          point.z = -1.8 + cos(lane * 0.42 + uTime * 0.26) * 1.1 + position.z * 0.12;
          alpha *= 0.32 + 0.6 * aSize;
          color = mix(mint, lilac, clamp(uSpectrum + sin(lane) * 0.16, 0.0, 1.0));
          size *= 1.15;
          shape = 3.0;
        }

        point.x += uPointer.x * (0.12 + abs(point.z) * 0.025);
        point.y += uPointer.y * (0.12 + abs(point.z) * 0.025);

        vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(size * (300.0 / max(1.0, -viewPosition.z)), 1.5, 18.0);
        vAlpha = alpha;
        vColor = color;
        vShape = shape;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vShape;
      varying vec3 vColor;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceField;

        if (vShape < 0.5) {
          distanceField = abs(point.x) * 1.7 + abs(point.y) * 0.72;
        } else if (vShape < 1.5) {
          distanceField = length(point);
        } else if (vShape < 2.5) {
          distanceField = max(abs(point.x) * 1.55, abs(point.y) * 0.82);
        } else {
          distanceField = length(vec2(point.x * 0.65, point.y * 1.4));
        }

        float edge = 1.0 - smoothstep(0.2, 0.5, distanceField);
        float core = 1.0 - smoothstep(0.0, 0.16, distanceField);
        if (edge <= 0.01) discard;
        gl_FragColor = vec4(vColor * (edge + core * 0.85), vAlpha * edge);
      }
    `
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  world.add(particles);

  const auroraGeometry = new THREE.PlaneGeometry(13, 6.5, compactViewport ? 42 : 86, 24);
  const auroraMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTurbulence: { value: 0.48 },
      uSpectrum: { value: 0.52 }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uTurbulence;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vUv = uv;
        vec3 point = position;
        float waveA = sin(point.x * 0.72 + uTime * 0.42);
        float waveB = sin(point.x * 1.46 - uTime * 0.24 + point.y * 0.35);
        vWave = waveA * 0.65 + waveB * 0.35;
        point.y += vWave * (0.42 + uTurbulence * 0.72);
        point.z += cos(point.x * 0.38 + uTime * 0.2) * 0.55;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uSpectrum;
      varying vec2 vUv;
      varying float vWave;

      void main() {
        vec3 mint = vec3(0.404, 0.780, 0.710);
        vec3 lilac = vec3(0.722, 0.647, 1.0);
        vec3 color = mix(mint, lilac, clamp(uSpectrum + vWave * 0.18, 0.0, 1.0));
        float vertical = sin(vUv.y * 3.14159265);
        float horizontal = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float filaments = 0.42 + 0.58 * pow(abs(sin(vUv.y * 48.0 + vWave * 3.0)), 4.0);
        float alpha = vertical * horizontal * filaments * 0.28;
        gl_FragColor = vec4(color * 1.35, alpha);
      }
    `
  });
  const aurora = new THREE.Mesh(auroraGeometry, auroraMaterial);
  aurora.position.set(0, 0.15, -2.7);
  aurora.rotation.z = -0.08;
  world.add(aurora);

  const boltCount = compactViewport ? 2 : 3;
  const boltSegments = compactViewport ? 14 : 20;
  const lightningGeometry = new THREE.BufferGeometry();
  const lightningPositions = new Float32Array(boltCount * boltSegments * 6);
  lightningGeometry.setAttribute('position', new THREE.BufferAttribute(lightningPositions, 3));
  const lightningMaterial = new THREE.LineBasicMaterial({
    color: '#E4ECE7',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const lightning = new THREE.LineSegments(lightningGeometry, lightningMaterial);
  world.add(lightning);

  function regenerateLightning() {
    let cursor = 0;
    for (let bolt = 0; bolt < boltCount; bolt += 1) {
      let x = (bolt - (boltCount - 1) / 2) * 1.1 + (Math.random() - 0.5) * 0.5;
      let z = (Math.random() - 0.5) * 0.8;
      for (let segment = 0; segment < boltSegments; segment += 1) {
        const y0 = -4.3 + (segment / boltSegments) * 8.6;
        const y1 = -4.3 + ((segment + 1) / boltSegments) * 8.6;
        const nextX = x + (Math.random() - 0.5) * (0.22 + segment * 0.018);
        const nextZ = z + (Math.random() - 0.5) * 0.12;
        lightningPositions[cursor++] = x;
        lightningPositions[cursor++] = y0;
        lightningPositions[cursor++] = z;
        lightningPositions[cursor++] = nextX;
        lightningPositions[cursor++] = y1;
        lightningPositions[cursor++] = nextZ;
        x = nextX;
        z = nextZ;
      }
    }
    lightningGeometry.attributes.position.needsUpdate = true;
  }
  regenerateLightning();

  const state = {
    mode: 0,
    density: 0.56,
    turbulence: 0.48,
    spectrum: 0.52,
    scroll: 0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    accent: PALETTE[0].clone(),
    accentTarget: PALETTE[0].clone(),
    time: 0,
    reducedMotion: Boolean(reducedMotion),
    disposed: false
  };

  let rafId = null;
  let previousTimestamp = performance.now();
  let lastLightningRefresh = 0;

  function updateViewport() {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const mobile = width < 768;
    camera.aspect = width / height;
    camera.fov = mobile ? 55 : 48;
    camera.position.z = mobile ? 9.8 : 8.8;
    camera.updateProjectionMatrix();
    world.position.x = mobile ? 0 : Math.min(1.85, (width / height) * 0.72);
    world.scale.setScalar(mobile ? 0.82 : 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.55 : 2));
    renderer.setSize(width, height, false);
  }

  function updateScene(delta) {
    state.pointer.lerp(state.pointerTarget, state.reducedMotion ? 1 : 0.055);
    state.accent.lerp(state.accentTarget, state.reducedMotion ? 1 : 0.045);

    particleMaterial.uniforms.uTime.value = state.time;
    particleMaterial.uniforms.uMode.value = state.mode;
    particleMaterial.uniforms.uDensity.value = state.density;
    particleMaterial.uniforms.uTurbulence.value = state.turbulence;
    particleMaterial.uniforms.uSpectrum.value = state.spectrum;
    particleMaterial.uniforms.uPointer.value.copy(state.pointer);
    auroraMaterial.uniforms.uTime.value = state.time;
    auroraMaterial.uniforms.uTurbulence.value = state.turbulence;
    auroraMaterial.uniforms.uSpectrum.value = state.spectrum;

    coreMaterial.color.copy(state.accent);
    keyLight.color.copy(state.accent);
    edgeMaterial.color.copy(state.accent).lerp(new THREE.Color('#E4ECE7'), 0.44);
    rings.forEach((ring, index) => {
      ring.material.color.copy(state.accent).offsetHSL(index * 0.035, -0.03, index * 0.035);
    });

    const drift = state.time * (0.055 + state.turbulence * 0.055);
    condenser.rotation.y = drift + state.pointer.x * 0.24 + state.scroll * 0.34;
    condenser.rotation.x = Math.sin(state.time * 0.19) * 0.12 + state.pointer.y * 0.18;
    core.scale.setScalar(0.88 + Math.sin(state.time * 1.2) * 0.12);
    rings.forEach((ring, index) => {
      ring.rotation.z += delta * (0.045 + index * 0.026) * (index % 2 ? -1 : 1);
      ring.rotation.y += delta * (0.02 + index * 0.012);
    });

    world.rotation.z = (state.scroll - 0.5) * 0.1;
    world.position.y = (0.5 - state.scroll) * 0.32;
    camera.position.x += (state.pointer.x * 0.42 - camera.position.x) * 0.035;
    camera.position.y += (state.pointer.y * 0.34 - camera.position.y) * 0.035;
    camera.lookAt(world.position.x * 0.12, world.position.y * 0.12, 0);

    aurora.visible = state.mode === 3;
    lightning.visible = state.mode === 2;
    lightningMaterial.opacity = state.mode === 2
      ? 0.42 + Math.abs(Math.sin(state.time * 19)) * 0.55
      : 0;

    if (state.mode === 2 && state.time - lastLightningRefresh > 0.11) {
      regenerateLightning();
      lastLightningRefresh = state.time;
    }
  }

  function renderFrame(timestamp) {
    rafId = null;
    if (state.disposed || state.reducedMotion) return;
    const delta = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    previousTimestamp = timestamp;
    state.time += delta;
    updateScene(delta);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  function renderOnce() {
    if (state.disposed) return;
    updateScene(0);
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (state.disposed || state.reducedMotion || rafId !== null) return;
    previousTimestamp = performance.now();
    rafId = requestAnimationFrame(renderFrame);
  }

  function setMode(index) {
    const nextMode = Math.round(Math.min(3, Math.max(0, Number(index) || 0)));
    if (nextMode === state.mode) return;
    state.mode = nextMode;
    state.accentTarget.copy(PALETTE[nextMode]);
    regenerateLightning();
    if (state.reducedMotion) renderOnce();
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
    const nextValue = Boolean(value);
    if (nextValue === state.reducedMotion) return;
    state.reducedMotion = nextValue;
    if (nextValue) {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      renderOnce();
    } else {
      startLoop();
    }
  }

  function resize() {
    updateViewport();
    renderOnce();
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

    lensGeometry.dispose();
    lensMaterial.dispose();
    edgeGeometry.dispose();
    edgeMaterial.dispose();
    coreGeometry.dispose();
    coreMaterial.dispose();
    particleGeometry.dispose();
    particleMaterial.dispose();
    auroraGeometry.dispose();
    auroraMaterial.dispose();
    lightningGeometry.dispose();
    lightningMaterial.dispose();
    rings.forEach((ring) => {
      ring.geometry.dispose();
      ring.material.dispose();
    });
    renderer.dispose();
  }

  updateViewport();
  state.accentTarget.copy(PALETTE[0]);
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
