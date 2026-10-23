/**
 * Custom loading screen — Tech Connect branding.
 * Replaces XRExtras.Loading.pipelineModule().
 */
export const customLoading = {
  pipelineModule: () => {
    let loadingEl = null;
    let hintEl = null;
    let footerEl = null;
    let loadingStyleEl = null;
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
      loadingEl = document.createElement('div');
      Object.assign(loadingEl.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '12vh 24px 28px',
        overflowY: 'auto',
        backgroundColor: '#1c2f56',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: '#f6f6f6',
        gap: '28px',
        boxSizing: 'border-box',
      });
      document.body.appendChild(loadingEl);
    };

    const createLogo = () => {
      const logo = document.createElement('div');
      Object.assign(logo.style, {
        fontSize: '28px',
        fontWeight: 'bold',
        letterSpacing: '0.5px',
        flexShrink: '0',
      });
      logo.innerHTML = '<span style="color:#f6f6f6">Tech</span><span style="color:#4de8e0"> Connect</span>';
      return logo;
    };

    const createFooter = (text) => {
      const footer = document.createElement('div');
      Object.assign(footer.style, {
        marginTop: 'auto',
        flexShrink: '0',
        maxWidth: '100%',
        fontSize: '11px',
        lineHeight: '1.5',
        textAlign: 'center',
        overflowWrap: 'anywhere',
        color: '#4a6080',
        letterSpacing: '0.2px',
      });
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
      XR8.pause();
      XR8.stop();
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
      if (screen === 'inApp') {
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

    return {
      name: 'custom-loading',

      onBeforeRun: () => {
        clearCameraTimers();
        clearUiTimers();
        loadingEl?.remove();
        loadingEl = null;
        hintEl = null;
        cameraFailed = false;
        removed = false;

        // アニメーション用のスタイルは一度だけ追加する。
        if (!document.getElementById('tc-loading-style')) {
          const style = document.createElement('style');
          style.id = 'tc-loading-style';
          style.textContent = `
            @keyframes tc-bounce {
              0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
              40%            { transform: translateY(-10px); opacity: 1; }
            }
            .tc-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #4de8e0;
              animation: tc-bounce 1.4s ease-in-out infinite;
            }
            .tc-dot:nth-child(2) { animation-delay: 0.2s; }
            .tc-dot:nth-child(3) { animation-delay: 0.4s; }
          `;
          document.head.appendChild(style);
          loadingStyleEl = style;
        }

        ensureOverlay();

        // ロード中のドット。
        const dotsWrap = document.createElement('div');
        Object.assign(dotsWrap.style, { display: 'flex', gap: '10px', flexShrink: '0' });
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('div');
          dot.className = 'tc-dot';
          dotsWrap.appendChild(dot);
        }

        // 区切り線。
        const divider = document.createElement('div');
        Object.assign(divider.style, {
          width: '200px',
          height: '1px',
          backgroundColor: '#2e4570',
          flexShrink: '0',
        });

        // カメラ起動から読み取りまでの手順。
        const guide = document.createElement('div');
        Object.assign(guide.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textAlign: 'left',
          maxWidth: '100%',
          flexShrink: '0',
        });

        const steps = [
          'カメラへのアクセスを許可してください',
          '名刺にスマホをかざしてください',
        ];
        steps.forEach((text, i) => {
          const row = document.createElement('div');
          Object.assign(row.style, { display: 'flex', alignItems: 'baseline', gap: '10px' });

          const num = document.createElement('span');
          Object.assign(num.style, {
            color: '#4de8e0',
            fontWeight: 'bold',
            fontSize: '16px',
            flexShrink: '0',
          });
          num.textContent = `${['①', '②'][i]}`;

          const label = document.createElement('span');
          Object.assign(label.style, {
            fontSize: '16px',
            color: 'rgba(246,246,246,0.7)',
            lineHeight: '1.5',
          });
          label.textContent = text;

          row.appendChild(num);
          row.appendChild(label);
          guide.appendChild(row);
        });

        // 下部のヒントや診断情報と重ならないよう、フッターも通常の配置にする。
        footerEl = createFooter('Powered by Tech Connect');

        loadingEl.appendChild(createLogo());
        loadingEl.appendChild(dotsWrap);
        loadingEl.appendChild(divider);
        loadingEl.appendChild(guide);
        loadingEl.appendChild(footerEl);
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
        loadingStyleEl?.remove();
        loadingEl = null;
        hintEl = null;
        footerEl = null;
        loadingStyleEl = null;
      },
    };
  },
};
