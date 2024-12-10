// Global Variables
let player;
let liveVideos = [];
let currentChannelIndex = 0;
let isStaticPlaying = false; // Flag to track if static is playing
let playerReady = false; // Flag to track if player is ready
let videoInfoOverlayTimer; // Timer for hiding video info overlay
let tvGuidePanelVisible = false; // Declare tvGuidePanelVisible

// Auto-Scroll Variables
let autoScrollInterval;
let autoScrollPaused = false;
const scrollPauseDuration = 5000; // 5 seconds pause after a full page scroll
const scrollStep = 1; // Pixels to scroll each step
const scrollDelay = 50; // Delay in ms between scroll steps

const popularCategories = ["Gaming", "Music", "News", "Sports", "Bitcoin"];

// Time Bar Variables
let timeUpdateInterval;

// Variables to track touch start and end positions
let touchStartY = 0;
let touchEndY = 0;

// Cached DOM Elements
const staticOverlay = document.querySelector('.static-overlay');
const videoInfoOverlay = document.querySelector('.video-info-overlay');
const channelNumberOverlay = document.getElementById('channel-number-overlay');
const errorOverlay = document.querySelector('.error-overlay');
const loadingIndicator = document.getElementById('loading-indicator');
const tvGuidePanel = document.querySelector('.tv-guide-panel');
const channelList = document.querySelector('.channel-list');
const categoryBar = document.querySelector('.category-bar');
const timeBar = document.querySelector('.time-bar');
let currentTimeElement = document.querySelector('.current-time'); // Changed to let

// Audio Elements
const staticSound = document.getElementById('static-sound');
const buttonSound = document.getElementById('button-sound');

// YouTube IFrame API Loader
function loadYouTubeIFrameAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Initialize YouTube Player
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
    // Set initial volume (handled by system/browser volume)
    player.setVolume(100); // Set to max to respect system volume
    // Load live videos after player is ready
    loadLiveVideos();
    // Unmute on user interaction
    document.body.addEventListener('click', () => {
        player.unMute();
        console.log('User interaction detected. Player unmuted.');
    }, { once: true });
}

// Event: YouTube Player Error
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    showError('An error occurred with the YouTube Player. Please try again later.');
}

// Helper Function: Check if a String is English
const isEnglish = (text) => {
    // Basic heuristic: Check if the text has mostly ASCII characters
    const asciiChars = text.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters
    const asciiRatio = asciiChars.length / text.length;

    // Consider the text English if more than 70% of its characters are ASCII
    return asciiRatio > 0.7;
};

