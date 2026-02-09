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

  // Instagram Button Click
  btnInstagram.addEventListener('click', () => {
    console.log("Instagram button clicked");
    window.open('https://www.instagram.com/techconnect.em/', '_blank');
  });

  // Website Button Click
  btnWebsite.addEventListener('click', () => {
    console.log("Website button clicked");
    window.open('https://techconnect-em.com', '_blank');
  });

  // Portfolio Button Click - Show Hologram Panel
  btnPortfolio.addEventListener('click', () => {
    console.log("Portfolio button clicked");
    portfolioPanel.setAttribute('scale', '1 1 1');
  });

  // Close Portfolio Hologram Panel
  closePortfolioBtn.addEventListener('click', () => {
    console.log("Close portfolio clicked");
    portfolioPanel.setAttribute('scale', '0 0 0');
  });

  target.addEventListener("targetFound", event => {
    console.log("Target found - triggering animation");
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

      // Emit showIntro to container and all children
      introContainer.emit('showIntro');
      introContainer.querySelectorAll('*').forEach(el => el.emit('showIntro'));

      // Show Instagram & Website Button & Portfolio
      btnInstagram.emit('showIntro');
      btnWebsite.emit('showIntro');
      btnPortfolio.emit('showIntro');
    }, 7300);
  });

  target.addEventListener("targetLost", event => {
    console.log("Target lost");
  });
});
