"use client";

/**
 * ApexCore3D â€” Command-Center core, with selectable variants:
 *   geodesic  â€” gold icosahedron wireframe + glowing nodes
 *   meridian  â€” smooth sphere lat/long lines (round connections) + nodes
 *   gyro      â€” tilted drifting rings, each with a cyan light-ball orbiting it
 * All variants share the cyan particle core (boiling ball â†’ spread) + the
 * narrow mouse stream. Gold + cyan, bloom, parallax, state reactivity.
 */
import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
// Website copy: no voice pipeline here - the calm-render throttle is never engaged.
const isRenderCalm = () => false

// The DECORATIVE 3D orb must never crash the whole app. After a few minutes the WebGL context can be
// lost (GPU pressure) and the Bloom post-processing then renders against a null context â†’ an uncaught
// TypeError that blanked the page. This boundary catches any render error from the canvas subtree,
// hides the orb, and retries a remount a few seconds later (context often recovers). Chat/UI survive.
class OrbBoundary extends React.Component {
  constructor(props) { super(props); this.state = { dead: false }; this._tries = 0 }
  static getDerivedStateFromError() { return { dead: true } }
  componentDidCatch(err) {
    try { console.warn('[orb] 3D crashed â€” hiding orb:', err?.message) } catch {}
    clearTimeout(this._t)
    // Retry a remount a few times (context often recovers); after that, stay hidden â€” the app is fine
    // without the decorative orb, and a permanently-lost context shouldn't thrash forever.
    if (this._tries < 3) {
      this._tries += 1
      this._t = setTimeout(() => this.setState({ dead: false }), 8000)
    }
  }
  componentWillUnmount() { clearTimeout(this._t) }
  render() { return this.state.dead ? null : this.props.children }
}

const GOLD = '#f5a623'
const GOLDLINE = '#ffb733'   // warmer, brighter amber for the lines/rings (matches original glow)
const GOLDNODE = '#ffe6ad'   // light gold for the glowing nodes
const CYAN = '#00e5ff'
const BALL = '#c8f7ff'
const N = 1200
const ARM_N = 340   // particles forming the stream/arm to the cursor (rest = the ball)
const GREEN = 1.5
const RED = 2.05

const BG_VARIANTS = [
  { name: 'Subtle', css: [
    'radial-gradient(circle 22% at 50% 45%, rgba(0,229,255,0.08), transparent 70%)',
    'radial-gradient(ellipse 60% 62% at 50% 44%, rgba(245,166,35,0.10), transparent 62%)',
    'radial-gradient(ellipse 120% 120% at 50% 50%, #0a0c12 30%, #050608 60%, #010102 100%)',
  ].join(',') },
  { name: 'Strong', css: [
    'radial-gradient(circle 28% at 50% 45%, rgba(0,229,255,0.18), transparent 72%)',
    'radial-gradient(ellipse 72% 72% at 50% 44%, rgba(245,166,35,0.20), transparent 66%)',
    'radial-gradient(ellipse 130% 130% at 50% 50%, #0d1018 25%, #06080c 60%, #010103 100%)',
  ].join(',') },
  { name: 'Grid', css: [
    'radial-gradient(ellipse 55% 55% at 50% 44%, rgba(245,166,35,0.10), transparent 60%)',
    'repeating-linear-gradient(0deg, rgba(0,229,255,0.045) 0 1px, transparent 1px 46px)',
    'repeating-linear-gradient(90deg, rgba(0,229,255,0.045) 0 1px, transparent 1px 46px)',
    'radial-gradient(ellipse 120% 120% at 50% 50%, #080a10 30%, #04050a 60%, #010102 100%)',
  ].join(',') },
  { name: 'Nebula', css: [
    'radial-gradient(ellipse 42% 36% at 34% 38%, rgba(0,229,255,0.12), transparent 60%)',
    'radial-gradient(ellipse 46% 40% at 67% 62%, rgba(245,166,35,0.12), transparent 62%)',
    'radial-gradient(ellipse 34% 30% at 60% 28%, rgba(130,90,230,0.10), transparent 60%)',
    'radial-gradient(ellipse 130% 130% at 50% 50%, #090a12 26%, #05060b 62%, #010102 100%)',
  ].join(',') },
]

