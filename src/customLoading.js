/**
 * Custom loading screen — Tech Connect branding.
 * Replaces XRExtras.Loading.pipelineModule().
 */
export const customLoading = {
  pipelineModule: () => {
    let loadingEl = null;

    return {
      name: 'custom-loading',

      onBeforeRun: () => {
        // Inject keyframe animation once
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
        }

        // Build overlay
        loadingEl = document.createElement('div');
        Object.assign(loadingEl.style, {
          position: 'fixed',
          inset: '0',
          zIndex: '9999',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '12vh',
          backgroundColor: '#1c2f56',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          color: '#f6f6f6',
          gap: '28px',
          boxSizing: 'border-box',
        });

        // Logo
        const logo = document.createElement('div');
        Object.assign(logo.style, {
          fontSize: '28px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
        });
        logo.innerHTML = '<span style="color:#f6f6f6">Tech</span><span style="color:#4de8e0"> Connect</span>';

        // Dot indicator
        const dotsWrap = document.createElement('div');
        Object.assign(dotsWrap.style, { display: 'flex', gap: '10px' });
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('div');
          dot.className = 'tc-dot';
          dotsWrap.appendChild(dot);
        }

        // Divider
        const divider = document.createElement('div');
        Object.assign(divider.style, {
          width: '200px',
          height: '1px',
          backgroundColor: '#2e4570',
        });

        // Guide steps
        const guide = document.createElement('div');
        Object.assign(guide.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textAlign: 'left',
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

        // Footer
        const footer = document.createElement('div');
        Object.assign(footer.style, {
          position: 'absolute',
          bottom: '28px',
          fontSize: '13px',
          color: '#4a6080',
          letterSpacing: '0.2px',
        });
        footer.textContent = 'Powered by Tech Connect';

        loadingEl.appendChild(logo);
        loadingEl.appendChild(dotsWrap);
        loadingEl.appendChild(divider);
        loadingEl.appendChild(guide);
        loadingEl.appendChild(footer);
        document.body.appendChild(loadingEl);
      },

      onStart: () => {
        if (!loadingEl) return;
        loadingEl.style.transition = 'opacity 0.4s ease';
        loadingEl.style.opacity = '0';
        setTimeout(() => {
          if (loadingEl) {
            loadingEl.remove();
            loadingEl = null;
          }
        }, 400);
      },

      onRemove: () => {
        if (loadingEl) {
          loadingEl.remove();
          loadingEl = null;
        }
      },
    };
  },
};
