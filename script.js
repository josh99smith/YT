// Global Variables
let player;
let currentVolume = 50; // Initialize volume at 50%
let liveVideos = [];
let currentChannelIndex = 0;
let isStaticPlaying = false; // Flag to track if static is playing
let playerReady = false; // Flag to track if player is ready
let volumeOverlayTimer; // Timer for hiding volume overlay
let videoInfoOverlayTimer; // Timer for hiding video info overlay

// Auto-Scroll Variables
let autoScrollInterval;
let autoScrollPaused = false;
const scrollPauseDuration = 5000; // 5 seconds pause after a full page scroll
const scrollStep = 1; // Pixels to scroll each step
const scrollDelay = 50; // Delay in ms between scroll steps

// Time Bar Variables
let timeUpdateInterval;

// Load the YouTube IFrame API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '', // Initially empty; video loaded via API
        playerVars: {
            'controls': 0, // Hide controls
            'modestbranding': 1, // Minimal YouTube branding
            'rel': 0, // No related videos
            'iv_load_policy': 3, // Hide annotations
            'fs': 0, // Disable fullscreen button
            'disablekb': 1, // Disable keyboard controls
            'autoplay': 1,
            'mute': 1 // Start muted to bypass autoplay restrictions
        },
        events: {
            'onReady': onPlayerReady,
            'onError': onPlayerError
        }
    });
}

// Event: YouTube Player Ready
function onPlayerReady(event) {
    playerReady = true;
    console.log('YouTube Player is ready.');
    // Set initial volume
    player.setVolume(currentVolume);
    updateVolumeOverlay();
    // Load live videos after player is ready
    loadLiveVideos();
    // Unmute on user interaction
    document.body.addEventListener('click', () => {
        player.unMute();
        player.setVolume(currentVolume);
        updateVolumeOverlay();
        console.log('User interaction detected. Player unmuted.');
    }, { once: true });
}

// Event: YouTube Player Error
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    alert('An error occurred with the YouTube Player. Check console for details.');
}

