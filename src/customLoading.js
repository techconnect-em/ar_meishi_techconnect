/**
 * Custom loading screen — Tech Connect branding.
 * Replaces XRExtras.Loading.pipelineModule().
 */
let activeLoading = null;

export const customLoading = {
  showLoadError: () => activeLoading?.showLoadError(),
  hasFailed: () => activeLoading?.hasFailed() ?? false,
  pipelineModule: () => {
    let loadingEl = null;
    let hintEl = null;
    let footerEl = null;
    let inAppTimer = null;
    let hintTimer = null;
    let fadeTimer = null;
    let copyTimer = null;
    let cameraFailed = false;
    let removed = false;

    // 8th Wallは通常のブラウザにも inAppBrowser 名を付けるため、アプリ内ブラウザ扱いから外す。
    const REAL_BROWSERS = new Set([
      'Microsoft Edge', 'Google Chrome', 'Mozilla Firefox', 'Mozilla Firefox Focus',
      'Opera Touch', 'Brave', 'Huawei Browser',
    ]);
    const isInAppBrowser = (est) => {
      const name = est.browser?.inAppBrowser;
      return !!name && !REAL_BROWSERS.has(name);
    };

    const clearCameraTimers = () => {
      clearTimeout(inAppTimer);
      clearTimeout(hintTimer);
      inAppTimer = null;
      hintTimer = null;
    };

    const clearUiTimers = () => {
      clearTimeout(fadeTimer);
      clearTimeout(copyTimer);
      fadeTimer = null;
      copyTimer = null;
    };

    const getDeviceEstimate = () => {
      try {
        return window.XR8?.XrDevice?.deviceEstimate?.() || {};
      } catch (error) {
        console.warn('[custom-loading] 端末情報を取得できませんでした。', error);
        return {};
      }
    };

    const diagnosticText = (reason, est) => [
      reason && `code: ${reason}`,
      est.browser?.inAppBrowser,
      [est.os, est.osVersion].filter(Boolean).join(' '),
    ].filter(Boolean).join(' / ');

    const ensureOverlay = () => {
      if (loadingEl) return;
      loadingEl = document.getElementById('tc-loading');
      if (loadingEl) return;
      loadingEl = document.createElement('div');
      loadingEl.id = 'tc-loading';
      loadingEl.className = 'tc-loading';
      document.body.appendChild(loadingEl);
    };

    const createLogo = () => {
      const logo = document.createElement('div');
      logo.className = 'tc-logo';
      logo.innerHTML = '<span>Tech</span><span> Connect</span>';
      return logo;
    };

    const createFooter = (text) => {
      const footer = document.createElement('div');
      footer.className = 'tc-footer';
      footer.textContent = text;
      return footer;
    };

    const createButton = (label, onClick, secondary = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      Object.assign(button.style, {
        width: '100%',
        minHeight: '48px',
        padding: '12px 16px',
        boxSizing: 'border-box',
        border: '1px solid #4de8e0',
        borderRadius: '8px',
        backgroundColor: secondary ? 'transparent' : '#4de8e0',
        color: secondary ? '#4de8e0' : '#1c2f56',
        fontFamily: 'inherit',
        fontSize: '15px',
        fontWeight: 'bold',
        lineHeight: '1.5',
        cursor: 'pointer',
      });
      button.addEventListener('click', onClick);
      return button;
    };

    const createCopyButton = () => {
      const button = createButton('URLをコピー', async () => {
        if (!navigator.clipboard?.writeText) {
          window.prompt('URLをコピーしてください', location.href);
          return;
        }
        try {
          await navigator.clipboard.writeText(location.href);
        } catch (error) {
          console.warn('[custom-loading] URLをコピーできませんでした。', error);
          if (!removed && button.isConnected) {
            window.prompt('URLをコピーしてください', location.href);
          }
          return;
        }
        // コピー中に画面が閉じられた場合は、表示もタイマーも追加しない。
        if (removed || !button.isConnected) return;
        clearTimeout(copyTimer);
        button.textContent = 'コピーしました';
        copyTimer = setTimeout(() => {
          copyTimer = null;
          button.textContent = 'URLをコピー';
        }, 2000);
      }, true);
      return button;
    };

    const openExternalBrowser = (est) => {
      if (est.browser?.inAppBrowser === 'Line') {
        const url = new URL(location.href);
        url.searchParams.set('openExternalBrowser', '1');
        location.href = url.href;
      } else {
        location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
      }
    };

    const showLoadingHint = (reason, est) => {
      if (removed || cameraFailed || !loadingEl || hintEl) return;
      hintEl = document.createElement('div');
      hintEl.setAttribute('role', 'status');
      Object.assign(hintEl.style, {
        width: '100%',
        maxWidth: '360px',
        flexShrink: '0',
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid #2e4570',
        boxSizing: 'border-box',
      });
      const text = document.createElement('p');
      Object.assign(text.style, {
        margin: '0 0 16px',
        fontSize: '13px',
        lineHeight: '1.7',
        color: 'rgba(246,246,246,0.7)',
      });
      text.textContent = 'カメラが起動しないときは、Chromeなどのブラウザで開き直すか、カメラの許可を確認してください。';
      hintEl.appendChild(text);
      hintEl.appendChild(createCopyButton());
      loadingEl.insertBefore(hintEl, footerEl);
      footerEl.textContent = diagnosticText(reason, est) || 'Powered by Tech Connect';
    };

    const showCameraError = (screen, reason, est) => {
      if (removed || cameraFailed) return;
      cameraFailed = true;
      clearCameraTimers();
      clearUiTimers();
      const xr = window.XR8;
      if (xr) {
        const stopCamera = () => {
          xr.pause();
          xr.stop();
        };
        // 即座に許可を拒否すると、SDKのWebGL初期化より先にここへ来る。
        // 初期化中のコンテキストを破棄しないよう、停止だけ完了後に回す。
        xr.initialize().then(stopCamera, stopCamera);
      }
      if (removed) return;

      // onStartのフェード途中・終了後でも、失敗画面を前面に残す。
      ensureOverlay();
      loadingEl.style.transition = 'none';
      loadingEl.style.opacity = '1';
      loadingEl.setAttribute('role', 'alert');
      loadingEl.replaceChildren(createLogo());
      hintEl = null;

      const content = document.createElement('div');
      Object.assign(content.style, { width: '100%', maxWidth: '360px', flexShrink: '0' });
      const heading = document.createElement('h1');
      Object.assign(heading.style, { margin: '0 0 20px', fontSize: '24px', lineHeight: '1.4' });
      const actions = document.createElement('div');
      Object.assign(actions.style, { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' });

      let paragraphs;
      if (screen === 'load') {
        heading.textContent = '読み込みに失敗しました';
        paragraphs = ['通信状況を確認して、もう一度読み込んでください。'];
        actions.appendChild(createButton('再読み込み', () => location.reload()));
      } else if (screen === 'inApp') {
        heading.textContent = 'ブラウザで開いてください';
        paragraphs = ['このアプリ内の画面ではカメラを使えません。右上のメニュー（︙ や …）から「ブラウザで開く」を選んでください。'];
        const isAndroid = est.os === 'Android' || (!est.os && navigator.userAgent.includes('Android'));
        if (isAndroid) {
          actions.appendChild(createButton('Chromeで開く', () => openExternalBrowser(est)));
        }
        actions.appendChild(createCopyButton());
      } else {
        if (screen === 'noCamera') {
          heading.textContent = 'カメラが見つかりません';
          paragraphs = ['他のアプリでカメラを使っている場合は、そのアプリを閉じてから再読み込みしてください。'];
        } else {
          heading.textContent = 'カメラの許可が必要です';
          paragraphs = navigator.userAgent.includes('SamsungBrowser') ? [
            '① メニュー →「設定」→「サイトとダウンロード」→「サイトの権限」を開く',
            '②「カメラ」で、このサイトへのアクセスを「許可」にする',
            '③ 下のボタンで再読み込みする',
          ] : [
            '① アドレスバー左のアイコンをタップ',
            '②「権限」または「サイトの設定」で、カメラを「許可」にする',
            '③ 下のボタンで再読み込みする',
          ];
        }
        actions.appendChild(createButton('再読み込み', () => location.reload()));
      }

      content.appendChild(heading);
      paragraphs.forEach((text) => {
        const paragraph = document.createElement('p');
        Object.assign(paragraph.style, { margin: '0 0 12px', fontSize: '15px', lineHeight: '1.7', color: 'rgba(246,246,246,0.7)' });
        paragraph.textContent = text;
        content.appendChild(paragraph);
      });
      content.appendChild(actions);
      footerEl = createFooter(diagnosticText(reason, est));
      loadingEl.appendChild(content);
      loadingEl.appendChild(footerEl);
    };

    activeLoading = {
      showLoadError: () => showCameraError('load', 'LOAD_FAILED', getDeviceEstimate()),
      hasFailed: () => cameraFailed || removed,
    };

    return {
      name: 'custom-loading',

      onBeforeRun: () => {
        if (cameraFailed) return;
        clearCameraTimers();
        clearUiTimers();
        hintEl = null;
        removed = false;

        // 初回表示の静的HTMLをそのまま使う。ロゴや手順を二重に作らない。
        ensureOverlay();
        footerEl = loadingEl.querySelector('.tc-footer');
      },

      onCameraStatusChange: ({ status, reason }) => {
        if (removed) return;
        if (status === 'hasStream') {
          // 映像の到着（onStart）までは止まる可能性があるので、ヒントのタイマーは残す。
          clearTimeout(inAppTimer);
          inAppTimer = null;
          return;
        }
        if (cameraFailed) return;

        if (status === 'requesting') {
          clearCameraTimers();
          const est = getDeviceEstimate();
          // Androidなどのアプリ内ブラウザは、カメラ要求が返らない場合がある。
          if (isInAppBrowser(est) && est.os !== 'iOS') {
            inAppTimer = setTimeout(() => showCameraError('inApp', reason, est), 3000);
          }
          // 許可ダイアログへの回答を待てるよう、ヒントだけではXRを止めない。
          hintTimer = setTimeout(() => {
            hintTimer = null;
            showLoadingHint(reason, est);
          }, 10000);
        } else if (status === 'failed') {
          clearCameraTimers();
          const est = getDeviceEstimate();
          const screen = isInAppBrowser(est) || !navigator.mediaDevices?.getUserMedia
            ? 'inApp'
            : reason === 'NO_CAMERA' ? 'noCamera' : 'permission';
          // DENY_CAMERA・UNSPECIFIED・未知の理由は、カメラ許可の案内にまとめる。
          showCameraError(screen, reason, est);
        }
      },

      onStart: () => {
        if (removed || cameraFailed || !loadingEl) return;
        document.getElementById('scan-overlay').classList.remove('hidden');
        clearCameraTimers();
        clearUiTimers();
        loadingEl.style.transition = 'opacity 0.4s ease';
        loadingEl.style.opacity = '0';
        fadeTimer = setTimeout(() => {
          fadeTimer = null;
          if (!removed && !cameraFailed && loadingEl) {
            loadingEl.remove();
            loadingEl = null;
            hintEl = null;
            footerEl = null;
          }
        }, 400);
      },

      onRemove: () => {
        removed = true;
        clearCameraTimers();
        clearUiTimers();
        loadingEl?.remove();
        loadingEl = null;
        hintEl = null;
        footerEl = null;
      },
    };
  },
};
