(() => {
  // 1. Injection des styles pour les animations CSS (fadeOut)
  const injectStyles = () => {
    if (document.getElementById('extension-styles')) return;
    const style = document.createElement('style');
    style.id = 'extension-styles';
    style.textContent = `
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  };
  injectStyles();

  // 2. Interception de l'API History pour détecter les changements d'URL
  (() => {
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    history.pushState = function(...args) {
      const result = pushState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };
    history.replaceState = function(...args) {
      const result = replaceState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };
    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('locationchange'));
    });
  })();

  // 3. Fonction pour vérifier si la page actuelle est une page Reels (Facebook ou Instagram)
  const isReelPage = () => {
    return /^https:\/\/(?:\w+\.)?(facebook\.com\/reel|instagram\.com\/reels)/.test(window.location.href);
  };

  // 4. Fonction de notification
  const showNotification = (message, isSuccess = true, duration = 3000) => {
    const notification = document.createElement('div');
    notification.textContent = message;
    Object.assign(notification.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: isSuccess ? 'rgba(0, 128, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      zIndex: '9999999',
      textAlign: 'center',
      maxWidth: '90%',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      fontSize: '16px'
    });
    notification.style.animation = `fadeOut 0.3s ${duration}ms forwards`;
    notification.addEventListener('animationend', () => {
      notification.remove();
    });
    document.body.appendChild(notification);
    return notification;
  };

  // 5. Extraction et téléchargement vidéo (fonctionnalités inchangées)
  const downloadVideo = (videoUrl, quality, source) => {
    console.log(`[Extension] Téléchargement de la vidéo (${source}) en qualité ${quality}`);
    showNotification(`Vidéo trouvée en ${quality} ! Téléchargement...`, true, 3000);
    const downloadLink = document.createElement("a");
    downloadLink.href = videoUrl;
    downloadLink.download = `${source}_video_${quality}.mp4`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const extractFacebookVideo = (html) => {
    const fbVideoUrlPattern = /"progressive_url":"([^"]+\.mp4[^"]*oe=[^"&]+[^"]*)","failure_reason":null,"metadata":\{"quality":"([^"]+)"\}/gi;
    const fbVideoUrls = { hd: [], sd: null };
    let fbMatch;
    while ((fbMatch = fbVideoUrlPattern.exec(html)) !== null) {
      if (!fbMatch[1] || !fbMatch[2]) continue;
      const fbUrl = fbMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
      const fbQuality = fbMatch[2];
      console.log(`[Extension] URL Facebook trouvée (${fbQuality}) : ${fbUrl}`);
      if (fbQuality === "HD") {
        fbVideoUrls.hd.push(fbUrl);
      } else if (fbQuality === "SD" && !fbVideoUrls.sd) {
        fbVideoUrls.sd = fbUrl;
      }
    }
    let fbSelectedUrl = null;
    let fbQualityLabel = "";
    if (fbVideoUrls.hd.length >= 1) {
      fbSelectedUrl = fbVideoUrls.hd[0];
      fbQualityLabel = "HD";
      if (fbVideoUrls.hd.length > 1) {
        console.log(`[Extension] ${fbVideoUrls.hd.length} URL HD trouvées, utilisation de la première`);
      }
    } else if (fbVideoUrls.sd) {
      fbSelectedUrl = fbVideoUrls.sd;
      fbQualityLabel = "SD";
    }
    if (fbSelectedUrl) {
      downloadVideo(fbSelectedUrl, fbQualityLabel, "facebook");
    } else {
      console.error("[Extension] Impossible de trouver la vidéo Facebook");
      showNotification("Impossible de trouver la vidéo Facebook", false, 5000);
    }
  };

  const extractInstagramVideo = (html) => {
    const igVideoPattern = /"type":101,"url":"([^"]+)"/gi;
    let igMatch;
    let igSelectedUrl = null;
    while ((igMatch = igVideoPattern.exec(html)) !== null) {
      if (!igMatch[1]) continue;
      const igUrl = igMatch[1]
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/\\u00253D/g, '=')
        .replace(/\\u0025/g, '%');
      console.log(`[Extension] URL Instagram trouvée (type 101) : ${igUrl}`);
      if (!igSelectedUrl) {
        igSelectedUrl = igUrl;
        break;
      }
    }
    if (igSelectedUrl) {
      downloadVideo(igSelectedUrl, "HD (Instagram)", "instagram");
    } else {
      console.error("[Extension] Impossible de trouver la vidéo Instagram");
      showNotification("Impossible de trouver la vidéo Instagram", false, 5000);
    }
  };

  const getVideoSource = () => {
    if (/^https:\/\/(?:\w+\.)?instagram\.com\/reels/.test(window.location.href)) {
      return "instagram";
    } else if (/^https:\/\/(?:\w+\.)?facebook\.com\/reel/.test(window.location.href)) {
      return "facebook";
    } else if (/^https:\/\/(?:\w+\.)?youtube\.com/.test(window.location.href)) {
      return "youtube";
    } else if (/^https:\/\/(?:\w+\.)?twitter\.com/.test(window.location.href)) {
      return "twitter";
    }
    return "facebook";
  };

  const extractAndDownloadVideo = (source) => {
    if (!source) {
      source = getVideoSource();
    }
    const validSources = ["facebook", "instagram", "youtube", "twitter"];
    if (!validSources.includes(source)) {
      console.error(`[Extension] Source invalide : ${source}. Doit être une de : ${validSources.join(", ")}`);
      showNotification(`Source invalide : ${source}`, false, 5000);
      return;
    }
    const html = document.documentElement.innerHTML;
    switch (source) {
      case "facebook":
        extractFacebookVideo(html);
        break;
      case "instagram":
        if (/^https:\/\/(?:\w+\.)?instagram\.com\/reels/.test(window.location.href)) {
          extractInstagramVideo(html);
        } else {
          console.error("[Extension] La page n'est pas une page Reels Instagram");
          showNotification("La page n'est pas une page Reels Instagram", false, 5000);
        }
        break;
      case "youtube":
      case "twitter":
        console.log(`[Extension] Extraction pour ${source.charAt(0).toUpperCase() + source.slice(1)} non implémentée`);
        showNotification(`${source.charAt(0).toUpperCase() + source.slice(1)} extraction non implémentée`, false, 5000);
        break;
    }
  };

  // 6. Formatage du temps en mm:ss
  const formatTime = time => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  // 7. Interface utilisateur et barre de contrôle

  // Calcul de la distance entre le centre de la vidéo et le centre de la fenêtre
  const getCenterDistance = video => {
    const rect = video.getBoundingClientRect();
    const videoCenterX = rect.left + rect.width / 2;
    const videoCenterY = rect.top + rect.height / 2;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    return Math.hypot(videoCenterX - centerX, videoCenterY - centerY);
  };

  // Mise à jour de la position de la barre de contrôle
  const updateControlBarPosition = (video, controlBar) => {
    const rect = video.getBoundingClientRect();
    controlBar.style.top = `${window.scrollY + rect.bottom - controlBar.offsetHeight - 10}px`;
    controlBar.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (controlBar.offsetWidth / 2)}px`;
  };

  // Création de la barre de contrôle
  const createControlBar = video => {
    const controlBar = document.createElement('div');
    controlBar.classList.add('extension-control-bar');
    Object.assign(controlBar.style, {
      position: 'absolute',
      backgroundColor: 'rgba(0, 10, 15, 0.8)',
      borderRadius: '8px',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: '2147483647',
      pointerEvents: 'auto',
      transition: 'opacity 0.3s',
      opacity: '1',
      color: 'white'
    });

    // Bouton lecture/pause
    const playPauseButton = document.createElement('button');
    playPauseButton.classList.add('play-pause-button');
    playPauseButton.textContent = video.paused ? "►" : "❚❚";
    Object.assign(playPauseButton.style, {
      cursor: 'pointer',
      border: 'none',
      background: 'none',
      transition: 'color 0.3s'
    });
    playPauseButton.addEventListener('mouseover', () => playPauseButton.style.color = 'indigo');
    playPauseButton.addEventListener('mouseout', () => playPauseButton.style.color = '');

    // Temps écoulé
    const elapsedTime = document.createElement('span');
    elapsedTime.textContent = "00:00";

    // Barre de progression
    const progressBar = document.createElement('input');
    progressBar.type = 'range';
    progressBar.min = 0;
    progressBar.max = 100;
    progressBar.value = 0;
    progressBar.style.flex = '1';
    progressBar.style.cursor = 'pointer';

    // Temps total
    const totalTime = document.createElement('span');
    totalTime.textContent = "00:00";

    // Curseur volume
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = 0;
    volumeSlider.max = 1;
    volumeSlider.step = 0.01;
    volumeSlider.style.width = '80px';
    volumeSlider.style.cursor = 'pointer';

    // Chargement du volume stocké
    const storedVolume = localStorage.getItem('extension_video_volume');
    let sliderValue = storedVolume !== null ? parseFloat(storedVolume) : Math.sqrt(video.volume);
    volumeSlider.value = sliderValue;
    video.volume = Math.pow(sliderValue, 2);

    // Assemblage
    controlBar.append(
      playPauseButton,
      elapsedTime,
      progressBar,
      totalTime,
      (() => {
        const separator = document.createElement('div');
        Object.assign(separator.style, {
          width: '1px',
          height: '20px',
          backgroundColor: 'grey',
          marginLeft: '10px',
          marginRight: '10px'
        });
        return separator;
      })(),
      volumeSlider,
      (() => {
        const separator = document.createElement('div');
        Object.assign(separator.style, {
          width: '1px',
          height: '20px',
          backgroundColor: 'grey',
          marginLeft: '10px',
          marginRight: '10px'
        });
        return separator;
      })(),
      (() => {
        const downloadButton = document.createElement('button');
        downloadButton.classList.add('download-button');
        downloadButton.textContent = '⇩';
        Object.assign(downloadButton.style, {
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          fontSize: '20px',
          transition: 'color 0.3s'
        });
        downloadButton.addEventListener('mouseover', () => downloadButton.style.color = 'indigo');
        downloadButton.addEventListener('mouseout', () => downloadButton.style.color = '');
        downloadButton.addEventListener('click', function(e) {
          e.stopPropagation();
          const notification = document.createElement('div');
          notification.textContent = "Actualisation de la page pour récupérer le lien vidéo...";
          Object.assign(notification.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            zIndex: '9999999',
            textAlign: 'center',
            maxWidth: '90%',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            fontSize: '16px'
          });
          document.body.appendChild(notification);
          const source = getVideoSource();
          sessionStorage.setItem(`${source}_video_download`, 'true');
          sessionStorage.setItem(`${source}_video_timestamp`, Date.now().toString());
          notification.style.animation = `fadeOut 0.3s 1000ms forwards`;
          notification.addEventListener('animationend', () => {
            window.location.reload();
          });
        });
        return downloadButton;
      })()
    );

    // Événements de contrôle
    playPauseButton.addEventListener('click', e => {
      e.stopPropagation();
      if (video.paused) {
        video.play();
        playPauseButton.textContent = "❚❚";
      } else {
        video.pause();
        playPauseButton.textContent = "►";
      }
    });

    progressBar.addEventListener('input', e => {
      e.stopPropagation();
      video.currentTime = (progressBar.value / 100) * video.duration;
    });

    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const prog = (video.currentTime / video.duration) * 100;
        progressBar.value = prog;
        elapsedTime.textContent = formatTime(video.currentTime);
        totalTime.textContent = formatTime(video.duration);
      }
    });

    volumeSlider.addEventListener('input', e => {
      e.stopPropagation();
      const val = parseFloat(volumeSlider.value);
      video.volume = Math.pow(val, 2);
      localStorage.setItem('extension_video_volume', val);
    });

    updateControlBarPosition(video, controlBar);
    controlBar._video = video;
    video._controlBar = controlBar;
    video._lastSrc = video.src;

    document.body.appendChild(controlBar);
    requestAnimationFrame(() => updateControlBarPosition(video, controlBar));
    return controlBar;
  };

  const removeControlBar = video => {
    if (video._controlBar) {
      video._controlBar.remove();
      delete video._controlBar;
      delete video._lastSrc;
    }
  };

  // 8. Détection de la vidéo active via calcul de la distance au centre
  const updateActiveVideoControlBar = () => {
    // Si la page n'est pas une page Reels, on supprime toute barre de contrôle
    if (!isReelPage()) {
      document.querySelectorAll('.extension-control-bar').forEach(bar => bar.remove());
      return;
    }
    const videos = Array.from(document.querySelectorAll('video')).filter(v => v.isConnected);
    let activeVideo = null;
    let minDistance = Infinity;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    videos.forEach(video => {
      const rect = video.getBoundingClientRect();
      const videoCenterX = rect.left + rect.width / 2;
      const videoCenterY = rect.top + rect.height / 2;
      const distance = Math.hypot(videoCenterX - centerX, videoCenterY - centerY);
      if (distance < minDistance) {
        minDistance = distance;
        activeVideo = video;
      }
    });
    videos.forEach(video => {
      if (video === activeVideo && !video.paused) {
        if (!video._controlBar) {
          createControlBar(video);
        } else {
          updateControlBarPosition(video, video._controlBar);
        }
      } else if (video._controlBar) {
        removeControlBar(video);
      }
    });
  };

  // 9. Boucle de mise à jour continue (pour l'UI)
  const updateLoop = () => {
    updateActiveVideoControlBar();
    requestAnimationFrame(updateLoop);
  };
  requestAnimationFrame(updateLoop);

  // 10. Gestion du téléchargement automatique
  const checkAndDownload = () => {
    const source = getVideoSource();
    const isDownloadRequested = sessionStorage.getItem(`${source}_video_download`) === 'true';
    const requestTimestamp = parseInt(sessionStorage.getItem(`${source}_video_timestamp`) || '0');
    const isRequestRecent = (Date.now() - requestTimestamp) < 30000;
    if (!isDownloadRequested || !isRequestRecent) return;
    console.log("[Extension] Page rechargée, recherche du lien vidéo...");
    sessionStorage.removeItem(`${source}_video_download`);
    sessionStorage.removeItem(`${source}_video_timestamp`);
    if (document.readyState === 'complete') {
      extractAndDownloadVideo(source);
    } else {
      window.addEventListener('load', () => extractAndDownloadVideo(source), { once: true });
    }
    showNotification("Analyse en cours, veuillez patienter...", true, 3000);
  };
  checkAndDownload();

  // 11. Gestion de l'inactivité du curseur
  let lastMouseMoveTime = performance.now();
  document.addEventListener('mousemove', () => {
    lastMouseMoveTime = performance.now();
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      bar.style.opacity = '1';
    });
  });
  const checkInactivity = () => {
    if (performance.now() - lastMouseMoveTime > 1500) {
      document.querySelectorAll('.extension-control-bar').forEach(bar => {
        bar.style.opacity = '0';
      });
    }
    requestAnimationFrame(checkInactivity);
  };
  requestAnimationFrame(checkInactivity);

  // 12. Événements globaux et rafraîchissement
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      if (bar._video) updateControlBarPosition(bar._video, bar);
    });
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      if (bar._video) updateControlBarPosition(bar._video, bar);
    });
  });
  window.addEventListener('locationchange', () => {
    // Au changement d'URL, on supprime les barres existantes pour laisser place à la nouvelle logique
    document.querySelectorAll('.extension-control-bar').forEach(bar => bar.remove());
  });

  console.log("▶️ Logiciel complet lancé.");
})();
