import { customLoading } from './customLoading.js';

const loadingModule = customLoading.pipelineModule();
const showLoadError = (err) => {
  console.error('AR initialization failed:', err);
  customLoading.showLoadError();
};

// xrloadedを待たずに取得する。HTMLのpreloadと同じURL・CORS設定を使う。
const markerTargetPromise = fetch('./image-targets/marker.json')
  .then(async (resp) => {
    if (!resp.ok) throw new Error(`Failed to load marker: ${resp.status}`);
    return resp.json();
  })
  .catch((err) => {
    showLoadError(err);
    return null;
  });

// プレビューにはThree.jsが不要。大きいモジュールの評価でカメラ要求を待たせない。
const sceneReady = Promise.all([import('three'), import('./pipelineModule.js')])
  .then(([THREE, { meishiPipelineModule }]) => {
    // XR8's Three.js pipeline module requires window.THREE
    window.THREE = THREE;
    return meishiPipelineModule;
  })
  .catch((err) => {
    showLoadError(err);
    return null;
  });

// 旧MindAR版のService Workerが残っていると古いキャッシュを配り続けるので、
// 見つけ次第すべて解除する（public/sw.js のキルスイッチと二段構え）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

const loadSlam = async () => {
  try {
    await XR8.loadChunk('slam');
  } catch (err) {
    console.warn('SLAM loading failed; retrying once:', err);
    await XR8.loadChunk('slam');
  }
};

let started = false;
const onxrloaded = () => {
  if (started || customLoading.hasFailed()) return;
  started = true;

  // カメラと追跡エンジンを並行して起動する。動画はこのPromiseの完了後に取得する。
  const slamReady = loadSlam().then(() => true).catch((err) => {
    showLoadError(err);
    return false;
  });

  try {
    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XRExtras.AlmostThere.pipelineModule(),
      XRExtras.FullWindowCanvas.pipelineModule(),
      loadingModule,
      XRExtras.RuntimeError.pipelineModule(),
    ]);
    XR8.run({ canvas: document.getElementById('camerafeed') });
  } catch (err) {
    showLoadError(err);
    return;
  }

  // 通信が応答しないまま止まった場合でも、カメラ映像だけで永久に待たせない。
  const attachTimeout = setTimeout(() => {
    showLoadError(new Error('AR modules did not load within 45s'));
  }, 45000);

  Promise.all([markerTargetPromise, slamReady, sceneReady]).then(([markerTarget, ready, meishiPipelineModule]) => {
    clearTimeout(attachTimeout);
    if (!markerTarget || !ready || !meishiPipelineModule || customLoading.hasFailed()) return;
    XR8.XrController.configure({
      disableWorldTracking: true,
      imageTargetData: [markerTarget],
    });
    // このSDKのThreejsはonSessionAttachでXrControllerを必ず参照するため、
    // カメラのプレビューを先に動かし、3Dシーンもslamと一緒に追加する。
    const controllerModule = XR8.XrController.pipelineModule();
    const startController = controllerModule.onStart;
    const attachController = controllerModule.onSessionAttach;
    let controllerStarted = false;
    controllerModule.onStart = (args) => {
      startController(args);
      controllerStarted = true;
    };
    controllerModule.onSessionAttach = (args) => {
      // 後付けではonStartも呼ばれない。Threejsが投影を設定する前に寸法を初期化する。
      // 回転時にSDKは orientation だけを更新するため、通常起動と同じく現在の向きを rotation にも渡す。
      if (!controllerStarted) controllerModule.onStart({ ...args, rotation: args.orientation ?? args.rotation });
      // セッション開始にも現在の向きを渡し、カメラ先行中の画面回転を反映する
      // （XrController はここで rotation を使って追跡エンジンを初期化する）。
      attachController({ ...args, rotation: args.orientation ?? args.rotation });
      // 実行中の追加ではonAppResourcesLoadedが再通知されない。
      // セッションへの接続後に、同じSDKフックでマーカー画像を初期化する。
      // カメラよりslamが先に準備できた場合の通常通知はSDK側で重複を防ぐ。
      controllerModule.onAppResourcesLoaded(args);
    };
    XR8.addCameraPipelineModule(controllerModule);
    XR8.addCameraPipelineModules([
      XR8.Threejs.pipelineModule(),
      meishiPipelineModule(markerTarget, slamReady),
    ]);
  }).catch(showLoadError);
};

window.XR8
  ? onxrloaded()
  : window.addEventListener('xrloaded', onxrloaded, { once: true });
