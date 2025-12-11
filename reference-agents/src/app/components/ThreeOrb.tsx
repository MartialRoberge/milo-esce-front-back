'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ThreeOrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioLevel: number;
}

// ESCE Brand Colors
const COLORS = {
  blueESCE: new THREE.Color('#133677'),
  electricBlue: new THREE.Color('#0000f5'),
  luminescent: new THREE.Color('#75fb93'),
  darkBlue: new THREE.Color('#0f222e'),
  lightGrey: new THREE.Color('#9eaab8'),
  white: new THREE.Color('#ffffff'),
};

// Vertex Shader - naturalistic organic deformation
const vertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uAudioVelocity;
  uniform float uNoiseStrength;
  uniform float uReactivePhase;
  uniform float uMode; // 0-3 float for smooth transitions

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  // Simplex 3D Noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Base organic shape - always present, clearly non-spherical
    float breathTime = uTime * 0.1;
    float breathe = snoise(position * 0.35 + breathTime * 0.3) * 0.07;
    breathe += snoise(position * 0.6 + breathTime * 0.5 + 50.0) * 0.05;
    breathe += snoise(position * 0.9 + breathTime * 0.4 + 100.0) * 0.03;
    breathe += sin(uTime * 0.35) * 0.015; // Gentle pulse

    // Audio-reactive deformation with smooth mode blending

    // IDLE (mode ~0) - subtle organic drift
    float idleWave = snoise(position * 0.5 + uTime * 0.08) * 0.3;
    float idleDisp = idleWave * uNoiseStrength * 0.4;

    // LISTENING (mode ~1) - receptive undulations
    float listenWave = snoise(position * 0.8 + vec3(uReactivePhase * 0.4, 0.0, 0.0));
    float listenWave2 = snoise(position * 1.2 + vec3(0.0, uReactivePhase * 0.3, uTime * 0.1));
    float velocityRipple = snoise(position * 2.0 + uTime * 2.0) * uAudioVelocity * 0.5;
    float listenDisp = (listenWave * 0.4 + listenWave2 * 0.3 + velocityRipple) * uNoiseStrength;

    // PROCESSING (mode ~2) - contemplative movement
    float thinkWave = snoise(position * 0.5 + uTime * 0.3);
    float thinkWave2 = snoise(position * 0.8 + uTime * 0.2 + 30.0) * 0.5;
    float processDisp = (thinkWave + thinkWave2) * uNoiseStrength * 0.5;

    // SPEAKING (mode ~3) - rhythmic pulsations
    float speakPulse = sin(uReactivePhase * 3.0) * 0.3;
    float speakWave = snoise(position * 0.6 + vec3(uReactivePhase * 0.5, uTime * 0.2, 0.0));
    float speakDetail = snoise(position * 1.5 + uTime * 0.5) * 0.2;
    float speakDisp = (speakPulse + speakWave * 0.5 + speakDetail) * uNoiseStrength;

    // Smooth blending between modes using uMode as continuous float
    float idleWeight = 1.0 - smoothstep(0.0, 1.0, uMode);
    float listenWeight = smoothstep(0.0, 1.0, uMode) * (1.0 - smoothstep(1.0, 2.0, uMode));
    float processWeight = smoothstep(1.0, 2.0, uMode) * (1.0 - smoothstep(2.0, 3.0, uMode));
    float speakWeight = smoothstep(2.0, 3.0, uMode);

    float reactiveDisp = idleDisp * idleWeight
                       + listenDisp * listenWeight
                       + processDisp * processWeight
                       + speakDisp * speakWeight;

    // Total displacement
    float totalDisplacement = breathe + reactiveDisp;
    vDisplacement = totalDisplacement;

    vec3 newPosition = position + normal * totalDisplacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment Shader - gradient with brand colors
const fragmentShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform vec3 uColorCore;
  uniform vec3 uColorMid;
  uniform vec3 uColorEdge;
  uniform vec3 uColorGlow;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  void main() {
    // Fresnel effect for edge glow
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), 2.5);

    // Gradient from edge to core
    float gradientPos = (vPosition.y + 1.0) / 2.0;
    vec3 baseColor = mix(uColorEdge, uColorCore, gradientPos);

    // Subtle displacement color variation
    float dispColor = (vDisplacement + 0.5) * 0.5;
    baseColor = mix(baseColor, uColorMid, dispColor * 0.3);

    // Audio reactive brightness - subtle
    float brightness = 0.9 + uAudioLevel * 0.25;
    baseColor *= brightness;

    // Edge glow
    vec3 glowColor = uColorGlow * fresnel * (0.5 + uAudioLevel * 0.5);

    vec3 finalColor = baseColor + glowColor;

    float alpha = 0.94 + fresnel * 0.06;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function ThreeOrb({ state, audioLevel }: ThreeOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());
  const [isReady, setIsReady] = useState(false);

  // Audio processing refs
  const smoothAudioRef = useRef(0);
  const prevAudioRef = useRef(0);
  const audioVelocityRef = useRef(0);
  const reactivePhaseRef = useRef(0);
  const smoothNoiseStrengthRef = useRef(0.12);
  const smoothModeRef = useRef(0);

  // Refs to track current prop values in animation loop
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);

  // Update refs when props change
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !isReady) return;

    const container = containerRef.current;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Geometry - smooth sphere with high detail
    const geometry = new THREE.IcosahedronGeometry(0.7, 64);

    // Material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uAudioVelocity: { value: 0 },
        uNoiseStrength: { value: 0.08 },
        uReactivePhase: { value: 0 },
        uMode: { value: 0.0 },
        uColorCore: { value: COLORS.electricBlue },
        uColorMid: { value: COLORS.blueESCE },
        uColorEdge: { value: COLORS.darkBlue },
        uColorGlow: { value: COLORS.lightGrey },
      },
      transparent: true,
      side: THREE.FrontSide,
    });
    materialRef.current = material;

    // Mesh
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Resize
    const handleResize = () => {
      const newWidth = container.offsetWidth;
      const newHeight = container.offsetHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation
    const animate = () => {
      const elapsedTime = clockRef.current.getElapsedTime();
      const currentState = stateRef.current;
      const rawAudio = audioLevelRef.current;

      // Smooth audio level
      smoothAudioRef.current += (rawAudio - smoothAudioRef.current) * 0.08;
      const audio = smoothAudioRef.current;

      // Calculate audio velocity (rate of change)
      const audioDelta = Math.abs(audio - prevAudioRef.current);
      audioVelocityRef.current += (audioDelta * 10 - audioVelocityRef.current) * 0.15;
      prevAudioRef.current = audio;
      const velocity = Math.min(audioVelocityRef.current, 1.0);

      // Determine mode and target values
      let targetMode = 0;
      let targetNoiseStrength = 0.08; // Subtle organic movement at rest
      let phaseAccumRate = 0.008; // Base slow evolution
      let phaseDecayRate = 0.015; // How fast reactive phase returns to 0

      switch (currentState) {
        case 'listening':
          targetMode = 1;
          targetNoiseStrength = 0.14 + audio * 0.12;
          phaseAccumRate = 0.015 + audio * 0.06;
          phaseDecayRate = 0.004;
          break;
        case 'processing':
          targetMode = 2;
          targetNoiseStrength = 0.16;
          phaseAccumRate = 0.02;
          phaseDecayRate = 0.006;
          break;
        case 'speaking':
          targetMode = 3;
          targetNoiseStrength = 0.14 + audio * 0.1;
          phaseAccumRate = 0.012 + audio * 0.05;
          phaseDecayRate = 0.005;
          break;
        default: // idle
          targetMode = 0;
          targetNoiseStrength = 0.1;
          phaseAccumRate = 0.005;
          phaseDecayRate = 0.008;
      }

      // Smooth mode transition (0-3 float for shader interpolation)
      smoothModeRef.current += (targetMode - smoothModeRef.current) * 0.025;

      // Update reactive phase - accumulates when active, decays gently
      if (currentState === 'idle') {
        // Gentle decay towards zero when idle
        reactivePhaseRef.current *= (1 - phaseDecayRate);
      } else {
        // Accumulate when active
        reactivePhaseRef.current += phaseAccumRate;
      }

      // Very smooth noise strength transition for fluid feel
      smoothNoiseStrengthRef.current += (targetNoiseStrength - smoothNoiseStrengthRef.current) * 0.018;

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = elapsedTime;
        materialRef.current.uniforms.uAudioLevel.value = audio;
        materialRef.current.uniforms.uAudioVelocity.value = velocity;
        materialRef.current.uniforms.uNoiseStrength.value = smoothNoiseStrengthRef.current;
        materialRef.current.uniforms.uReactivePhase.value = reactivePhaseRef.current;
        materialRef.current.uniforms.uMode.value = smoothModeRef.current;
      }

      // Subtle rotation
      if (meshRef.current) {
        meshRef.current.rotation.y = elapsedTime * 0.05;
        meshRef.current.rotation.x = Math.sin(elapsedTime * 0.08) * 0.05;
        meshRef.current.rotation.z = Math.sin(elapsedTime * 0.06) * 0.03;

        // Gentle floating
        meshRef.current.position.y = Math.sin(elapsedTime * 0.3) * 0.02;

        // Scale - very subtle breathing + gentle audio response
        const scaleBase = 1.0;
        const scaleAudio = audio * 0.025;
        const scaleBreathe = Math.sin(elapsedTime * 0.4) * 0.008;
        meshRef.current.scale.setScalar(scaleBase + scaleAudio + scaleBreathe);
      }

      // Update white glow behind orb - subtle and smooth
      if (glowRef.current) {
        const isActive = currentState === 'listening' || currentState === 'speaking';
        const baseOpacity = isActive ? 0.04 + audio * 0.25 : 0.02;
        const baseScale = 1.0 + audio * 0.1;
        glowRef.current.style.opacity = String(baseOpacity);
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${baseScale})`;
      }

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [isReady]);

  return (
    <>
      {/* White glow halo - very diffuse, no visible edges */}
      <div
        ref={glowRef}
        className="fixed pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: `radial-gradient(circle,
            rgba(255, 255, 255, 0.5) 0%,
            rgba(255, 255, 255, 0.25) 20%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.03) 60%,
            transparent 80%)`,
          zIndex: 1,
          opacity: 0.05,
          filter: 'blur(80px)',
        }}
      />

      {/* Orb container */}
      <div
        ref={containerRef}
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 2 }}
      />
    </>
  );
}
