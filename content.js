(() => {
  // Utility function to format time in mm:ss format
  const formatTime = time => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  // Remove orphaned control bars
  const cleanupControlBars = () => {
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      if (!bar._video || !bar._video.isConnected) {
        bar.remove();
      }
    });
  };

  // Calculate the intersection ratio of a video element
  const getIntersectionRatio = video => {
    const rect = video.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const intersectionRect = {
      top: Math.max(rect.top, 0),
      bottom: Math.min(rect.bottom, vh),
      left: Math.max(rect.left, 0),
      right: Math.min(rect.right, vw)
    };
    const iw = Math.max(intersectionRect.right - intersectionRect.left, 0);
    const ih = Math.max(intersectionRect.bottom - intersectionRect.top, 0);
    const area = iw * ih;
    return rect.width * rect.height ? area / (rect.width * rect.height) : 0;
  };

  // Update the control bar position relative to the video
  const updateControlBarPosition = (video, controlBar) => {
    const rect = video.getBoundingClientRect();
    controlBar.style.top = `${window.scrollY + rect.bottom - controlBar.offsetHeight - 10}px`;
    controlBar.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (controlBar.offsetWidth / 2)}px`;
  };

  // Symbols for play and pause
  const PLAY_SYMBOL = "►";
  const PAUSE_SYMBOL = "❚❚";

  // Create and return a control bar for a given video
  const createControlBar = video => {
    const controlBar = document.createElement('div');
    controlBar.classList.add('extension-control-bar');
    Object.assign(controlBar.style, {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: '2147483647',
      pointerEvents: 'auto',
      transition: 'opacity 0.3s',
      opacity: '1'
    });

    // Play/Pause button
    const playPauseButton = document.createElement('button');
    playPauseButton.classList.add('play-pause-button');
    playPauseButton.textContent = video.paused ? PLAY_SYMBOL : PAUSE_SYMBOL;
    Object.assign(playPauseButton.style, {
      cursor: 'pointer',
      border: 'none',
      background: 'none',
      transition: 'color 0.3s'
    });
    playPauseButton.addEventListener('mouseover', () => playPauseButton.style.color = 'indigo');
    playPauseButton.addEventListener('mouseout', () => playPauseButton.style.color = '');

    // Display elapsed time
    const elapsedTime = document.createElement('span');
    elapsedTime.textContent = "00:00";

    // Progress bar
    const progressBar = document.createElement('input');
    progressBar.type = 'range';
    progressBar.min = 0;
    progressBar.max = 100;
    progressBar.value = 0;
    progressBar.style.flex = '1';
    progressBar.style.cursor = 'pointer';

    // Display total time
    const totalTime = document.createElement('span');
    totalTime.textContent = "00:00";

    // Volume slider (logarithmic control)
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = 0;
    volumeSlider.max = 1;
    volumeSlider.step = 0.01;
    volumeSlider.style.width = '80px';
    volumeSlider.style.cursor = 'pointer';

    // Load stored volume and set the video's volume
    const storedVolume = localStorage.getItem('extension_fb_video_volume');
    let sliderValue;
    if (storedVolume !== null) {
      sliderValue = parseFloat(storedVolume);
    } else {
      sliderValue = Math.sqrt(video.volume);
    }
    volumeSlider.value = sliderValue;
    video.volume = Math.pow(sliderValue, 2);

    // Assemble the control bar elements
    controlBar.append(playPauseButton, elapsedTime, progressBar, totalTime, volumeSlider);

    // Add a separator and a download button
    const separator = document.createElement('div');
    Object.assign(separator.style, {
      width: '1px',
      height: '20px',
      backgroundColor: 'grey',
      marginLeft: '10px',
      marginRight: '10px'
    });

    const downloadButton = document.createElement('button');
    downloadButton.classList.add('download-button');
    downloadButton.textContent = '⇩';
    Object.assign(downloadButton.style, {
      cursor: 'pointer',
      border: 'none',
      background: 'none',
      transition: 'color 0.3s'
    });
    downloadButton.addEventListener('mouseover', () => downloadButton.style.color = 'indigo');
    downloadButton.addEventListener('mouseout', () => downloadButton.style.color = '');
    downloadButton.addEventListener('click', function(e) {
      e.stopPropagation();
    
      // Inform the user that the page will be refreshed to retrieve the video link
      const notification = document.createElement('div');
      notification.textContent = "Refreshing the page to retrieve the video link...";
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
      
      // Store an indicator in sessionStorage (persists across refreshes)
      sessionStorage.setItem('facebook_video_download', 'true');
      sessionStorage.setItem('facebook_video_timestamp', Date.now().toString());
      
      // Add a slight delay before reloading so the user can see the notification
      setTimeout(function() {
        // Reload the page
        window.location.reload();
      }, 1000);
    });
    
    // Function to check and initiate download if requested
    function checkAndDownload() {
      // Verify if download was requested and is recent (within the last 30 seconds)
      const isDownloadRequested = sessionStorage.getItem('facebook_video_download') === 'true';
      const requestTimestamp = parseInt(sessionStorage.getItem('facebook_video_timestamp') || '0');
      const isRequestRecent = (Date.now() - requestTimestamp) < 30000;
      
      if (!isDownloadRequested || !isRequestRecent) return;
      
      console.log("[Extension] Page reloaded, searching for video link...");
      
      // Clear session storage flags
      sessionStorage.removeItem('facebook_video_download');
      sessionStorage.removeItem('facebook_video_timestamp');
      
      showNotification("Analyzing, please wait...", true, 3000);
      
      // Wait for the page to fully load before extracting video links
      setTimeout(() => extractAndDownloadVideo(), 3000);
    }

    /**
     * Creates and displays a notification to the user
     * @param {string} message - Notification message
     * @param {boolean} isSuccess - Whether this is a success or error notification
     * @param {number} duration - Time in ms before notification disappears
     */
    function showNotification(message, isSuccess = true, duration = 3000) {
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
      
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), duration);
      
      return notification;
    }

    // Extracts video URLs from the page HTML and initiates download
    function extractAndDownloadVideo() {
      const html = document.documentElement.innerHTML;
      const videoUrlPattern = /"progressive_url":"([^"]+\.mp4[^"]*oe=[^"&]+[^"]*)","failure_reason":null,"metadata":\{"quality":"([^"]+)"\}/gi;
      
      const videoUrls = {
        hd: [],
        sd: null
      };
      
      // Extract all video links from the page
      let match;
      while ((match = videoUrlPattern.exec(html)) !== null) {
        if (!match[1] || !match[2]) continue;
        
        const url = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
        const quality = match[2];
        
        console.log(`[Extension] Found URL (${quality}): ${url}`);
        
        if (quality === "HD") {
          videoUrls.hd.push(url);
        } else if (quality === "SD" && !videoUrls.sd) {
          videoUrls.sd = url;
        }
      }
      
      // Select the best available video quality
      let selectedUrl = null;
      let qualityLabel = "";
      
      if (videoUrls.hd.length >= 1) {
        selectedUrl = videoUrls.hd[0]; // Choose first HD URL
        qualityLabel = "HD";
        
        // If multiple HD URLs were found, log this for debugging
        if (videoUrls.hd.length > 1) {
          console.log(`[Extension] Found ${videoUrls.hd.length} HD URLs, using first one`);
        }
      } else if (videoUrls.sd) {
        selectedUrl = videoUrls.sd;
        qualityLabel = "SD";
      }
      
      if (selectedUrl) {
        downloadVideo(selectedUrl, qualityLabel);
      } else {
        console.error("[Extension] Unable to find video after refresh");
        showNotification("Unable to find video after refresh", false, 5000);
      }
    }

    /**
     * Downloads the video using the provided URL
     * @param {string} videoUrl - The URL of the video to download
     * @param {string} quality - The quality label (HD/SD)
     */
    function downloadVideo(videoUrl, quality) {
      console.log(`[Extension] Downloading video in ${quality} quality`);
      
      // Show success notification
      showNotification(`Video found in ${quality} quality! Downloading...`);
      
      // Create download link and trigger click
      const downloadLink = document.createElement("a");
      downloadLink.href = videoUrl;
      downloadLink.download = `facebook_video_${quality}.mp4`;
      
      // Add link to DOM, click it, then remove it
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
      
    // Execute download check on page load
    checkAndDownload();

    controlBar.append(separator, downloadButton);

    document.body.appendChild(controlBar);

    // Event: toggle play/pause
    playPauseButton.addEventListener('click', e => {
      e.stopPropagation();
      if (video.paused) {
        video.play();
        playPauseButton.textContent = PAUSE_SYMBOL;
      } else {
        video.pause();
        playPauseButton.textContent = PLAY_SYMBOL;
      }
    });

    // Update video position using the progress bar
    progressBar.addEventListener('input', e => {
      e.stopPropagation();
      video.currentTime = (progressBar.value / 100) * video.duration;
    });

    // Update time and progress bar during playback
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const prog = (video.currentTime / video.duration) * 100;
        progressBar.value = prog;
        elapsedTime.textContent = formatTime(video.currentTime);
        totalTime.textContent = formatTime(video.duration);
      }
    });

    // Logarithmic volume control
    volumeSlider.addEventListener('input', e => {
      e.stopPropagation();
      const val = parseFloat(volumeSlider.value);
      video.volume = Math.pow(val, 2);
      localStorage.setItem('extension_fb_video_volume', val);
    });

    updateControlBarPosition(video, controlBar);
    controlBar._video = video;
    video._controlBar = controlBar;
    video._lastSrc = video.src;
    return controlBar;
  };

  // Remove the control bar associated with a video
  const removeControlBar = video => {
    if (video._controlBar) {
      video._controlBar.remove();
      delete video._controlBar;
      delete video._lastSrc;
    }
  };

  // Update the control bar for the active video (the one with the highest intersection ratio)
  const updateActiveVideoControlBar = () => {
    cleanupControlBars();
    let activeVideo = null, maxRatio = 0;
    const videos = Array.from(document.querySelectorAll('video')).filter(v => v.isConnected);
    videos.forEach(video => {
      const ratio = getIntersectionRatio(video);
      if (ratio > maxRatio) {
        maxRatio = ratio;
        activeVideo = video;
      }
    });
    videos.forEach(video => {
      if (video === activeVideo) {
        if (video._controlBar && video._lastSrc !== video.src) {
          removeControlBar(video);
        }
        if (!video._controlBar) {
          createControlBar(video);
        }
      } else if (video._controlBar) {
        removeControlBar(video);
      }
    });
  };

  // Unified refresh: update positions and active control bar
  const refreshControlBars = () => {
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      if (bar._video) updateControlBarPosition(bar._video, bar);
    });
    updateActiveVideoControlBar();
  };

  // Global listeners to refresh the control bar (scroll, resize, DOM mutations)
  window.addEventListener('scroll', refreshControlBars);
  window.addEventListener('resize', refreshControlBars);
  new MutationObserver(refreshControlBars).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', refreshControlBars);

  // Handle cursor inactivity: hide the control bar after 1.5 seconds without movement
  let hideTimeout;
  document.addEventListener('mousemove', () => {
    document.querySelectorAll('.extension-control-bar').forEach(bar => {
      bar.style.opacity = '1';
    });
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      document.querySelectorAll('.extension-control-bar').forEach(bar => {
        bar.style.opacity = '0';
      });
    }, 1500);
  });

  // Initial refresh
  refreshControlBars();
})();
