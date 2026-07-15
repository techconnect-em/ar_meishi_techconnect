import * as THREE from 'three';

/**
 * ホログラム質感シェーダー
 *
 * - 走査線 + 微フリッカー + 色収差 + シアン寄りトーンを常時（控えめに）
 * - uBoot (0→1) で「下から上に走査されながら構築される」起動スイープ
 * - ポストプロセス（全画面パス）は使わず、各メッシュのマテリアル置き換えのみ
 *   （webar-gpu-performanceスキル: 大面積の再フィルタ禁止に準拠）
 */

const CYAN = new THREE.Color('#4de8e0');

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uBoot;     // 0..1 起動スイープ（1で全表示）
  uniform float uOpacity;
  uniform float uScan;     // 走査線の強さ
  uniform float uFlicker;  // フリッカーの強さ
  uniform float uChroma;   // 色収差のUVオフセット
  uniform float uTint;     // シアンへの寄せ具合
  uniform float uAdditive; // 加算合成モード（動画ロゴ用）: アルファをテクスチャに依存させない
  uniform vec3 uCyan;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vec2 uv = vUv;
    float front = uBoot;
    float d = uv.y - front; // 正 = まだ構築されていない領域

    if (uBoot < 1.0) {
      if (d > 0.0) discard;
      // 構築ライン直下の水平ジッター（走査ノイズ）
      float near = smoothstep(0.08, 0.0, -d);
      float jitter = (hash(floor(uv.y * 140.0) + floor(uTime * 60.0)) - 0.5) * 0.025 * near;
      uv.x += jitter;
    }

    vec4 c = texture2D(map, uv);
    float cr = texture2D(map, uv + vec2(uChroma, 0.0)).r;
    float cb = texture2D(map, uv - vec2(uChroma, 0.0)).b;
    vec3 col = vec3(cr, c.g, cb);

    // シアン寄りのトーン
    col *= mix(vec3(1.0), vec3(0.85, 1.05, 1.08), uTint);

    // 走査線（細かい横縞がゆっくり流れる）
    float scan = sin(uv.y * 220.0 - uTime * 6.0) * 0.5 + 0.5;
    col *= 1.0 - uScan * scan;

    // 微フリッカー
    col *= 1.0 + (hash(floor(uTime * 47.0)) - 0.5) * 2.0 * uFlicker;

    float alpha = mix(c.a, 1.0, uAdditive) * uOpacity;

    // 構築ラインの発光
    if (uBoot < 1.0 && uBoot > 0.0) {
      float glow = smoothstep(0.05, 0.0, -d);
      col += uCyan * glow * 1.2;
    }

    if (alpha < 0.03) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createHologramMaterial(texture, opts = {}) {
  const {
    boot = 1,          // 初期スイープ状態（0=非表示から起動、1=最初から表示）
    scan = 0.05,
    flicker = 0.03,
    chroma = 0.0008,
    tint = 0.12,
    additive = false,  // 動画ロゴ用: 黒背景を「光」として消す
  } = opts;

  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      uTime: { value: 0 },
      uBoot: { value: boot },
      uOpacity: { value: 1 },
      uScan: { value: scan },
      uFlicker: { value: flicker },
      uChroma: { value: chroma },
      uTint: { value: tint },
      uAdditive: { value: additive ? 1 : 0 },
      uCyan: { value: CYAN.clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.FrontSide,
  });
}

/**
 * ベースカード用: 暗い紺地に微かなシアンの回路グリッドが流れるマテリアル
 */
const GRID_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCyan;
  varying vec2 vUv;

  void main() {
    // ゆっくり流れるグリッド
    vec2 g = fract(vUv * vec2(26.0, 15.0) - vec2(0.0, uTime * 0.04));
    float line = max(
      smoothstep(0.96, 1.0, g.x) + smoothstep(0.04, 0.0, g.x),
      smoothstep(0.96, 1.0, g.y) + smoothstep(0.04, 0.0, g.y)
    );
    // 中心からの薄いビネット（端をわずかに暗く）
    float vig = 1.0 - 0.35 * length(vUv - 0.5);
    vec3 base = vec3(0.015, 0.045, 0.09) * vig;
    vec3 col = base + uCyan * line * 0.06;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGridMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCyan: { value: CYAN.clone() },
    },
    vertexShader: VERT,
    fragmentShader: GRID_FRAG,
    side: THREE.FrontSide,
  });
}