function normalizeState(state) {
  const s = String(state || '').toLowerCase()
  if (s.includes('think') || s.includes('process')) return 'processing'
  if (s.includes('listen')) return 'listening'
  if (s.includes('speak')) return 'speaking'
  return 'standby'
}

function makeSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// HUD equalizer (from the original orb) â€” taller toward the centre, gold, pulsing
function Equalizer() {
  const bars = 21
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const dist = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2)
        const h = 5 + (1 - dist) * 18
        const dur = 0.8 + (i % 5) * 0.18
        const delay = (i % 7) * 0.11
        return (
          <span key={i} style={{
            width: 3, height: h, borderRadius: 2,
            background: 'linear-gradient(#ffe6ad, #f5a623)',
            boxShadow: '0 0 6px rgba(245,166,35,0.55)',
            transformOrigin: 'center',
            animation: `apexEq ${dur}s ease-in-out ${delay}s infinite`,
          }} />
        )
      })}
    </div>
  )
}

function Core({ state, variant, corner = false, bigDock = false }) {
  const group = useRef()
  const points = useRef()
  const spreadRef = useRef(0)
  const rtRef = useRef(0.85)   // smoothed ball outer radius (state-driven)
  const armRef = useRef(0)     // smoothed arm engagement (0 asleep â†’ 1 awake)
  const ringsRef = useRef([])
  const ballsRef = useRef([])
  const st = normalizeState(state)

  const sprite = useMemo(makeSprite, [])
  const geoIco = useMemo(() => new THREE.IcosahedronGeometry(1.0, 2), [])
  const geoSphere = useMemo(() => new THREE.SphereGeometry(1.0, 16, 11), [])
  const tmp = useMemo(() => ({ mWorld: new THREE.Vector3(), mLocal: new THREE.Vector3(), inv: new THREE.Quaternion(), cw: new THREE.Vector3(), cl: new THREE.Vector3(), clSmooth: new THREE.Vector3(), lag: new THREE.Vector3(), perp: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(), targets: [], assign: [], tick: 0 }), [])

  const ringData = useMemo(() => [
    { r: 0.74, tube: 0.03, tilt: [0.5, 0.2, 0],    spin: 0.55,  ballSpeed: 1.4, phase: 0 },
    { r: 1.02, tube: 0.03, tilt: [-0.6, 0.5, 0.3], spin: -0.4,  ballSpeed: 1.0, phase: 2.1 },
    { r: 1.30, tube: 0.03, tilt: [0.3, -0.5, 0.6], spin: 0.3,   ballSpeed: 0.7, phase: 4.2 },
  ], [])

  const data = useMemo(() => {
    const dir = new Float32Array(N * 3)
    const coreR = new Float32Array(N)
    const shellR = new Float32Array(N)
    const phase = new Float32Array(N)
    const speed = new Float32Array(N)
    const armT = new Float32Array(N)   // >=0 â†’ stream particle (param along the arm); -1 â†’ ball particle
    const ballR = new Float32Array(N)  // radius inside the bubbling ball
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      dir[i * 3]     = Math.sin(phi) * Math.cos(theta)
      dir[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
      dir[i * 3 + 2] = Math.cos(phi)
      coreR[i]  = 0.02 + Math.random() * 0.09
      shellR[i] = 1.12 + Math.random() * (GREEN - 1.12)
      phase[i]  = Math.random() * Math.PI * 2
      speed[i]  = 0.7 + Math.random() * 1.7
      armT[i]   = i < ARM_N ? (i + 0.5) / ARM_N : -1   // even spread 0..1 along the stream
      ballR[i]  = 0.16 + Math.pow(Math.random(), 0.6) * 0.84  // normalized 0..1 fill of the ball
    }
    return { dir, coreR, shellR, phase, speed, armT, ballR }
  }, [])

  const positions = useMemo(() => new Float32Array(N * 3), [])
  const calmFrameRef = useRef(0)
  const calmStartRef = useRef(0)
  const calmCarryRef = useRef(0)

  useFrame((frame, dt) => {
    // [perf] Tier B Step 1: while a reply streams / Apex speaks, halve the per-frame particle work (skip
    // every other frame) so the main thread stops starving the WS audio-delivery queue. Two guards keep
    // the throttle from reading as a FROZEN orb (Ruben saw the ball stop mid-way through long replies):
    // (1) the skipped frame's dt is CARRIED into the next computed frame, so world-speed stays constant
    // at half fps; (2) the throttle applies only to the FIRST 10s of a continuous calm window â€” the
    // audio-starvation risk is the burst at reply start; a long reply gets the full show back after.
    if (isRenderCalm()) {
      const nowT = frame.clock.elapsedTime
      if (!calmStartRef.current) calmStartRef.current = nowT
      if (nowT - calmStartRef.current < 10) {
        calmFrameRef.current++
        if (calmFrameRef.current & 1) { calmCarryRef.current += dt; return }
      }
    } else {
      calmStartRef.current = 0
    }
    const d = Math.min(dt + calmCarryRef.current, 0.1)
    calmCarryRef.current = 0
    const t = frame.clock.elapsedTime
    const target = st === 'standby' ? 0 : 1
    spreadRef.current = THREE.MathUtils.lerp(spreadRef.current, target, 0.045)
    const spread = spreadRef.current

    const { dir, coreR, shellR, phase, speed, armT, ballR } = data
    const pos = positions

    // ===== PARTICLES variant: state-driven bubbling ball (arm to be re-implemented later) =====
    // Kept deliberately lean â€” no per-frame matrix/cursor work â€” so it never starves the
    // mic / speech-recognition pipeline.
    if (variant === 'particles') {
      const sleeping = st === 'standby', speaking = st === 'speaking'
      // In chat the orb is small in the corner â€” keep the ball well inside its ring so it
      // doesn't pop out; overview keeps the big expansion + escaping waves.
      const smallCorner = corner && !bigDock                       // engineering = tiny corner; chat = full-size dock
      // chat (bigDock) expands fuller than the tiny eng corner so the cyan cloud reads as a round cluster
      // bigDock (chat) fills its ring to the SAME ratio as overview: the chat ring is CSS-scaled 0.78
      // (CHAT_T) while the particle group keeps the overview world-scale, so chat Rt â‰ˆ overview Rt Ã— 0.78
      // (awake 1.5Ã—0.78â‰ˆ1.18) â€” was 0.98, which read as a tight blob instead of a filled circle.
      const baseTarget = sleeping ? (smallCorner ? 0.5 : (bigDock ? 0.62 : 0.58))
                       : speaking ? (smallCorner ? 0.6 : (bigDock ? 1.05 : 1.2))
                       : (smallCorner ? 0.72 : (bigDock ? 1.18 : 1.5))
      rtRef.current = THREE.MathUtils.lerp(rtRef.current, baseTarget, 0.05)
      const Rt = rtRef.current
      // Awake boil scales WITH the expanded radius (at a flat 0.12 over an Rt~1.2-1.5 ball the boil
      // was proportionally a third of the dormant one â€” read as stopped once the expansion converged).
      const bubbleAmp = smallCorner ? 0.05 : (sleeping ? 0.17 : 0.10 + 0.08 * Rt)
      const waveAmp = smallCorner ? 0.08 : 0.5                     // contain the speaking waves only in the small corner

      if (group.current) {
        group.current.rotation.x = 0.3
        group.current.rotation.y += d * 0.07          // gentle spin only
        group.current.rotation.z = 0
        if (corner) {
          // Track the ring's REAL on-screen centre (canvas is full-screen here) so the ball
          // sits in the corner ring no matter how the ring is transformed/the window resizes.
          const orbEl = document.querySelector('[data-apex-orb]')
          let placed = false
          if (orbEl && frame.gl) {
            const rect = orbEl.getBoundingClientRect()
            if (rect.width > 0) {
              const cv = frame.gl.domElement.getBoundingClientRect()
              const sx = rect.left + rect.width / 2, sy = rect.top + rect.height / 2
              const ndcx = ((sx - cv.left) / cv.width) * 2 - 1
              const ndcy = -(((sy - cv.top) / cv.height) * 2 - 1)
              tmp.v.set(ndcx, ndcy, 0.5).unproject(frame.camera)
              const denom = tmp.v.z - frame.camera.position.z
              const sParam = Math.abs(denom) < 1e-5 ? 0 : -frame.camera.position.z / denom
              tmp.w.copy(frame.camera.position).addScaledVector(tmp.v.sub(frame.camera.position), sParam)
              // CHAT (bigDock): the ring is dead-centred in [data-apex-orb] (ApexOrb frame mode, cy=H/2),
              // so the unprojected point above IS the true ring centre â€” no Y fudge. The eng tiny-corner
              // keeps its small lift. (Was a flat +0.08 â†’ the chat cloud sat high, off-centre.)
              tmp.w.y += bigDock ? 0 : 0.08
              group.current.position.lerp(tmp.w, 0.25) // smooth follow as the ring slides to the corner
              placed = true
            }
          }
          if (!placed) group.current.position.set(0, 0.10, 0)
          group.current.scale.setScalar(bigDock ? 0.55 : 0.45)   // chat docks FULL-size, eng stays small
        } else {
          group.current.position.set(0, 0, 0)          // overview: dead-centre so the web hub aligns
          group.current.scale.setScalar(0.55)
        }
        group.current.updateMatrixWorld(true)
        tmp.inv.copy(group.current.quaternion).invert()   // keep surround rings camera-facing
      }

      // Connection targets â€” DOM elements tagged [data-particle-target]. A FEW discrete
      // particles detach from the core, fly to each target and sit/orbit there until it's
      // gone. data-particle-count = how many; data-particle-mode = 'surround' | 'sit'.
      tmp.tick = (tmp.tick + 1) % 6
      if (tmp.tick === 0 && group.current && frame.gl) {
        const canvas = frame.gl.domElement
        const cr = canvas.getBoundingClientRect()
        tmp.targets.length = 0
        tmp.assign.length = 0
        // Canvas is now always full-screen, so target-mapping works in chat too â€” messengers
        // travel to agents/windows in both workspaces.
        if (cr.width > 0 && cr.height > 0) {
          document.querySelectorAll('[data-particle-target]').forEach(el => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return
            const mode = el.getAttribute('data-particle-mode') || 'sit'
            const tr = el.getAttribute('data-particle-anchor') === 'top-right'
            const sx = tr ? r.right - 14 : r.left + r.width / 2
            const sy = tr ? r.top + 14  : r.top + r.height / 2
            const ndcx = ((sx - cr.left) / cr.width) * 2 - 1
            const ndcy = -(((sy - cr.top) / cr.height) * 2 - 1)
            if (Math.abs(ndcx) > 1.1 || Math.abs(ndcy) > 1.1) return  // target off the canvas â†’ skip (no leak)
            tmp.v.set(ndcx, ndcy, 0.5).unproject(frame.camera)
            const denom = tmp.v.z - frame.camera.position.z
            const s = Math.abs(denom) < 1e-5 ? 0 : -frame.camera.position.z / denom
            tmp.w.copy(frame.camera.position).addScaledVector(tmp.v.sub(frame.camera.position), s)
            group.current.worldToLocal(tmp.w)
            if (Math.hypot(tmp.w.x, tmp.w.y, tmp.w.z) > 4.5) return   // sanity: absurdly far â†’ skip
            const count = Math.max(1, parseInt(el.getAttribute('data-particle-count'), 10) || 6)
            const ti = tmp.targets.length
            tmp.targets.push([tmp.w.x, tmp.w.y, tmp.w.z, mode])
            for (let q = 0; q < count && tmp.assign.length < ARM_N; q++) tmp.assign.push([ti, q, count])
          })
        }
      }
      const targets = tmp.targets, assign = tmp.assign, A = assign.length

      for (let i = 0; i < N; i++) {
        let dx, dy, dz
        if (armT[i] >= 0 && i < A) {
          // detached messenger particle â†’ fly to its target and sit/orbit there
          const a = assign[i], tg = targets[a[0]], slot = a[1], cnt = a[2]
          if (tg[3] === 'surround') {                       // camera-facing ring AROUND the agent node
            const ang = (slot / cnt) * Math.PI * 2 + t * 0.6
            tmp.v.set(Math.cos(ang) * 0.3, Math.sin(ang) * 0.3, 0).applyQuaternion(tmp.inv)
            dx = tg[0] + tmp.v.x
            dy = tg[1] + tmp.v.y
            dz = tg[2] + tmp.v.z
          } else {                                          // sit at the window corner (small lively cluster)
            const ja = (slot / cnt) * Math.PI * 2 + t * 0.5
            tmp.v.set(Math.cos(ja) * 0.09, Math.sin(ja) * 0.09, 0).applyQuaternion(tmp.inv)
            dx = tg[0] + tmp.v.x
            dy = tg[1] + tmp.v.y
            dz = tg[2] + tmp.v.z
          }
        } else {
          // bubbling ball (messengers return here when their target closes)
          let r = ballR[i] * Rt + Math.sin(t * speed[i] + phase[i]) * bubbleAmp
          if (speaking) r += Math.sin(ballR[i] * 5.5 - t * 5.0) * waveAmp
          else if (!sleeping) r += Math.sin(ballR[i] * 3.0 - t * 1.7) * (waveAmp * 0.22)  // awake: slow breathing ripple
          if (corner && !bigDock) r = Math.min(r, 0.66)   // hard cap only for the SMALL corner (eng); chat dock is full-size
          dx = dir[i * 3] * r; dy = dir[i * 3 + 1] * r; dz = dir[i * 3 + 2] * r
        }
        // ease toward the desired position so the travel is REAL (flies out and back);
        // messengers chase tighter so they keep up with a moving (orbiting) target.
        // BALL ease 0.09 â†’ 0.38: 0.09 low-pass-FILTERED the boil â€” the fast sine target was smoothed
        // to near-stillness once the expansion converged, so the awake ball froze after ~3s no matter
        // the amplitude (the real cause of Ruben's 'stops after a few seconds'). The expansion still
        // travels smoothly because Rt itself is lerped; the per-particle ease no longer eats the boil.
        const e = (armT[i] >= 0 && i < A) ? 0.2 : 0.38
        const k = i * 3
        pos[k]     += (dx - pos[k])     * e
        pos[k + 1] += (dy - pos[k + 1]) * e
        pos[k + 2] += (dz - pos[k + 2]) * e
      }
      if (points.current) {
        points.current.geometry.attributes.position.needsUpdate = true
        points.current.material.size = sleeping ? 0.026 : 0.018  // finer motes (vibrant when asleep) — exact app values
        points.current.material.opacity = sleeping ? 1.0 : 0.92
      }
      return
    }

    // ===== geodesic / meridian (original behaviour) =====
    tmp.mWorld.set(frame.pointer.x, frame.pointer.y, 0.4).normalize()
    if (group.current) {
      tmp.inv.copy(group.current.quaternion).invert()
      tmp.mLocal.copy(tmp.mWorld).applyQuaternion(tmp.inv)
    }
    const ml = tmp.mLocal
    const THR = 0.9
    const Tx = ml.x * RED, Ty = ml.y * RED, Tz = ml.z * RED
    for (let i = 0; i < N; i++) {
      const dx = dir[i * 3], dy = dir[i * 3 + 1], dz = dir[i * 3 + 2]
      const base = THREE.MathUtils.lerp(coreR[i], shellR[i], spread)
      const bubble = (1 - spread) * (Math.sin(t * speed[i] + phase[i]) * 0.04 + 0.05)
      const wobble = spread * Math.sin(t * speed[i] * 0.7 + phase[i]) * 0.07
      const rs = base + bubble + wobble
      let x = dx * rs, y = dy * rs, z = dz * rs
      const align = dx * ml.x + dy * ml.y + dz * ml.z
      if (align > THR) {
        const k = spread * ((align - THR) / (1 - THR)) * 0.92
        x += (Tx - x) * k; y += (Ty - y) * k; z += (Tz - z) * k
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    }
    if (points.current) {
      points.current.geometry.attributes.position.needsUpdate = true
      points.current.material.size = THREE.MathUtils.lerp(0.014, 0.05, spread)
    }

    const rot = st === 'processing' ? 0.5 : st === 'listening' ? 0.24 : 0.1
    if (group.current) {
      group.current.rotation.y += d * rot
      group.current.rotation.x = 0.3
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, frame.pointer.x * 0.18, 0.04)
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, frame.pointer.y * 0.12, 0.04)
      group.current.scale.setScalar(1)
    }
  })

  return (
    <group ref={group}>
      {/* cyan particle core â€” all variants */}
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={N} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.026} map={sprite} color={CYAN} transparent opacity={0.95}
          sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} alphaTest={0.01} />
      </points>

      {variant === 'geodesic' && (
        <>
          <mesh geometry={geoIco}><meshBasicMaterial color={GOLDLINE} wireframe transparent opacity={0.45} /></mesh>
          <points geometry={geoIco}>
            <pointsMaterial size={0.055} map={sprite} color={GOLDNODE} transparent opacity={1}
              sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} alphaTest={0.01} />
          </points>
        </>
      )}

      {variant === 'meridian' && (
        <>
          <mesh geometry={geoSphere}><meshBasicMaterial color={GOLDLINE} wireframe transparent opacity={0.42} /></mesh>
          <points geometry={geoSphere}>
            <pointsMaterial size={0.04} map={sprite} color={GOLDNODE} transparent opacity={1}
              sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} alphaTest={0.01} />
          </points>
        </>
      )}


      {variant === 'gyro' && ringData.map((rd, i) => (
        <group key={i} ref={(el) => (ringsRef.current[i] = el)} rotation={rd.tilt}>
          <mesh>
            <torusGeometry args={[rd.r, rd.tube, 16, 110]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.9} />
          </mesh>
          <mesh ref={(el) => (ballsRef.current[i] = el)}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={BALL} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function ApexCore3D({ state = 'idle', variant = 'geodesic', onClick, corner = false, bigDock = false, contained = false }) {
  const st = normalizeState(state)
  const label = st === 'processing' ? 'Processing' : st === 'listening' ? 'Listening' : st === 'speaking' ? 'Speaking' : 'Standby'
  const [bgIdx, setBgIdx] = useState(2) // Grid default
  const isParticles = variant === 'particles' // cyan-only, transparent, status moves to OrbStatusBar

  return (
    <div onClick={onClick} style={{
      position: contained ? 'absolute' : 'fixed', inset: 0, zIndex: 15, pointerEvents: onClick ? 'auto' : 'none',
      background: isParticles ? 'transparent' : BG_VARIANTS[bgIdx].css,
      // canvas is ALWAYS full-screen / untransformed â€” the ball moves to the ring in 3D instead
    }}>
      {!isParticles && (
        <button
          onClick={(e) => { e.stopPropagation(); setBgIdx(i => (i + 1) % BG_VARIANTS.length) }}
          style={{
            position: 'absolute', top: 44, left: 16, zIndex: 5, pointerEvents: 'auto',
            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.4)',
            color: '#f5a623', fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            letterSpacing: '0.12em', padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
          }}
        >BG Â· {BG_VARIANTS[bgIdx].name.toUpperCase()}</button>
      )}

      <OrbBoundary>
      <Canvas
        camera={{ position: [0, 0, 4.8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
        onCreated={({ gl, setFrameloop }) => {
          // Handle WebGL context loss so it doesn't cascade into the null-context crash. preventDefault
          // marks the context RESTORABLE (without it the loss is permanent â†’ every render throws); pause
          // the frameloop while it's gone and resume when the browser restores it.
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            try { console.warn('[orb] WebGL context lost â€” pausing render') } catch {}
            try { setFrameloop('never') } catch {}
          }, false)
          canvas.addEventListener('webglcontextrestored', () => {
            try { console.warn('[orb] WebGL context restored â€” resuming') } catch {}
            try { setFrameloop('always') } catch {}
          }, false)
        }}
      >{/* canvas must NOT capture pointers â€” it sat over the reasoning web and ate every agent click.
            The orb's stop-on-click is handled by the wrapper div (onClick), not the 3D scene. */}
        <Core state={state} variant={variant} corner={corner} bigDock={bigDock} />
        <EffectComposer>
          {/* Site copy — FINAL: everything else in this scene is byte-matched to the app
              (particle sizes, layers, blend modes). The one non-copyable difference is the
              renderer generation (app: three 0.169/postprocessing v2 · site: three 0.184/v3),
              whose newer bloom pipeline reads dimmer at equal numbers — compensated here with
              +40% intensity over the app's 1.3/0.18/0.62. Do not retune blindly; adjust
              intensity only, ±0.2 steps. */}
          <Bloom intensity={1.8} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur radius={0.62} />
        </EffectComposer>
      </Canvas>
      </OrbBoundary>

      {!isParticles && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '79%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, pointerEvents: 'none',
        }}>
          <Equalizer />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, boxShadow: `0 0 10px ${GOLD}`, animation: 'apexPulse 1.8s ease-in-out infinite' }} />
            <span style={{ color: '#ffd98a', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.5em', fontSize: 16, textTransform: 'uppercase', textShadow: '0 0 18px rgba(245,166,35,0.7), 0 0 4px rgba(245,166,35,0.9)' }}>{label}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes apexPulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.6) } }
        @keyframes apexEq { 0%,100% { transform: scaleY(0.25) } 50% { transform: scaleY(1) } }
      `}</style>
    </div>
  )
}
