document.addEventListener("DOMContentLoaded", function () {
  const coverPivot = document.querySelector('#cover-pivot');
  const logo = document.querySelector('#logo');
  const logoVideo = document.querySelector('#logo-video');
  const introContainer = document.querySelector('#intro-container');
  const btnInstagram = document.querySelector('#btn-instagram');
  const btnWebsite = document.querySelector('#btn-website');
  const btnPortfolio = document.querySelector('#btn-portfolio');
  const target = document.querySelector('[mindar-image-target]');
  const portfolioPanel = document.querySelector('#portfolio-panel');
  const closePortfolioBtn = document.querySelector('#btn-close-portfolio');

  // ========================================
  // 遅延読み込み（Lazy Loading）
  // ========================================
  const lazyAssets = {
    'card-inside': './assets/meishi_inside.png',
    'logo-video': './assets/logoanimation.mp4',
    'intro-profile': './assets/intro_profile.jpg',
    'intro-name': './assets/intro_name.png',
    'intro-job': './assets/intro_job.png',
    'intro-catch': './assets/intro_catch.png',
    'icon-instagram': './assets/icon_instagram.png',
    'icon-website': './assets/icon_website.png',
    'icon-portfolio': './assets/icon_potfolio.png'
  };

  let assetsLoaded = false;

  function loadLazyAssets() {
    if (assetsLoaded) return Promise.resolve();

    console.log('[Lazy] Loading deferred assets...');
    const promises = [];

    for (const [id, src] of Object.entries(lazyAssets)) {
      const element = document.querySelector(`#${id}`);
      if (element) {
        if (element.tagName === 'VIDEO') {
          element.src = src;
          element.load();
          promises.push(new Promise((resolve) => {
            element.oncanplaythrough = resolve;
            element.onerror = resolve; // エラーでも続行
            setTimeout(resolve, 5000); // 5秒タイムアウト
          }));
        } else {
          element.src = src;
          promises.push(new Promise((resolve) => {
            element.onload = resolve;
            element.onerror = resolve;
          }));
        }
      }
    }

    return Promise.all(promises).then(() => {
      assetsLoaded = true;
      console.log('[Lazy] All deferred assets loaded!');
    });
  }

  // ページ読み込み完了後にバックグラウンドで遅延読み込み開始
  setTimeout(loadLazyAssets, 100);

  // ========================================
  // ボタンクリックイベント
  // ========================================
  btnInstagram.addEventListener('click', () => {
    console.log("Instagram button clicked");
    window.open('https://www.instagram.com/techconnect.em/', '_blank');
  });

  btnWebsite.addEventListener('click', () => {
    console.log("Website button clicked");
    window.open('https://techconnect-em.com', '_blank');
  });

  btnPortfolio.addEventListener('click', () => {
    console.log("Portfolio button clicked");
    portfolioPanel.setAttribute('scale', '1 1 1');
  });

  closePortfolioBtn.addEventListener('click', () => {
    console.log("Close portfolio clicked");
    portfolioPanel.setAttribute('scale', '0 0 0');
  });

  // ========================================
  // ターゲット検出時のアニメーション
  // ========================================
  target.addEventListener("targetFound", event => {
    console.log("Target found - triggering animation");

    // アセットが読み込まれていなければ待つ
    loadLazyAssets().then(() => {
      // Emit custom event 'open' to children to start animation
      coverPivot.emit('open');
      logo.emit('open');

      // Play video after delay (matching the animation delay)
      setTimeout(() => {
        logoVideo.play();
      }, 2800);

      // Reset video to start frame when ended
      logoVideo.addEventListener('ended', () => {
        logoVideo.currentTime = 0;
      });

      // v2 Sequence: Move logo to header and show intro text
      setTimeout(() => {
        logo.emit('moveHeader');
        introContainer.emit('showIntro');
        introContainer.querySelectorAll('*').forEach(el => el.emit('showIntro'));
        btnInstagram.emit('showIntro');
        btnWebsite.emit('showIntro');
        btnPortfolio.emit('showIntro');
      }, 7300);
    });
  });

  target.addEventListener("targetLost", event => {
    console.log("Target lost");
  });
});
