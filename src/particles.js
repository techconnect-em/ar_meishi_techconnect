import * as THREE from 'three';

/**
 * GPUパーティクル（webar-gpu-performanceスキル準拠）
 *
 * - THREE.Points 1オブジェクト = 1ドローコール
 * - 位置・透明度はすべて頂点シェーダーで uTime から計算
 *   （attributeに初期値を焼き込み、CPUは毎フレーム uniform 更新のみ）
 * - スプライトはテクスチャ不使用、gl_PointCoord のラジアル減衰で描く
 */

const CYAN = new THREE.Color('#4de8e0');

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(uColor, a * vAlpha);
  }
`;

// modelViewMatrixからスケールを取り出してポイントサイズに反映する共通頂点コード
const SIZE_CODE = /* glsl */ `
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float sc = length(modelViewMatrix[0].xyz);
  gl_PointSize = aSize * sc * uCanvasHeight * 0.5 / max(0.0001, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
`;

const baseMaterial = (vertexShader) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: -1 },
      uCanvasHeight: { value: 800 },
      uGlobalAlpha: { value: 1 },
      uColor: { value: CYAN.clone() },
    },
    vertexShader,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/**
 * 開封バースト: カード面から光の粒が立ち上り、減速しながら消える（1回再生）
 * uTime はバースト開始からの秒数（負の間は非表示）
 */
export function createBurstParticles({ count = 250, width = 1, height = 0.6 } = {}) {
  const start = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const delay = new Float32Array(count);
  const life = new Float32Array(count);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    start[i * 3] = (Math.random() - 0.5) * width;
    start[i * 3 + 1] = (Math.random() - 0.5) * height;
    start[i * 3 + 2] = 0.01;
    vel[i * 3] = (Math.random() - 0.5) * 0.12;
    vel[i * 3 + 1] = 0.35 + Math.random() * 0.55;
    vel[i * 3 + 2] = Math.random() * 0.15;
    delay[i] = Math.random() * 1.8;
    life[i] = 1.2 + Math.random() * 1.2;
    size[i] = 0.008 + Math.random() * 0.018;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = baseMaterial(/* glsl */ `
    attribute vec3 aVel;
    attribute float aDelay;
    attribute float aLife;
    attribute float aSize;
    uniform float uTime;
    uniform float uCanvasHeight;
    uniform float uGlobalAlpha;
    varying float vAlpha;
    void main() {
      float t = uTime - aDelay;
      vec3 pos = position;
      vAlpha = 0.0;
      if (t > 0.0 && t < aLife) {
        // 減速しながら上昇（イーズアウト）
        float k = (1.0 - exp(-t * 1.4)) / 1.4;
        pos += aVel * k;
        float lt = t / aLife;
        vAlpha = smoothstep(0.0, 0.1, lt) * (1.0 - smoothstep(0.55, 1.0, lt)) * 0.9;
      }
      vAlpha *= uGlobalAlpha;
      ${SIZE_CODE}
    }
  `);

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return points;
}

/**
 * 環境の光塵: ホログラム周辺をゆっくり漂って明滅するループパーティクル
 * uTime は経過秒（mod でシェーダー内リサイクル）
 */
export function createAmbientDust({ count = 60 } = {}) {
  const start = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const life = new Float32Array(count);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    start[i * 3] = (Math.random() - 0.5) * 1.3;
    start[i * 3 + 1] = -0.5 + Math.random() * 1.9; // ボタン下端〜ヘッダーロゴ上まで
    start[i * 3 + 2] = Math.random() * 0.3;
    seed[i] = Math.random() * 100.0;
    life[i] = 4.0 + Math.random() * 4.0;
    size[i] = 0.005 + Math.random() * 0.012;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = baseMaterial(/* glsl */ `
    attribute float aSeed;
    attribute float aLife;
    attribute float aSize;
    uniform float uTime;
    uniform float uCanvasHeight;
    uniform float uGlobalAlpha;
    varying float vAlpha;
    void main() {
      float t = mod(uTime + aSeed, aLife) / aLife;
      vec3 pos = position;
      // ゆっくり上昇しつつ横に揺れる
      pos.y += t * 0.25;
      pos.x += sin(uTime * 0.4 + aSeed) * 0.04;
      pos.z += cos(uTime * 0.3 + aSeed * 2.0) * 0.03;
      // 出現→消滅のなめらかな明滅 + 個体ごとの瞬き
      vAlpha = sin(3.14159 * t) * (0.30 + 0.25 * sin(uTime * 2.0 + aSeed * 7.0));
      vAlpha *= uGlobalAlpha;
      ${SIZE_CODE}
    }
  `);

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return points;
}