// Function: Load Live Videos from YouTube Data API
async function loadLiveVideos(query = '') {
    try {
        showLoadingIndicator();
        const apiKey = 'AIzaSyCc2W3HqRcnabPmu31CZPiHMYSxNRZedUI'; // Replace with your actual API key
        const maxResultsPerCall = 50;
        const desiredTotal = 250;
        let fetchedTotal = 0;
        let nextPageToken = '';
        const uniqueChannels = new Set();
        const maxApiCalls = 10; // To prevent exceeding quota
        let apiCalls = 0;

        while (fetchedTotal < desiredTotal && apiCalls < maxApiCalls) {
            let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&eventType=live&type=video&regionCode=US&maxResults=${maxResultsPerCall}&relevanceLanguage=en&key=${apiKey}`;
            if (query) {
                apiUrl += `&q=${encodeURIComponent(query)}`;
            }
            if (nextPageToken) {
                apiUrl += `&pageToken=${nextPageToken}`;
            }

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();

            // Process each video item
            for (const item of data.items) {
                const videoId = item.id.videoId;
                const channelName = item.snippet.channelTitle;
                const videoTitle = item.snippet.title;

                // Check for unique channel
                if (!uniqueChannels.has(channelName)) {
                    liveVideos.push({
                        videoId: videoId,
                        channel: channelName,
                        title: videoTitle
                    });
                    uniqueChannels.add(channelName);
                    fetchedTotal++;

                    if (fetchedTotal >= desiredTotal) {
                        break;
                    }
                }
            }

            console.log(`Fetched ${fetchedTotal} unique live videos so far.`);

            // Prepare for next iteration
            nextPageToken = data.nextPageToken;
            if (!nextPageToken) {
                console.log('No more pages available from YouTube API.');
                break;
            }

            apiCalls++;
        }

        console.log(`Total unique live videos fetched: ${liveVideos.length}`);

        if (liveVideos.length > 0 && playerReady) {
            changeChannel(0);
            populateTVGuidePanel(); // Populate TV guide after loading videos
            initializeTimeBar(); // Initialize Time Bar after loadirrng channels
        } else if (liveVideos.length === 0) {
            alert('No live videos found.');
        }
    } catch (error) {
        console.error('Failed to fetch live videos:', error);
        alert('Failed to fetch live videos. Check console for details.');
    } finally {
        hideLoadingIndicator();
    }
}

// Function: Change Channel by Index
function changeChannel(index) {
    if (liveVideos.length === 0) {
        console.warn('No live videos available to change channel.');
        return;
    }
    currentChannelIndex = (index + liveVideos.length) % liveVideos.length;
    const videoId = liveVideos[currentChannelIndex].videoId;
    const channelName = liveVideos[currentChannelIndex].channel;
    const videoTitle = liveVideos[currentChannelIndex].title;
    console.log(`Changing to video ID: ${videoId}`);

    // Display Static Overlay
    showStaticOverlay();

    // Play Static Sound
    playStaticSound();

    // Display Video Info Overlay
    showVideoInfoOverlay(channelName, videoTitle);

    // Update TV Guide Panel Selectionss
    updateTVGuideSelection();

    // Show Channel Number Overlay
    showChannelNumberOverlay(currentChannelIndex + 1); // Channel numbers start at 1

    // After 500ms, hide overlay and change channel
    setTimeout(() => {
        hideStaticOverlay();
        player.loadVideoById({
            'videoId': videoId,
            'startSeconds': 0,
            'suggestedQuality': 'hd1080'
        });
        // Stop Static Sound
        stopStaticSound();
    }, 500);
}

// Function: Increase Volume by 5%
function volumeUp() {
    if (player && typeof player.setVolume === 'function') {
        if (currentVolume < 100) {
            currentVolume += 5;
            if (currentVolume > 100) currentVolume = 100;
            player.setVolume(currentVolume);
            updateVolumeOverlay();
            localStorage.setItem('volumeLevel', currentVolume);
            console.log(`Volume increased to ${currentVolume}%`);
            showVolumeOverlay(); // Show overlay when volume is adjusted
            playButtonSound(); // Play sound effect
        }
    } else {
        console.error('YouTube Player not ready.');
    }
}

// Function: Decrease Volume by 5%1
function volumeDown() {
    if (player && typeof player.setVolume === 'function') {
        if (currentVolume > 0) {
            currentVolume -= 5;
            if (currentVolume < 0) currentVolume = 0;
            player.setVolume(currentVolume);
            updateVolumeOverlay();
            localStorage.setItem('volumeLevel', currentVolume);
            console.log(`Volume decreased to ${currentVolume}%`);
            showVolumeOverlay(); // Show overlay when volume is adjusted
            playButtonSound(); // Play sound effect
        }
    } else {
        console.error('YouTube Player not ready.');
    }
}

// Function: Update Volume Overlay UI
function updateVolumeOverlay() {
    const volumeBars = document.querySelectorAll('.volume-bar');
    const volumeDisplay = document.querySelector('.volume-display');
    const volumeLevel = Math.round(currentVolume / 5); // Convert to 0-20 scale

    volumeBars.forEach((bar, index) => {
        if (index < volumeLevel) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });

    // Update Volume Display
    if (volumeDisplay) {
        volumeDisplay.textContent = `${currentVolume}%`;
    }
}

// Function: Show Volume Overlay and Reset Timer
function showVolumeOverlay() {
    const volumeOverlay = document.querySelector('.volume-overlay');
    volumeOverlay.classList.add('visible');

    // Reset the timer every time the overlay is shown
    resetVolumeOverlayTimer();
}

// Function: Hide Volume Overlay
function hideVolumeOverlay() {
    const volumeOverlay = document.querySelector('.volume-overlay');
    volumeOverlay.classList.remove('visible');
}

// Function: Reset Volume Overlay Timer
function resetVolumeOverlayTimer() {
    // Clear existing timer if any
    if (volumeOverlayTimer) {
        clearTimeout(volumeOverlayTimer);
    }

    // Set a new timer to hide the overlay after 2 seconds
    volumeOverlayTimer = setTimeout(() => {
        hideVolumeOverlay();
    }, 2000); // 2000 milliseconds = 2 seconds
}

// Function: Show Static Overlay
function showStaticOverlay() {
    const staticOverlay = document.querySelector('.static-overlay');
    staticOverlay.style.display = 'block';
    console.log('Static overlay shown.');
}

// Function: Hide Static Overlay
function hideStaticOverlay() {
    const staticOverlay = document.querySelector('.static-overlay');
    staticOverlay.style.display = 'none';
    console.log('Static overlay hidden.');
}

// Function: Play Static Sound
function playStaticSound() {
    const staticSound = document.getElementById('static-sound');
    if (staticSound) {
        staticSound.currentTime = 0; // Reset to start
        staticSound.play().catch(error => {
            console.error('Error playing static sound:', error);
        });
        isStaticPlaying = true;
        console.log('Static sound playing.');
    }
}

// Function: Stop Static Sound
function stopStaticSound() {
    const staticSound = document.getElementById('static-sound');
    if (staticSound && isStaticPlaying) {
        staticSound.pause();
        staticSound.currentTime = 0; // Reset to start for next play
        isStaticPlaying = false;
        console.log('Static sound stopped.');
    }
}

// Function: Show Video Info Overlay and Hide After Delay
function showVideoInfoOverlay(channelName, videoTitle) {
    const videoInfoOverlay = document.querySelector('.video-info-overlay');
    const channelNameElem = videoInfoOverlay.querySelector('.channel-name');
    const videoTitleElem = videoInfoOverlay.querySelector('.video-title');

    // Update the text content
    channelNameElem.textContent = channelName;
    videoTitleElem.textContent = videoTitle;

    // Make the overlay visible
    videoInfoOverlay.classList.add('visible');
    console.log('Video info overlay shown.');

    // Reset the hide timer
    resetVideoInfoOverlayTimer();
}

// Function: Hide Video Info Overlay
function hideVideoInfoOverlay() {
    const videoInfoOverlay = document.querySelector('.video-info-overlay');
    videoInfoOverlay.classList.remove('visible');
    console.log('Video info overlay hidden.');
}

// Function: Reset Video Info Overlay Timer
function resetVideoInfoOverlayTimer() {
    // Clear existing timer if any
    if (videoInfoOverlayTimer) {
        clearTimeout(videoInfoOverlayTimer);
    }

    // Set a new timer to hide the overlay after 7 seconds
    videoInfoOverlayTimer = setTimeout(() => {
        hideVideoInfoOverlay();
    }, 7000); // 7000 milliseconds = 7 seconds
}

// Function: Populate TV Guide Panel with Channel Listings
function populateTVGuidePanel() {
    const channelList = document.querySelector('.channel-list');
    channelList.innerHTML = ''; // Clear existing entries

    liveVideos.forEach((video, index) => {
        const channelEntry = document.createElement('div');
        channelEntry.classList.add('channel-entry');
        channelEntry.setAttribute('data-channel-index', index);
        channelEntry.setAttribute('tabindex', '0'); // Make focusable

        // Container for Channel Number and Name
        const channelInfo = document.createElement('div');
        channelInfo.classList.add('channel-info');

        // Channel Number
        const channelNumber = document.createElement('span');
        channelNumber.classList.add('channel-number');
        channelNumber.textContent = index + 1; // Starting from 1

        // Channel Name
        const channelName = document.createElement('span');
        channelName.classList.add('channel-name-list');
        channelName.textContent = video.channel;

        // Append channel number and name to channelInfo
        channelInfo.appendChild(channelNumber);
        channelInfo.appendChild(channelName);

        // Video Title Box
        const videoTitleBox = document.createElement('div');
        videoTitleBox.classList.add('video-title-box');

        const currentProgram = document.createElement('span');
        currentProgram.classList.add('current-program');
        currentProgram.textContent = video.title;

        videoTitleBox.appendChild(currentProgram);

        // Append channelInfo and videoTitleBox to channelEntry
        channelEntry.appendChild(channelInfo);
        channelEntry.appendChild(videoTitleBox);

        // Add click event to select channel
        channelEntry.addEventListener('click', () => {
            changeChannel(index);
        });

        // Add keypress event for accessibility (Enter and Space keys)
        channelEntry.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                changeChannel(index);
            }
        });

        // Highlight the currently playing channel
        if (index === currentChannelIndex) {
            channelEntry.classList.add('active');
        }

        // Append channel entry to channel list
        channelList.appendChild(channelEntry);
    });

    // Show TV Guide Panel (if not already visible)
    showTVGuidePanel();
    console.log('TV Guide Panel populated.');
}

// Function: Update TV Guide Panel Selection
function updateTVGuideSelection() {
    const channelEntries = document.querySelectorAll('.channel-entry');
    channelEntries.forEach((entry, index) => {
        if (index === currentChannelIndex) {
            entry.classList.add('active');
        } else {
            entry.classList.remove('active');
        }
    });
    console.log('TV Guide Panel selection updated.');
}

// Function: Show TV Guide Panel and Start Auto-Scroll
function showTVGuidePanel() {
    const tvGuidePanel = document.querySelector('.tv-guide-panel');
    tvGuidePanel.classList.add('visible');
    tvGuidePanelVisible = true;
    console.log('TV Guide Panel shown.');
     startAutoScroll();
    // Show Time Bar
    const timeBar = tvGuidePanel.querySelector('.time-bar');
    if (timeBar) {
        timeBar.classList.remove('hidden');
    }

    // Start auto-scroll
    
}

// Function: Hide TV Guide Panel and Stop Auto-Scroll
function hideTVGuidePanel() {
    const tvGuidePanel = document.querySelector('.tv-guide-panel');
    tvGuidePanel.classList.remove('visible');
    tvGuidePanelVisible = false;
    console.log('TV Guide Panel hidden.');

    // Hide Time Bar
    const timeBar = tvGuidePanel.querySelector('.time-bar');
    if (timeBar) {
        timeBar.classList.add('hidden');
    }

    // Stop auto-scroll
    stopAutoScroll();
}

// Function: Show Loading Indicator
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.add('visible');
    console.log('Loading indicator shown.');
}

// Function: Hide Loading Indicator
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.remove('visible');
    console.log('Loading indicator hidden.');
}

// Function: Show Channel Number Overlay
function showChannelNumberOverlay(channelNumber) {
    const overlay = document.getElementById('channel-number-overlay');

    if (overlay) {
        // Set the channel number text
        overlay.textContent = `${channelNumber}`;

        // Make the overlay visible
        overlay.classList.add('visible');
        console.log(`Channel number overlay shown: Channel ${channelNumber}`);

        // Hide the overlay after 7 seconds
        setTimeout(() => {
            overlay.classList.remove('visible');
            console.log('Channel number overlay hidden.');
        }, 7000); // 7000 milliseconds = 7 seconds
    } else {
        console.error('Channel Number Overlay element not found.');
    }
}

// Function: Play Button Sound
function playButtonSound() {
    const buttonSound = document.getElementById('button-sound');
    if (buttonSound) {
        buttonSound.currentTime = 0;
        buttonSound.play().catch(error => {
            console.error('Error playing button sound:', error);
        });
    }
}

// Function: Drag-and-Drop Functionality
function makeElementDraggable(draggableElement, handleElement) {
    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    // Load saved position
    const savedPosition = JSON.parse(localStorage.getItem('remotePosition'));
    if (savedPosition) {
        draggableElement.style.left = savedPosition.left;
        draggableElement.style.top = savedPosition.top;
        draggableElement.style.position = 'fixed';
    }

    // Mouse Events
    handleElement.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragging);
    document.addEventListener('mouseup', dragEnd);

    // Touch Events for Mobile Devices
    handleElement.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragging, { passive: false });
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        e.preventDefault();
        isDragging = true;
        console.log('Drag started.');

        // Add active class for visual feedback
        draggableElement.classList.add('active');

        // Get initial cursor/touch position
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }

        // Get the current position of the element
        const rect = draggableElement.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
    }

    function dragging(e) {
        if (!isDragging) return;
        e.preventDefault();

        let currentX, currentY;

        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        // Calculate the new position
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // Boundaries to prevent the element from moving off-screen
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const elemWidth = draggableElement.offsetWidth;
        const elemHeight = draggableElement.offsetHeight;

        // Ensure the element stays within the viewport
        newX = Math.max(0, Math.min(newX, windowWidth - elemWidth));
        newY = Math.max(0, Math.min(newY, windowHeight - elemHeight));

        // Apply the new position
        draggableElement.style.left = `${newX}px`;
        draggableElement.style.top = `${newY}px`;
        draggableElement.style.position = 'fixed';
    }

    function dragEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        console.log('Drag ended.');

        // Remove active class
        draggableElement.classList.remove('active');

        // Save the current position
        const currentLeft = draggableElement.style.left;
        const currentTop = draggableElement.style.top;
        localStorage.setItem('remotePosition', JSON.stringify({ left: currentLeft, top: currentTop }));
    }
}

// Function: Toggle Retro Mode (Apply/Remove Retro Filter)
function toggleRetroMode() {
    const youtubePlayer = document.getElementById('youtube-player');
    youtubePlayer.classList.toggle('retro-filter');
    console.log('Retro Mode toggled.');
    playButtonSound(); // Play sound effect
}

// Function: Toggle Remote Control Visibility
function toggleRemote() {
    const remote = document.querySelector('.remote');
    const toggleButton = document.getElementById('toggle-remote');
    remote.classList.toggle('hidden');
    if (remote.classList.contains('hidden')) {
        toggleButton.textContent = 'Show Remote';
        console.log('Remote controls hidden.');
    } else {
        toggleButton.textContent = 'Hide Remote';
        console.log('Remote controls shown.');
        playButtonSound(); // Play sound effect
    }
}

// Function: Start Auto-Scroll
function startAutoScroll() {
    const channelList = document.querySelector('.channel-list');
    if (!channelList) return;

    autoScrollInterval = setInterval(() => {
        if (autoScrollPaused) return;

        // Check if we've reached the bottom
        if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 1) { // -1 for precision
            // Loop back to the top
            channelList.scrollTop = 0;
            console.log('Reached the end of the list. Looping back to the top.');
            pauseAutoScroll();
            return;
        }

        // Scroll down by scrollStep pixels
        channelList.scrollTop += scrollStep;

        // Pause after scrolling a full page
        if (channelList.scrollTop % channelList.clientHeight === 0) {
            console.log('Scrolled a full page. Pausing for 5 seconds.');
            pauseAutoScroll();
        }
    }, scrollDelay);

    console.log('Auto-scroll started.');
}

// Function: Pause Auto-Scroll
function pauseAutoScroll() {
    autoScrollPaused = true;
    console.log('Auto-scroll paused.');

    setTimeout(() => {
        autoScrollPaused = false;
        console.log('Auto-scroll resumed.');
    }, scrollPauseDuration);
}

// Function: Stop Auto-Scroll
function stopAutoScroll() {
    clearInterval(autoScrollInterval);
    autoScrollPaused = false;
    console.log('Auto-scroll stopped.');
}

// Function: Setup Auto-Scroll Pause on User Interaction
function setupAutoScrollPauseOnInteraction() {
    const channelList = document.querySelector('.channel-list');
    if (!channelList) return;

    // Pause auto-scroll on mouse enter and touch start
    channelList.addEventListener('mouseenter', pauseAutoScroll);
    channelList.addEventListener('touchstart', pauseAutoScroll, { passive: false });

    // Resume auto-scroll on mouse leave and touch end
    channelList.addEventListener('mouseleave', () => {
        setTimeout(() => {
            autoScrollPaused = false;
        }, scrollPauseDuration);
    });
    channelList.addEventListener('touchend', () => {
        setTimeout(() => {
            autoScrollPaused = false;
        }, scrollPauseDuration);
    });
}

// Initialize Auto-Scroll System
document.addEventListener('DOMContentLoaded', () => {
    setupAutoScrollPauseOnInteraction();
    startAutoScroll();
});

// Function: Initialize Time Bar
function initializeTimeBar() {
    const timeBar = document.querySelector('.time-bar');
    if (!timeBar) {
        console.error('Time Bar element not found.');
        return;
    }

    // Create a separate element for current time display if it doesn't exist
    let currentTimeElement = document.querySelector('.current-time');
    if (!currentTimeElement) {
        currentTimeElement = document.createElement('div');
        currentTimeElement.classList.add('current-time');
        currentTimeElement.setAttribute('aria-label', 'Current Time');
        timeBar.appendChild(currentTimeElement);
    }

    // Generate initial time blocks and update current time
    generateTimeBlocks(currentTimeElement);

    // Update time blocks every second to keep them current
    timeUpdateInterval = setInterval(() => {
        generateTimeBlocks(currentTimeElement);
    }, 1000); // 1000 ms = 1 second
}

// Function: Generate Time Blocks and Update Current Time
function generateTimeBlocks(currentTimeElement) {
    const timeBar = document.querySelector('.time-bar');
    if (!timeBar) return;

    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentSeconds = currentTime.getSeconds();

    // Format the current time with seconds
    const ampm = currentHours >= 12 ? 'PM' : 'AM';
    const displayHours = currentHours % 12 === 0 ? 12 : currentHours % 12;
    const displayMinutes = currentMinutes < 10 ? `0${currentMinutes}` : currentMinutes;
    const displaySeconds = currentSeconds < 10 ? `0${currentSeconds}` : currentSeconds;
    const timeString = `${displayHours}:${displayMinutes}:${displaySeconds} ${ampm}`;

    // Update the current time element
    currentTimeElement.textContent = timeString;

    // Optional: Style the current time element (You can adjust via CSS)
    // Ensure styles are handled via CSS to prevent layout shifts
    // Remove any inline styles added previously

    // Remove existing upcoming time blocks
    const existingTimeBlocks = timeBar.querySelectorAll('.time-block.upcoming');
    existingTimeBlocks.forEach(block => {
        timeBar.removeChild(block);
    });

    // Define number of upcoming blocks (3 as per requirement)
    const numberOfBlocks = 3;

    // Calculate the base time rounded to the nearest 30 minutes
    const baseTime = new Date(currentTime);
    if (currentMinutes >= 15 && currentMinutes < 45) {
        baseTime.setMinutes(30);
    } else if (currentMinutes >= 45) {
        baseTime.setHours(currentHours + 1);
        baseTime.setMinutes(0);
    } else { // currentMinutes < 15
        baseTime.setMinutes(0);
    }
    baseTime.setSeconds(0);

    for (let i = 1; i <= numberOfBlocks; i++) { // Start from 1 to exclude current time
        const blockTime = new Date(baseTime.getTime() + i * 30 * 60000); // 30-minute intervals
        const hours = blockTime.getHours();
        const minutes = blockTime.getMinutes();
        const ampmBlock = hours >= 12 ? 'PM' : 'AM';
        const displayHoursBlock = hours % 12 === 0 ? 12 : hours % 12;
        const displayMinutesBlock = minutes < 10 ? `0${minutes}` : minutes;
        const timeBlockString = `${displayHoursBlock}:${displayMinutesBlock} ${ampmBlock}`;

        const timeBlock = document.createElement('div');
        timeBlock.classList.add('time-block', 'upcoming');
        timeBlock.textContent = timeBlockString;

        // Optional: Style the upcoming time blocks
        // Ensure styles are handled via CSS to maintain static positioning

        timeBar.appendChild(timeBlock);
    }
}

// Function: Show Loading Indicator
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.add('visible');
    console.log('Loading indicator shown.');
}

// Function: Hide Loading Indicator
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.remove('visible');
    console.log('Loading indicator hidden.');
}

// Keyboard Controls for Volume (Enhancement: Add Visual Feedback)
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
        volumeUp();
    } else if (event.key === 'ArrowDown') {
        volumeDown();
    }
});

// Initialize Draggable Remote Control and Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Generate Volume Bars Dynamically
    const volumeBarsContainer = document.querySelector('.volume-bars');
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.classList.add('volume-bar');
        volumeBarsContainer.appendChild(bar);
    }

    // Load volume from localStorage if available
    const savedVolume = localStorage.getItem('volumeLevel');
    if (savedVolume !== null) {
        currentVolume = parseInt(savedVolume, 10);
        if (currentVolume < 0) currentVolume = 0;
        if (currentVolume > 100) currentVolume = 100;
        console.log(`Loaded saved volume: ${currentVolume}%`);
    }
    updateVolumeOverlay();

    // Attach event listeners to remote buttons
    const previousChannelBtn = document.getElementById('previous-channel');
    const nextChannelBtn = document.getElementById('next-channel');
    const volumeUpBtn = document.getElementById('volume-up');
    const volumeDownBtn = document.getElementById('volume-down');
    const retroModeBtn = document.getElementById('retro-mode');
    const toggleRemoteBtn = document.getElementById('toggle-remote');
    const guideButton = document.getElementById('hide-guide');

    if (previousChannelBtn) {
        previousChannelBtn.addEventListener('click', () => {
            changeChannel(currentChannelIndex - 1);
            playButtonSound(); // Play sound effect
        });
    } else {
        console.error('Previous Channel button not found.');
    }

    if (nextChannelBtn) {
        nextChannelBtn.addEventListener('click', () => {
            changeChannel(currentChannelIndex + 1);
            playButtonSound(); // Play sound effect
        });
    } else {
        console.error('Next Channel button not found.');
    }

    if (volumeUpBtn) {
        volumeUpBtn.addEventListener('click', () => {
            volumeUp();
        });
    } else {
        console.error('Volume Up button not found.');
    }

    if (volumeDownBtn) {
        volumeDownBtn.addEventListener('click', () => {
            volumeDown();
        });
    } else {
        console.error('Volume Down button not found.');
    }

    if (retroModeBtn) {
        retroModeBtn.addEventListener('click', () => {
            toggleRetroMode();
        });
    } else {
        console.error('Retro Mode button not found.');
    }

    if (guideButton) {
        guideButton.addEventListener('click', () => {
            if (tvGuidePanelVisible) { 
                hideTVGuidePanel();
            } else {
                showTVGuidePanel();
            }
            playButtonSound(); // Play sound effect
        });
    } else {
        console.error('Guide button not found.');
    }

    if (toggleRemoteBtn) {
        toggleRemoteBtn.addEventListener('click', () => {
            toggleRemote();
        });
    } else {
        console.error('Toggle Remote button not found.');
    }

    // Initialize Draggable Remote Control
    const remote = document.getElementById('remote-control');
    const dragHandle = document.getElementById('drag-handle');

    if (remote && dragHandle) {
        makeElementDraggable(remote, dragHandle);
    } else {
        console.error('Remote Control or Drag Handle not found in the DOM.');
    }

    // Setup auto-scroll pause on user interaction
    setupAutoScrollPauseOnInteraction();

    // Initialize Time Bar
    initializeTimeBar();
});