// Load Live Videos
const loadLiveVideos = async (query = '') => {
    try {
        showLoadingIndicator(); // Show loading animation
        const apiKey = 'AIzaSyDwaRzqtYemR2HpJGYX50suDM30wL1RPaU'; // Replace with your secure method of handling API keys
        const maxResults = 50;
        const uniqueChannels = new Set();
        let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&eventType=live&type=video&regionCode=US&maxResults=${maxResults}&relevanceLanguage=en&key=${apiKey}`;

        // Add query term if provided
        if (query) {
            apiUrl += `&q=${encodeURIComponent(query)}`;
        }

        // Fetch data from the API
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`YouTube API Error: ${error.error.message}`);
        }
        const data = await response.json();

        // Parse the results
        liveVideos = []; // Clear current video list
        for (const item of data.items) {
            const { videoId } = item.id;
            const { channelTitle: channelName, title: videoTitle } = item.snippet;

            // Add only unique channels
            if (!uniqueChannels.has(channelName)) {
                liveVideos.push({
                    videoId,
                    channel: channelName,
                    title: videoTitle,
                });
                uniqueChannels.add(channelName);
            }
        }

        // Handle no results
        if (liveVideos.length === 0) {
            showError('No live videos found for this query.');
        } else {
            console.log(`Fetched ${liveVideos.length} live videos.`);
            populateChannelList(liveVideos); // Update the channel list
            // Automatically select and play the first video
            changeChannel(0);
        }
    } catch (error) {
        console.error('Error fetching live videos:', error);
        showError('Failed to fetch live videos. Please try again later.');
    } finally {
        hideLoadingIndicator(); // Hide loading animation
    }
};

// Change Channel by Index
const changeChannel = (index) => {
    if (liveVideos.length === 0) {
        console.warn('No live videos available to change channel.');
        return;
    }
    currentChannelIndex = (index + liveVideos.length) % liveVideos.length;
    const { videoId, channel, title } = liveVideos[currentChannelIndex];
    console.log(`Changing to video ID: ${videoId}`);

    // Display Static Overlay and Play Static Sound
    showStaticOverlay();
    playStaticSound();

    // Display Video Info Overlay
    showVideoInfoOverlay(channel, title);

    // Update TV Guide Panel Selection
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
};

// Show Static Overlay
const showStaticOverlay = () => {
    if (staticOverlay) {
        staticOverlay.style.display = 'block';
        console.log('Static overlay shown.');
    }
};

// Hide Static Overlay
const hideStaticOverlay = () => {
    if (staticOverlay) {
        staticOverlay.style.display = 'none';
        console.log('Static overlay hidden.');
    }
};

// Play Static Sound
const playStaticSound = () => {
    if (staticSound) {
        staticSound.currentTime = 0; // Reset to start
        staticSound.play().catch(error => {
            console.error('Error playing static sound:', error);
        });
        isStaticPlaying = true;
        console.log('Static sound playing.');
    }
};

// Stop Static Sound
const stopStaticSound = () => {
    if (staticSound && isStaticPlaying) {
        staticSound.pause();
        staticSound.currentTime = 0; // Reset to start for next play
        isStaticPlaying = false;
        console.log('Static sound stopped.');
    }
};

// Show Video Info Overlay and Hide After Delay
const showVideoInfoOverlay = (channelName, videoTitle) => {
    if (videoInfoOverlay) {
        const channelNameElem = videoInfoOverlay.querySelector('.channel-name');
        const videoTitleElem = videoInfoOverlay.querySelector('.video-title');

        // Update the text content
        if (channelNameElem) channelNameElem.textContent = channelName;
        if (videoTitleElem) videoTitleElem.textContent = videoTitle;

        // Make the overlay visible
        videoInfoOverlay.classList.add('visible');
        console.log('Video info overlay shown.');

        // Reset the hide timer
        resetVideoInfoOverlayTimer();
    }
};

// Hide Video Info Overlay
const hideVideoInfoOverlay = () => {
    if (videoInfoOverlay) {
        videoInfoOverlay.classList.remove('visible');
        console.log('Video info overlay hidden.');
    }
};

// Reset Video Info Overlay Timer
const resetVideoInfoOverlayTimer = () => {
    // Clear existing timer if any
    if (videoInfoOverlayTimer) {
        clearTimeout(videoInfoOverlayTimer);
    }

    // Set a new timer to hide the overlay after 7 seconds
    videoInfoOverlayTimer = setTimeout(() => {
        hideVideoInfoOverlay();
    }, 7000); // 7000 milliseconds = 7 seconds
};

// Populate TV Guide Panel with Channel Listings
const populateTVGuidePanel = () => {
    if (channelList) {
        channelList.innerHTML = ''; // Clear existing entries

        liveVideos.forEach((video, index) => {
            const channelEntry = createChannelEntry(video, index);
            channelList.appendChild(channelEntry);
        });

        // Show TV Guide Panel (if not already visible)
        showTVGuidePanel();
        console.log('TV Guide Panel populated.');
    }
};

// Create a Channel Entry Element
const createChannelEntry = (video, index) => {
    const channelEntry = document.createElement('div');
    channelEntry.classList.add('channel-entry');
    channelEntry.setAttribute('data-channel-index', index);
    channelEntry.setAttribute('tabindex', '0'); // Make focusable

    // Add video details
    channelEntry.innerHTML = `
        <div class="channel-info">
            <span class="channel-number">${index + 1}</span>
            <span class="channel-name-list">${video.channel}</span>
        </div>
        <div class="video-title-box">
            <span class="current-program">${video.title}</span>
        </div>
    `;

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

    return channelEntry;
};

// Update TV Guide Panel Selection
const updateTVGuideSelection = () => {
    if (channelList) {
        const channelEntries = channelList.querySelectorAll('.channel-entry');
        channelEntries.forEach((entry, index) => {
            if (index === currentChannelIndex) {
                entry.classList.add('active');
            } else {
                entry.classList.remove('active');
            }
        });
        console.log('TV Guide Panel selection updated.');
    }
};

// Show TV Guide Panel and Start Auto-Scroll
const showTVGuidePanel = () => {
    if (tvGuidePanel) {
        tvGuidePanel.classList.add('visible');
        tvGuidePanelVisible = true;
        console.log('TV Guide Panel shown.');

        // Show Time Bar
        if (timeBar) {
            timeBar.classList.remove('hidden');
        }

        // Start auto-scroll if not already started
        if (!autoScrollInterval) {
            startAutoScroll();
        }
    }
};

// Hide TV Guide Panel and Stop Auto-Scroll
const hideTVGuidePanel = () => {
    if (tvGuidePanel) {
        tvGuidePanel.classList.remove('visible');
        tvGuidePanelVisible = false;
        console.log('TV Guide Panel hidden.');

        // Hide Time Bar
        if (timeBar) {
            timeBar.classList.add('hidden');
        }

        // Stop auto-scroll
        stopAutoScroll();
    }
};

// Show Loading Indicator
const showLoadingIndicator = () => {
    if (loadingIndicator) {
        loadingIndicator.classList.add('visible');
        console.log('Loading indicator shown.');
    }
};

// Hide Loading Indicator
const hideLoadingIndicator = () => {
    if (loadingIndicator) {
        loadingIndicator.classList.remove('visible');
        console.log('Loading indicator hidden.');
    }
};

// Show Channel Number Overlay
const showChannelNumberOverlay = (channelNumber) => {
    if (channelNumberOverlay) {
        // Set the channel number text
        channelNumberOverlay.textContent = `${channelNumber}`;

        // Make the overlay visible
        channelNumberOverlay.classList.add('visible');
        console.log(`Channel number overlay shown: Channel ${channelNumber}`);

        // Hide the overlay after 7 seconds
        setTimeout(() => {
            channelNumberOverlay.classList.remove('visible');
            console.log('Channel number overlay hidden.');
        }, 7000); // 7000 milliseconds = 7 seconds
    } else {
        console.error('Channel Number Overlay element not found.');
    }
};

// Play Button Sound
const playButtonSound = () => {
    if (buttonSound) {
        buttonSound.currentTime = 0;
        buttonSound.play().catch(error => {
            console.error('Error playing button sound:', error);
        });
    }
};

// Drag-and-Drop Functionality
const makeElementDraggable = (draggableElement, handleElement) => {
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

    function dragEnd() {
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
};

// Toggle Retro Mode (Apply/Remove Retro Filter)
const toggleRetroMode = () => {
    const youtubePlayer = document.getElementById('youtube-player');
    if (youtubePlayer) {
        youtubePlayer.classList.toggle('retro-filter');
        console.log('Retro Mode toggled.');
        playButtonSound(); // Play sound effect
    } else {
        console.error('YouTube Player element not found.');
    }
};

// Toggle Remote Control Visibility
const toggleRemote = () => {
    const remote = document.querySelector('.remote');
    const toggleButton = document.getElementById('toggle-remote');
    if (remote && toggleButton) {
        remote.classList.toggle('hidden');
        if (remote.classList.contains('hidden')) {
            toggleButton.textContent = 'Show Remote';
            console.log('Remote controls hidden.');
        } else {
            toggleButton.textContent = 'Hide Remote';
            console.log('Remote controls shown.');
            playButtonSound(); // Play sound effect
        }
    } else {
        console.error('Remote or Toggle Remote button not found.');
    }
};

// Start Auto-Scroll
const startAutoScroll = () => {
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
};

// Pause Auto-Scroll
const pauseAutoScroll = () => {
    autoScrollPaused = true;
    console.log('Auto-scroll paused.');

    setTimeout(() => {
        autoScrollPaused = false;
        console.log('Auto-scroll resumed.');
    }, scrollPauseDuration);
};

// Stop Auto-Scroll
const stopAutoScroll = () => {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    autoScrollPaused = false;
    console.log('Auto-scroll stopped.');
};

// Setup Auto-Scroll Pause on User Interaction
const setupAutoScrollPauseOnInteraction = () => {
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
};

// Initialize Auto-Scroll System
const initializeAutoScroll = () => {
    setupAutoScrollPauseOnInteraction();
    startAutoScroll();
};

// Initialize Time Bar
const initializeTimeBar = () => {
    if (!timeBar) {
        console.error('Time Bar element not found.');
        return;
    }

    // Create a separate element for current time display if it doesn't exist
    if (!currentTimeElement) {
        currentTimeElement = document.createElement('div'); // Reassign using let
        currentTimeElement.classList.add('current-time');
        currentTimeElement.setAttribute('aria-label', 'Current Time');
        timeBar.appendChild(currentTimeElement);
    }

    // Generate initial time blocks and update current time
    generateTimeBlocks();

    // Update time blocks every second to keep them current
    timeUpdateInterval = setInterval(() => {
        generateTimeBlocks();
    }, 1000); // 1000 ms = 1 second
};

// Generate Time Blocks and Update Current Time
const generateTimeBlocks = () => {
    if (!timeBar || !currentTimeElement) return;

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

        timeBar.appendChild(timeBlock);
    }
};

// Show Custom Error Overlay
const showError = (message) => {
    if (errorOverlay) {
        errorOverlay.textContent = message;
        errorOverlay.classList.add('visible');
        setTimeout(() => {
            errorOverlay.classList.remove('visible');
        }, 5000); // Hide after 5 seconds
    } else {
        console.error('Error Overlay element not found.');
    }
};

// Populate Category Bar
const populateCategoryBar = () => {
    if (categoryBar) {
        categoryBar.innerHTML = ''; // Clear existing categories

        // Add an "All" or "Default" category for top live videos
        const defaultCategoryItem = createCategoryItem('All', '');
        categoryBar.appendChild(defaultCategoryItem);

        // Populate other categories
        popularCategories.forEach((category) => {
            const categoryItem = createCategoryItem(category, category);
            categoryBar.appendChild(categoryItem);
        });
    }
};

// Create a Category Item Element
const createCategoryItem = (name, category) => {
    const categoryItem = document.createElement('div');
    categoryItem.classList.add('category-item');
    categoryItem.textContent = name;
    categoryItem.setAttribute('data-category', category);

    // Add click event to filter channels by category
    categoryItem.addEventListener('click', async () => {
        setActiveCategory(categoryItem); // Highlight the active category
        await filterChannelsByCategory(category); // Perform the new query
    });

    return categoryItem;
};

// Filter Channels by Category
const filterChannelsByCategory = async (category) => {
    if (category) {
        console.log(`Fetching videos for category: ${category}`);
        await loadLiveVideos(category); // Perform a new query using the category as the search term
    } else {
        console.log("No category selected. Loading top live videos.");
        await loadLiveVideos(); // Load default top live videos
    }
};

// Set Active Category
const setActiveCategory = (activeItem) => {
    const categoryItems = categoryBar.querySelectorAll('.category-item');
    categoryItems.forEach((item) => item.classList.remove('active')); // Remove active state
    activeItem.classList.add('active'); // Add active state to the selected item
};

// Handle Touch Gestures for Channel Switching
const handleTouchStart = (event) => {
    // Get the Y-coordinate of the initial touch point
    touchStartY = event.touches[0].clientY;
};

const handleTouchEnd = (event) => {
    // Get the Y-coordinate of the final touch point
    touchEndY = event.changedTouches[0].clientY;

    // Calculate the swipe direction
    handleSwipeGesture();
};

const handleSwipeGesture = () => {
    const swipeThreshold = 50; // Minimum distance for a valid swipe

    // Check if the swipe distance is enough
    if (Math.abs(touchStartY - touchEndY) > swipeThreshold) {
        if (touchStartY > touchEndY) {
            // Swipe up detected
            console.log('Swipe up detected: Next Channel');
            changeChannel(currentChannelIndex + 1);
        } else {
            // Swipe down detected
            console.log('Swipe down detected: Previous Channel');
            changeChannel(currentChannelIndex - 1);
        }
    } else {
        console.log('Swipe not long enough to be considered valid.');
    }
};

// Keyboard Controls for Volume (Removed as per requirement)

// Initialize Draggable Remote Control
const initializeDraggableRemote = () => {
    const remote = document.getElementById('remote-control');
    const dragHandle = document.getElementById('drag-handle');

    if (remote && dragHandle) {
        makeElementDraggable(remote, dragHandle);
    } else {
        console.error('Remote Control or Drag Handle not found in the DOM.');
    }
};

// Event Listeners for Touch Gestures
const initializeTouchGestures = () => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
};

// Event Listeners for Keyboard Controls (Removed as volume is not controlled)

// Initialize the Application
const initializeApp = () => {
    // Attach event listeners to remote buttons (excluding volume buttons)

    const previousChannelBtn = document.getElementById('previous-channel');
    const nextChannelBtn = document.getElementById('next-channel');
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
    initializeDraggableRemote();

    // Populate the category bar and load default videos
    populateCategoryBar(); 
    filterChannelsByCategory(''); // Load default top live videos

    // Initialize Auto-Scroll System
    initializeAutoScroll();

    // Initialize Time Bar
    initializeTimeBar();

    // Initialize Touch Gestures
    initializeTouchGestures();

    // Keyboard Controls for Volume (Removed)
};

// Populate Channel List
const populateChannelList = (videos) => {
    if (channelList) {
        channelList.innerHTML = ''; // Clear existing entries

        videos.forEach((video, index) => {
            const channelEntry = createChannelEntry(video, index);
            channelList.appendChild(channelEntry);
        });

        // Update TV Guide Panel Selection
        updateTVGuideSelection();
    }
};

// Load YouTube IFrame API and Initialize App on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    loadYouTubeIFrameAPI();
    initializeApp();
});
