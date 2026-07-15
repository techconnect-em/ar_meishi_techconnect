import * as THREE from 'three';
import { createHologramMaterial, createGridMaterial } from './hologram.js';
import { createBurstParticles, createAmbientDust } from './particles.js';

/**
 * AR名刺パイプラインモジュール（MindAR + A-Frame 版からの移植 + ホログラム演出強化）
 *
 * 体験の流れ（初回マーカー認識からの秒数）:
 *   0.05s リングパルス（認識のカタルシス）
 *   0.5s  カバーが上辺を軸に開く（2秒かけて180度）+ 光の粒のバースト
 *   2.5s  ロゴ動画がカード中央にスケールイン（加算合成 = 光として浮く）
 *   2.8s  ロゴ動画の再生開始
 *   7.3s  ロゴがヘッダー位置へ移動、自己紹介ホログラムが走査スイープで構築、
 *         3ボタンが順次出現、光塵が漂い始める
 *
 * 座標系: 旧MindAR版はマーカー幅=1の単位系で組まれていたので、
 * contentRoot をカード幅（シーン単位）ぶんスケールして旧座標をそのまま使う。
 * 8th Wallのシーン単位は「追跡領域（3:4クロップ）の高さ = 1」なので、
 * カードの実寸はマーカーデータの properties から算出する。
 */

// エフェクトフラグ（実機で重い場合の切り分け用。個別にfalseで無効化できる）
const FX = {
  hologram: true, // 走査線・フリッカー・起動スイープ
  particles: true, // 開封バースト + 環境の光塵
  ring: true, // 認識瞬間のリングパルス
  grid: true, // ベースカードの回路グリッド
};

// 旧単位系でのカードサイズ（幅1、高さは名刺のアスペクト比 650/1075）
const CARD_W = 1;
const CARD_H = 650 / 1075;

// ─── easing ──────────────────────────────────────────────────────────────
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
const linear = (t) => t;

