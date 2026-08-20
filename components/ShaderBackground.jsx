"use client";

/*
 * Animated WebGL "plasma waves" background.
 * Adapted from a community component on 21st.dev (MIT-licensed).
 * See CREDITS.md for attribution. If you reuse this, keep the credit.
 */

import { useEffect, useRef } from 'react'
// Website copy: no voice pipeline here - the calm-render throttle never engages.
const isRenderCalm = () => false

const vsSource = `
  attribute vec4 aVertexPosition;
  void main() {
    gl_Position = aVertexPosition;
  }
`

// Dark amber liquid waves — subtle, voice-reactive depth shading
const fsSource = `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iFlow;
  uniform float iVoiceIntensity;
  uniform float iGold;            // 0 = cyan (command center), 1 = gold (original)

  const float overallSpeed    = 0.11;
  const float gridSmoothWidth = 0.015;
  const float axisWidth       = 0.05;
  const float majorLineWidth  = 0.025;
  const float minorLineWidth  = 0.0125;
  const float majorLineFreq   = 5.0;
  const float minorLineFreq   = 1.0;
  const float scale           = 5.0;
  const float minLineWidth    = 0.025;
  const float maxLineWidth    = 0.32;
  const float lineSpeed       = 1.0 * overallSpeed;
  const float baseAmplitude   = 0.65;
  const float lineFrequency   = 0.14;
  const float warpSpeed       = 0.3 * overallSpeed;
  const float warpFrequency   = 0.4;
  const float warpAmplitude   = 1.6;
  const float offsetFrequency = 0.45;
  const float offsetSpeed     = 1.1 * overallSpeed;
  const float minOffsetSpread = 0.7;
  const float maxOffsetSpread = 2.4;
  const int   linesPerGroup   = 10;

  // line colors are mixed per-frame from iGold (see main): cyan ↔ gold

  #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
  #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
  #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
  #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

  float random(float t) {
    return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
  }

  float getPlasmaY(float x, float horizontalFade, float offset, float amp) {
    return random(x * lineFrequency + iFlow * lineSpeed) * horizontalFade * amp + offset;
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord.xy / iResolution.xy;

    // Voice intensity — clearly reactive when Apex speaks (amplitude + brightness + flow)
    float voiceBoost = iVoiceIntensity;
    vec4 lineColorBase = mix(vec4(0.06, 0.45, 0.55, 1.0), vec4(0.62, 0.40, 0.06, 1.0), iGold);
    vec4 lineColorCool = mix(vec4(0.03, 0.28, 0.38, 1.0), vec4(0.42, 0.27, 0.04, 1.0), iGold);
    float lineAmplitude = baseAmplitude * (1.0 + voiceBoost * 2.8);
    float brightnessBoost = 1.0 + voiceBoost * 2.2;

    vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;

    float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
    float verticalFade   = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);

    // Warp
    space.y += random(space.x * warpFrequency + iFlow * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);
    space.x += random(space.y * warpFrequency + iFlow * warpSpeed + 2.0) * warpAmplitude * horizontalFade;

    // -- Depth: radial darkening at center (orb area), gold edge glow --
    // UV-space distance from center
    vec2 centerUv = uv - vec2(0.5, 0.48);
    float centerDist = length(centerUv * vec2(1.0, iResolution.x / iResolution.y));
    // Center stays very dark; edges pick up warm gold
    float edgeGlow  = smoothstep(0.15, 0.55, centerDist);
    // Bottom vertical glow — ground-level warmth
    float bottomGlow = smoothstep(0.65, 0.0, uv.y) * 0.35;
    // Upper-corner vignette — slightly cooler/darker
    float cornerDark = smoothstep(0.4, 0.8, length((uv - vec2(0.5, 0.5)) * 1.6));

    // Background: near-pure black, barely warm at edges
    vec4 bgCenter = vec4(0.001, 0.002, 0.003, 1.0);
    vec4 bgEdge   = mix(vec4(0.001, 0.006, 0.010, 1.0), vec4(0.009, 0.005, 0.001, 1.0), iGold);
    vec4 fragColor = mix(bgCenter, bgEdge, edgeGlow * 0.45 + bottomGlow * 0.6);
    fragColor *= verticalFade * 0.92 + 0.08;
    fragColor.a = 1.0;

    // -- Lines --
    vec4 lines = vec4(0.0);
    for (int l = 0; l < linesPerGroup; l++) {
      float normalizedIdx = float(l) / float(linesPerGroup);
      float offsetTime     = iFlow * offsetSpeed;
      float offsetPos      = float(l) + space.x * offsetFrequency;
      float rand = random(offsetPos + offsetTime) * 0.5 + 0.5;
      float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
      float offset    = random(offsetPos + offsetTime * (1.0 + normalizedIdx)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
      float linePos   = getPlasmaY(space.x, horizontalFade, offset, lineAmplitude);
      float line = drawSmoothLine(linePos, halfWidth, space.y) / 2.0
                 + drawCrispLine(linePos, halfWidth * 0.15, space.y);

      float circleX = mod(float(l) + iFlow * lineSpeed, 25.0) - 12.0;
      vec2  circlePos = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset, lineAmplitude));
      float circle = drawCircle(circlePos, 0.01, space) * 4.0;
      line += circle;

      // Depth-tinted color: warmer near bottom, cooler near top-center
      float depthTint = uv.y * 0.4 + normalizedIdx * 0.3;
      vec4  lineColor = mix(lineColorCool, lineColorBase, depthTint);
      lines += line * lineColor * rand;
    }

    // Very subtle glossy ring — barely visible
    float glossRing = smoothstep(0.38, 0.42, centerDist) * smoothstep(0.58, 0.42, centerDist);
    fragColor += mix(vec4(0.06, 0.42, 0.55, 0.0), vec4(0.62, 0.40, 0.06, 0.0), iGold) * glossRing * 0.03;

    fragColor += lines * brightnessBoost;
    gl_FragColor = fragColor;
  }
`

function loadShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function initShaderProgram(gl, vs, fs) {
  const vertexShader   = loadShader(gl, gl.VERTEX_SHADER, vs)
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fs)
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Shader link error:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

export default function ShaderBackground({ opacity = 0.18, voiceActive = false, gold = false }) {
  const canvasRef      = useRef(null)
  const voiceRef       = useRef(0)          // current interpolated intensity 0–1
  const voiceTargetRef = useRef(0)          // target: 0 or 1
  const flowRef        = useRef(0)          // accumulated wave-flow time (advances faster when speaking)
  const goldRef        = useRef(gold ? 1 : 0)        // current 0=cyan → 1=gold
  const goldTargetRef  = useRef(gold ? 1 : 0)

  // Smoothly ramp voice intensity
  useEffect(() => {
    voiceTargetRef.current = voiceActive ? 1.0 : 0.0
  }, [voiceActive])

  // Smoothly cross-fade wave colour (cyan ↔ gold) when the design mode toggles
  useEffect(() => {
    goldTargetRef.current = gold ? 1.0 : 0.0
  }, [gold])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    const program = initShaderProgram(gl, vsSource, fsSource)
    if (!program) return

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const programInfo = {
      program,
      attribLocations: { vertexPosition: gl.getAttribLocation(program, 'aVertexPosition') },
      uniformLocations: {
        resolution:     gl.getUniformLocation(program, 'iResolution'),
        time:           gl.getUniformLocation(program, 'iFlow'),
        voiceIntensity: gl.getUniformLocation(program, 'iVoiceIntensity'),
        gold:           gl.getUniformLocation(program, 'iGold'),
      },
    }

    const resize = () => {
      canvas.width  = canvas.clientWidth || window.innerWidth
      canvas.height = canvas.clientHeight || window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    let rafId
    const startTime = Date.now()
    let lastFrame = Date.now()
    let calmFrame = 0

    const render = () => {
      // [perf] Tier B Step 1: render the golden waves at HALF rate while a reply streams / Apex speaks —
      // frees the main thread for audio delivery. Flow is time-based (dt), so the wave SPEED is unchanged,
      // just fewer draws (a slightly choppier shimmer for ~2s). Idle = full rate, look unchanged.
      if (isRenderCalm() && (++calmFrame & 1)) { rafId = requestAnimationFrame(render); return }
      const now = Date.now()
      const dt  = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      // Smooth lerp toward target (0.5s attack, 1.5s release)
      const rate = voiceTargetRef.current > voiceRef.current ? dt * 2.0 : dt * 0.67
      voiceRef.current += (voiceTargetRef.current - voiceRef.current) * Math.min(rate * 4, 1)

      // Flow advances faster while Apex speaks (up to ~3.4x), smoothly — no phase jump
      flowRef.current += dt * (1.0 + voiceRef.current * 2.4)
      goldRef.current += (goldTargetRef.current - goldRef.current) * Math.min(dt * 3, 1)  // cyan↔gold cross-fade
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(programInfo.program)
      gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height)
      gl.uniform1f(programInfo.uniformLocations.time, flowRef.current)
      gl.uniform1f(programInfo.uniformLocations.voiceIntensity, voiceRef.current)
      gl.uniform1f(programInfo.uniformLocations.gold, goldRef.current)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',   // site copy: contained in the world section
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0,
        opacity,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }}
    />
  )
}
