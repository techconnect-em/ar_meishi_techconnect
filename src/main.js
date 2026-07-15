import * as THREE from 'three';
import { customLoading } from './customLoading.js';
import { meishiPipelineModule } from './pipelineModule.js';

// 旧MindAR版のService Workerが残っていると古いキャッシュを配り続けるので、
// 見つけ次第すべて解除する（public/sw.js のキルスイッチと二段構え）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

// XR8's Three.js pipeline module requires window.THREE
window.THREE = THREE;

const onxrloaded = async () => {
  try {
    const resp = await fetch('./image-targets/marker.json');
    if (!resp.ok) throw new Error(`Failed to load marker: ${resp.status}`);
    const markerTarget = await resp.json();

    XR8.XrController.configure({
      disableWorldTracking: true,
      imageTargetData: [markerTarget],
    });

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      XRExtras.AlmostThere.pipelineModule(),
      XRExtras.FullWindowCanvas.pipelineModule(),
      customLoading.pipelineModule(),
      XRExtras.RuntimeError.pipelineModule(),
      meishiPipelineModule(markerTarget),
    ]);

    XR8.run({ canvas: document.getElementById('camerafeed') });
  } catch (err) {
    console.error('AR initialization failed:', err);
  }
};

window.XR8
  ? onxrloaded()
  : window.addEventListener('xrloaded', onxrloaded);