export function meishiPipelineModule(markerTarget) {
  let targetGroup = null;
  let clock = null;
  let renderer = null;

  // カードの実寸（シーン単位）をマーカーデータから算出する。
  // シーン単位は「クロップ高さ(px) = 1」。isRotated（横長を90°回転して処理）の場合、
  // originalWidth/Height は回転後の座標系なので幅と高さが入れ替わっている。
  const p = markerTarget.properties;
  const cardWidthPx = p.isRotated ? p.originalHeight : p.originalWidth;
  const contentScale = cardWidthPx / p.height;

  // シーケンス制御（マーカーを見失っている間はタイムラインを止める）
  let sequenceStarted = false;
  let seqTime = 0; // マーカーが見えていた累積時間
  let tracking = false;
  let lastFrameTime = null;

  // タイムライン（毎フレーム progress を計算して apply する）
  let tweens = []; // { start, dur, ease, apply(p) } — seqTime基準
  let actions = []; // { at, done, run() }
  let floats = []; // { start, obj, y0, y1 } 周期4秒の上下フロート
  let liveTweens = []; // タップ起点のアニメーション（clock基準）

  // ホログラム演出
  const holoMats = []; // uTime を毎フレーム更新するマテリアル
  let burst = null;
  let dust = null;

  // インタラクション
  let interactables = []; // レイキャスト対象
  let portfolioPanel = null;
  let panelParts = null; // { bg, glow, text, closeBtn }
  let videoEl = null;
  let videoTexture = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // スキャンガイド（マーカー未認識のあいだ表示）
  const scanOverlay = document.getElementById('scan-overlay');

  const INTRO = 7.3; // showIntro のタイミング

  // ─── helpers ────────────────────────────────────────────────────────────
  const loader = new THREE.TextureLoader();
  const loadTex = (url) => {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  // ホログラムマテリアル（FX無効時はMeshBasicにフォールバック）
  const holoMat = (texture, opts = {}) => {
    if (FX.hologram) {
      const mat = createHologramMaterial(texture, opts);
      holoMats.push(mat);
      return mat;
    }
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: opts.boot === 0 ? 0 : 1,
      alphaTest: opts.alphaTest ?? 0,
    });
  };

  // 出現アニメーション: ホログラムなら起動スイープ、フォールバックはフェード
  const setBoot = (mesh) => (prog) => {
    const u = mesh.material.uniforms;
    if (u && u.uBoot) u.uBoot.value = prog;
    else mesh.material.opacity = prog;
  };

  const imagePlane = (url, w, h, alphaTest = 0) => {
    const mat = new THREE.MeshBasicMaterial({
      map: loadTex(url),
      transparent: true,
      alphaTest,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  };

  // ホログラム版の画像プレーン（boot=0で「未構築」状態から始まる）
  const holoPlane = (url, w, h, opts = {}) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h), holoMat(loadTex(url), opts));

  // テキストをCanvasに描いてテクスチャ化（A-Frameのa-textの代替）
  const makeTextTexture = (draw, w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const addLiveTween = (dur, ease, apply) => {
    liveTweens.push({ start: clock.getElapsedTime(), dur, ease, apply });
    apply(0);
  };

  // ─── ボタン生成（ガラス円 + リング + アイコン） ─────────────────────────
  const makeButton = (iconUrl, iconSize, action) => {
    const group = new THREE.Group();

    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      })
    );
    glass.userData.action = action;
    group.add(glass);
    interactables.push(glass);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.155, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      })
    );
    group.add(ring);

    const icon = imagePlane(iconUrl, iconSize, iconSize);
    icon.position.z = 0.01;
    group.add(icon);

    group.scale.setScalar(0); // 出現アニメーションまで非表示
    return group;
  };

  // ─── ポートフォリオパネル（ホログラム風） ──────────────────────────────
  const makePortfolioPanel = () => {
    const panel = new THREE.Group();
    panel.position.set(0, 0.3, 0.5);
    panel.scale.setScalar(0); // ボタンを押すまで非表示

    // 背景（黒ガラス）
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.0),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      })
    );
    bg.userData.action = 'blocker'; // 背後のボタンへのタップ抜けを防ぐ
    panel.add(bg);
    interactables.push(bg);

    // 外周グロー（シアン）
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 1.02),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      })
    );
    glow.position.z = -0.001;
    panel.add(glow);

    // テキスト（タイトル + 実績リスト）
    const textTex = makeTextTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      // タイトル
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 60px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Production Results', w / 2, h * 0.15);
      // リスト
      ctx.fillStyle = '#ffffff';
      ctx.font = '48px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      const items = ['• AR Flyer', '• AR CD', '• AR Photo Frame', '• AR Dinosaur BOX'];
      items.forEach((item, i) => {
        ctx.fillText(item, w * 0.083, h * (0.35 + i * 0.15));
      });
    }, 1024, 854);
    const text = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.0),
      holoMat(textTex, { boot: 1, scan: 0.06 })
    );
    text.position.z = 0.01;
    panel.add(text);

    // 閉じるボタン
    const closeTex = makeTextTexture((ctx, w, h) => {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '44px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Close', w / 2, h / 2 + 2);
    }, 256, 86);
    const closeBtn = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.1),
      new THREE.MeshBasicMaterial({ map: closeTex, transparent: true })
    );
    closeBtn.position.set(0, -0.42, 0.02);
    closeBtn.userData.action = 'closePortfolio';
    panel.add(closeBtn);
    interactables.push(closeBtn);

    panelParts = { bg, glow, text, closeBtn };
    return panel;
  };

  const openPortfolio = () => {
    portfolioPanel.scale.setScalar(1);
    if (!FX.hologram) return;
    const { bg, glow, text, closeBtn } = panelParts;
    // 背景・グロー・Closeはフェード、本文は走査スイープで構築
    addLiveTween(0.3, linear, (prog) => {
      bg.material.opacity = 0.7 * prog;
      glow.material.opacity = 0.3 * prog;
      closeBtn.material.opacity = prog;
    });
    addLiveTween(0.5, linear, (prog) => {
      text.material.uniforms.uBoot.value = prog;
    });
  };

  const closePortfolio = () => {
    portfolioPanel.scale.setScalar(0);
  };

  // ─── タップ処理 ─────────────────────────────────────────────────────────
  const onTap = (e) => {
    if (!targetGroup || !targetGroup.visible) return;
    const { camera } = XR8.Threejs.xrScene();
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    if (!hits.length) return;

    const action = hits[0].object.userData.action;
    if (action === 'website') {
      window.open('https://techconnect-em.com', '_blank');
    } else if (action === 'instagram') {
      window.open('https://www.instagram.com/techconnect.em/', '_blank');
    } else if (action === 'portfolio') {
      openPortfolio();
    } else if (action === 'closePortfolio') {
      closePortfolio();
    }
  };

  // ─── シーン構築 ─────────────────────────────────────────────────────────
  const buildScene = (scene) => {
    clock = new THREE.Clock();

    targetGroup = new THREE.Group();
    targetGroup.visible = false;
    scene.add(targetGroup);

    // 旧MindAR版の座標（マーカー幅=1の単位系）をそのまま使うためのスケール
    const contentRoot = new THREE.Group();
    contentRoot.scale.setScalar(contentScale);
    targetGroup.add(contentRoot);

    // ベースカード（開いた後の面。回路グリッドが微かに流れる）
    const baseMat = FX.grid ? createGridMaterial() : new THREE.MeshBasicMaterial({ color: 0x000000 });
    if (FX.grid) holoMats.push(baseMat);
    const baseCard = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), baseMat);
    contentRoot.add(baseCard);

    // 認識瞬間のリングパルス
    let lockRing = null;
    if (FX.ring) {
      lockRing = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.5, 64),
        new THREE.MeshBasicMaterial({
          color: 0x4de8e0,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      lockRing.position.z = 0.015;
      lockRing.visible = false;
      contentRoot.add(lockRing);
    }

    // ロゴ動画（加算合成 = 黒背景が消えて光として浮くホログラム）
    videoEl = document.createElement('video');
    videoEl.src = './assets/logoanimation.mp4';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.preload = 'auto';
    videoEl.addEventListener('ended', () => {
      videoEl.currentTime = 0;
    });

    videoTexture = new THREE.VideoTexture(videoEl);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const logoMat = FX.hologram
      ? holoMat(videoTexture, { boot: 1, additive: true, scan: 0.06, flicker: 0.04, tint: 0.06 })
      : new THREE.MeshBasicMaterial({ map: videoTexture, transparent: true });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), logoMat);
    logo.position.set(0, 0.3, 0.02);
    logo.scale.setScalar(0);
    contentRoot.add(logo);

    // 自己紹介ホログラム（キャッチコピー・職種・プロフィール写真・名前）
    // 出現は「下から上に走査されながら構築される」起動スイープ
    const introContainer = new THREE.Group();
    introContainer.position.set(0, 0.1, 0.05);
    contentRoot.add(introContainer);

    const catchImg = holoPlane('./assets/intro_catch.png', 1.2, 0.72, { boot: 0, alphaTest: 0.1 });
    catchImg.position.set(0, 0.65, 0.02);
    introContainer.add(catchImg);

    const jobImg = holoPlane('./assets/intro_job.png', 1.2, 0.72, { boot: 0, alphaTest: 0.1 });
    jobImg.position.set(0, 0.45, 0.02);
    introContainer.add(jobImg);

    const profile = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 64),
      holoMat(loadTex('./assets/intro_profile.jpg'), { boot: 0, tint: 0.08, scan: 0.04 })
    );
    profile.position.set(0, 0.1, 0.05);
    if (!FX.hologram) profile.scale.setScalar(0); // フォールバック時は旧来のポップイン
    introContainer.add(profile);

    const nameImg = holoPlane('./assets/intro_name.png', 1.2, 0.72, { boot: 0, alphaTest: 0.1 });
    nameImg.position.set(0, -0.25, 0.02);
    introContainer.add(nameImg);

    // リンクボタン（Website / Instagram / Portfolio）
    const btnWebsite = makeButton('./assets/icon_website.png', 0.15, 'website');
    btnWebsite.position.set(-0.35, -0.45, 0.05);
    contentRoot.add(btnWebsite);

    const btnInstagram = makeButton('./assets/icon_instagram.png', 0.15, 'instagram');
    btnInstagram.position.set(0, -0.45, 0.05);
    contentRoot.add(btnInstagram);

    const btnPortfolio = makeButton('./assets/icon_potfolio.png', 0.25, 'portfolio');
    btnPortfolio.position.set(0.35, -0.45, 0.05);
    contentRoot.add(btnPortfolio);

    // ポートフォリオパネル
    portfolioPanel = makePortfolioPanel();
    contentRoot.add(portfolioPanel);

    // パーティクル（開封バースト + 環境の光塵）
    if (FX.particles) {
      burst = createBurstParticles({ width: CARD_W, height: CARD_H });
      contentRoot.add(burst);
      dust = createAmbientDust();
      contentRoot.add(dust);
    }

    // カバー（上辺 y=CARD_H/2 を軸に開く。物理の名刺そのものなのでエフェクトなし）
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0, CARD_H / 2, 0);
    contentRoot.add(coverPivot);

    const coverFront = imagePlane('./assets/meishi_front.png', CARD_W, CARD_H);
    coverFront.material.transparent = false;
    coverFront.position.set(0, -CARD_H / 2, 0.01);
    coverPivot.add(coverFront);

    const coverBack = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    coverBack.rotation.y = Math.PI;
    coverBack.position.set(0, -CARD_H / 2, 0);
    coverPivot.add(coverBack);

    // ─── タイムライン定義（初回認識 = t0） ────────────────────────────────
    tweens = [
      // カバー開封: 0.5s から2秒で -180度
      { start: 0.5, dur: 2.0, ease: easeOutQuad, apply: (prog) => { coverPivot.rotation.x = -Math.PI * prog; } },
      // ロゴのスケールイン
      { start: 2.5, dur: 1.0, ease: easeOutQuad, apply: (prog) => { logo.scale.setScalar(prog); } },
      // ロゴをヘッダー位置へ移動
      { start: INTRO, dur: 1.0, ease: easeInOutQuad, apply: (prog) => { logo.position.y = 0.3 + (1.2 - 0.3) * prog; } },
      // 自己紹介の起動スイープ（フォールバック時はフェード）
      { start: INTRO + 1.3, dur: 0.7, ease: linear, apply: setBoot(catchImg) },
      { start: INTRO + 1.3, dur: 0.7, ease: linear, apply: setBoot(jobImg) },
      { start: INTRO + 2.1, dur: 0.7, ease: linear, apply: setBoot(nameImg) },
      // ボタンのポップイン（弾性）
      { start: INTRO + 2.8, dur: 1.0, ease: easeOutElastic, apply: (prog) => { btnWebsite.scale.setScalar(prog); } },
      { start: INTRO + 3.0, dur: 1.0, ease: easeOutElastic, apply: (prog) => { btnInstagram.scale.setScalar(prog); } },
      { start: INTRO + 3.2, dur: 1.0, ease: easeOutElastic, apply: (prog) => { btnPortfolio.scale.setScalar(prog); } },
    ];

    // プロフィール写真: ホログラム時はスイープ、フォールバック時は弾性ポップ
    if (FX.hologram) {
      tweens.push({ start: INTRO + 1.8, dur: 0.8, ease: linear, apply: setBoot(profile) });
    } else {
      tweens.push({ start: INTRO + 1.8, dur: 1.2, ease: easeOutElastic, apply: (prog) => { profile.scale.setScalar(prog); } });
    }

    // 認識瞬間のリングパルス（1回のみ）
    if (FX.ring) {
      tweens.push({
        start: 0.05,
        dur: 0.7,
        ease: easeOutQuad,
        apply: (prog) => {
          lockRing.visible = prog > 0 && prog < 1;
          lockRing.scale.setScalar(0.3 + 1.3 * prog);
          lockRing.material.opacity = 0.9 * (1 - prog);
        },
      });
    }

    actions = [
      // ロゴ動画の再生開始
      { at: 2.8, done: false, run: () => { videoEl.play().catch((e) => console.warn('Video play failed:', e)); } },
    ];

    // ふわふわ浮遊（周期4秒で y0 ⇄ y1）
    floats = [
      { start: INTRO + 2.0, obj: catchImg, y0: 0.65, y1: 0.7 },
      { start: INTRO + 2.2, obj: jobImg, y0: 0.45, y1: 0.5 },
      { start: INTRO + 2.4, obj: profile, y0: 0.1, y1: 0.15 },
      { start: INTRO + 2.6, obj: nameImg, y0: -0.25, y1: -0.2 },
      { start: INTRO + 2.8, obj: btnWebsite, y0: -0.45, y1: -0.4 },
      { start: INTRO + 3.0, obj: btnInstagram, y0: -0.45, y1: -0.4 },
      { start: INTRO + 3.2, obj: btnPortfolio, y0: -0.45, y1: -0.4 },
    ];

    document.addEventListener('click', onTap);
  };

  // ─── pipeline module ──────────────────────────────────────────────────
  return {
    name: 'ar-meishi',

    onStart: () => {
      const xr = XR8.Threejs.xrScene();
      renderer = xr.renderer;
      buildScene(xr.scene);
    },

    onUpdate: () => {
      if (!clock) return;
      const now = clock.getElapsedTime();
      // dtに上限を設ける: タブが一時的にバックグラウンドになっても
      // 復帰時にタイムラインが一気にスキップされないようにする
      const dt = lastFrameTime === null ? 0 : Math.min(0.1, now - lastFrameTime);
      lastFrameTime = now;

      // 走査線・フリッカー・グリッドは常時アニメーション
      for (const mat of holoMats) {
        mat.uniforms.uTime.value = now;
      }

      // タップ起点のアニメーション（パネル開閉など）
      if (liveTweens.length) {
        liveTweens = liveTweens.filter((tw) => {
          const prog = Math.min(1, (now - tw.start) / tw.dur);
          tw.apply(tw.ease(prog));
          return prog < 1;
        });
      }

      if (!sequenceStarted) return;

      // マーカーが見えている間だけタイムラインを進める
      if (tracking) seqTime += dt;
      const t = seqTime;

      for (const tw of tweens) {
        if (t <= tw.start) continue;
        const prog = Math.min(1, (t - tw.start) / tw.dur);
        tw.apply(tw.ease(prog));
      }

      for (const a of actions) {
        if (!a.done && t >= a.at) {
          a.done = true;
          a.run();
        }
      }

      // 浮遊アニメーション（easeInOutSineの往復 = コサイン波）
      for (const f of floats) {
        if (t <= f.start) continue;
        const phase = (t - f.start) / 4; // 周期4秒
        const k = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
        f.obj.position.y = f.y0 + (f.y1 - f.y0) * k;
      }

      // パーティクル更新（位置計算はシェーダー内。CPUはuniform更新のみ）
      if (FX.particles && renderer) {
        const canvasH = renderer.domElement.height;
        burst.visible = t > 0.5 && t < 5.5;
        if (burst.visible) {
          burst.material.uniforms.uTime.value = t - 0.5;
          burst.material.uniforms.uCanvasHeight.value = canvasH;
        }
        const dustStart = INTRO + 2.0;
        dust.visible = t > dustStart;
        if (dust.visible) {
          dust.material.uniforms.uTime.value = t;
          dust.material.uniforms.uCanvasHeight.value = canvasH;
          dust.material.uniforms.uGlobalAlpha.value = Math.min(1, (t - dustStart) / 1.5);
        }
      }

      if (videoTexture && videoEl && !videoEl.paused) {
        videoTexture.needsUpdate = true;
      }
    },

    listeners: [
      {
        event: 'reality.imagefound',
        process: ({ detail }) => {
          if (detail.name !== 'marker') return;
          targetGroup.visible = true;
          targetGroup.position.copy(detail.position);
          targetGroup.quaternion.copy(detail.rotation);
          targetGroup.scale.setScalar(detail.scale);
          tracking = true;
          sequenceStarted = true;
          scanOverlay.classList.add('hidden');
        },
      },
      {
        event: 'reality.imageupdated',
        process: ({ detail }) => {
          if (detail.name !== 'marker') return;
          targetGroup.position.copy(detail.position);
          targetGroup.quaternion.copy(detail.rotation);
          targetGroup.scale.setScalar(detail.scale);
        },
      },
      {
        event: 'reality.imagelost',
        process: ({ detail }) => {
          if (detail.name !== 'marker') return;
          targetGroup.visible = false;
          tracking = false;
          scanOverlay.classList.remove('hidden');
        },
      },
    ],
  };
}
