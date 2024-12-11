// Encapsulate the entire script to prevent global scope pollution
const app = (() => {
    // Global Variables
    let player,
        videosList = [],
        currentChannelIndex = 0,
        isStaticPlaying = false,
        playerReady = false,
        videoInfoOverlayTimer,
        tvGuidePanelVisible = false,
        autoScrollInterval,
        autoScrollPaused = false;
    const scrollPauseDuration = 5000,
        scrollStep = 1,
        scrollDelay = 50;
    const popularCategories = ["College Football 25", "Donald Trump", "Liberal Meltdown", "Las Vegas Raiders", "Kids Christmas Ideas", "US News", "Sports", "Bitcoin"];
    let timeUpdateInterval,
        touchStartY = 0,
        touchEndY = 0;

    // Cached DOM Elements
    const staticOverlay = document.querySelector('.static-overlay'),
        videoInfoOverlay = document.querySelector('.video-info-overlay'),
        channelNumberOverlay = document.getElementById('channel-number-overlay'),
        errorOverlay = document.querySelector('.error-overlay'),
        loadingIndicator = document.getElementById('loading-indicator'),
        tvGuidePanel = document.querySelector('.tv-guide-panel'),
        channelList = document.querySelector('.channel-list'),
        categoryBar = document.querySelector('.category-bar'),
        timeBar = document.querySelector('.time-bar'),
        staticSound = document.getElementById('static-sound'),
        buttonSound = document.getElementById('button-sound');

    // Subscriber Count Overlay Element
    const subscriberOverlay = document.createElement('div');
    subscriberOverlay.classList.add('subscriber-overlay');
    subscriberOverlay.setAttribute('aria-label', 'Subscriber Count');
    document.body.appendChild(subscriberOverlay);

    // Upload Date Overlay
    const uploadDateOverlay = (() => {
        const overlay = document.createElement('div');
        overlay.classList.add('upload-date-overlay');
        overlay.setAttribute('aria-label', 'Upload Date');
        document.body.appendChild(overlay);
        return overlay;
    })();

    // Time Elements
    let currentTimeElement = document.querySelector('.current-time') || (() => {
        const elem = document.createElement('div');
        elem.classList.add('current-time');
        elem.setAttribute('aria-label', 'Current Time');
        timeBar.appendChild(elem);
        return elem;
    })();

    // YouTube IFrame API Loader and Player Initialization
    const loadYouTubeIFrameAPI = () => {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
    };

    const onYouTubeIframeAPIReady = () => {
        player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: '',
            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0,
                iv_load_policy: 3,
                fs: 0,
                disablekb: 1,
                autoplay: 1,
                mute: 1
            },
            events: {
                onReady: onPlayerReady,
                onError: onPlayerError,
                onStateChange: onPlayerStateChange
            }
        });
    };

    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

    // Player Event Handlers
    const onPlayerReady = () => {
        playerReady = true;
        console.log('YouTube Player is ready.');
        player.setVolume(100);
        loadLiveAndStandardVideos();
        document.body.addEventListener('click', handleUserInteraction, { once: true });
    };

    const handleUserInteraction = () => {
        if (player && player.isMuted()) {
            player.unMute();
            console.log('User interaction detected. Player unmuted.');
        }
    };

    const onPlayerError = (event) => {
        console.error('YouTube Player Error:', event.data);
        showError('An error occurred with the YouTube Player. Skipping to the next video.');
        skipToNextVideo();
    };

    const onPlayerStateChange = (event) => {
        if (event.data === YT.PlayerState.ENDED) {
            console.log('Video ended. Skipping to next video.');
            skipToNextVideo();
        }
    };

    // Utility Functions
    const isEnglish = (text) => (text.replace(/[^\x00-\x7F]/g, '').length / text.length) > 0.7;

    const fetchJSON = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`YouTube API Error: ${error.error.message}`);
        }
        return response.json();
    };

    // Load Live and Standard Videos with Enhanced Language Filtering
    const loadLiveAndStandardVideos = async (query = '') => {
        try {
            showLoadingIndicator();
            
            // ⚠️ IMPORTANT: Replace with your secure method of handling API keys
            const apiKey = 'AIzaSyDOxYDTKmc_-SHUUcf9pbSirhgzou3SZb8'; 
            const maxResults = 25;
            
            // Calculate the date one week ago
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 1); // Subtract 7 days
            const publishedAfter = oneWeekAgo.toISOString();

            // Function to build the YouTube API URL based on video type
            const buildUrl = (type, additionalParams = '') => {
                const base = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=medium&regionCode=US&maxResults=${maxResults}&relevanceLanguage=en&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${apiKey}`;
                const eventType = type === 'live' ? `&eventType=live` : `&order=viewCount`;
                const queryParam = query ? `&q=${encodeURIComponent(query)}` : '';
                return `${base}${eventType}${queryParam}${additionalParams}`;
            };

            // Fetch live and standard videos concurrently
            const [liveData, standardData] = await Promise.all([
                fetchJSON(buildUrl('live')),
                fetchJSON(buildUrl('standard'))
            ]);

            // Map live videos to a structured format
            const liveVideos = liveData.items.map(({ id: { videoId }, snippet: { channelId, channelTitle, title, publishedAt } }) => ({
                videoId,
                channel: channelTitle,
                channelId,
                title,
                type: 'live',
                scheduledStartTime: null,
                scheduledEndTime: null,
                publishedAt
            }));

            // Filter out live videos from standard videos to avoid duplicates
            const standardVideos = standardData.items
                .filter(item => !liveVideos.some(video => video.videoId === item.id.videoId))
                .map(({ id: { videoId }, snippet: { channelId, channelTitle, title, publishedAt } }) => ({
                    videoId,
                    channel: channelTitle,
                    channelId,
                    title,
                    type: 'standard',
                    publishedAt
                }));

            // Combine live and standard videos
            let combinedVideos = [...liveVideos, ...standardVideos];

            // Sort combinedVideos:
            // 1. Live videos first
            // 2. Within each type, sort by publishedAt in descending order (newest first)
            combinedVideos.sort((a, b) => {
                if (a.type === 'live' && b.type !== 'live') return -1;
                if (a.type !== 'live' && b.type === 'live') return 1;
                // Both are either 'live' or 'standard', sort by publishedAt descending
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            });

            // Fetch additional details for live videos
            const liveVideoIds = combinedVideos
                .filter(v => v.type === 'live')
                .map(v => v.videoId)
                .join(',');

            if (liveVideoIds) {
                const videosListData = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${liveVideoIds}&key=${apiKey}`);
                videosListData.items.forEach(({ id: videoId, liveStreamingDetails }) => {
                    const video = combinedVideos.find(v => v.videoId === videoId && v.type === 'live');
                    if (video && liveStreamingDetails) {
                        video.scheduledStartTime = liveStreamingDetails.scheduledStartTime;
                        video.scheduledEndTime = liveStreamingDetails.scheduledEndTime;
                    }
                });
            }

            // Fetch channel languages to ensure videos are in English
            const uniqueChannelIds = [...new Set(combinedVideos.map(v => v.channelId))];
            const channelLanguages = await fetchChannelLanguages(uniqueChannelIds, apiKey);

            // Filter videos based on English language and title content
            combinedVideos = combinedVideos.filter(v => channelLanguages[v.channelId] === 'en' && isEnglish(v.title));

            if (combinedVideos.length === 0) {
                showError('No live or standard English videos found for this query.');
            } else {
                console.log(`Fetched ${combinedVideos.length} live and standard English videos.`);
                populateChannelList(combinedVideos);
                changeChannel(0);
            }

            videosList = combinedVideos;
        } catch (error) {
            console.error('Error fetching live and standard videos:', error);
            showError('Failed to fetch videos. Please try again later.');
        } finally {
            hideLoadingIndicator();
        }
    };


    // Fetch Channel Languages
    const fetchChannelLanguages = async (channelIds, apiKey) => {
        const channelLanguageMap = {};
        const batchSize = 50;
        for (let i = 0; i < channelIds.length; i += batchSize) {
            const batchIds = channelIds.slice(i, i + batchSize).join(',');
            try {
                const data = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${batchIds}&key=${apiKey}`);
                data.items.forEach(({ id, snippet: { defaultLanguage } }) => {
                    channelLanguageMap[id] = defaultLanguage || 'en';
                });
            } catch {
                channelIds.slice(i, i + batchSize).forEach(id => channelLanguageMap[id] = 'en');
            }
        }
        return channelLanguageMap;
    };

    // Change Channel by Index
    const changeChannel = async (index) => {
        if (!videosList.length) return console.warn('No live or standard videos available to change channel.');

        currentChannelIndex = (index + videosList.length) % videosList.length;
        const video = videosList[currentChannelIndex];

        if (!video.videoId) {
            console.error('Invalid videoId:', video);
            skipToNextVideo();
            return;
        }

        const { videoId, channel, title, type, channelId, publishedAt } = video;
        console.log(`Changing to video ID: ${videoId} (${type})`);

        showStaticOverlay();
        playStaticSound();
        showVideoInfoOverlay(channel, title);
        updateTVGuideSelection();
        showChannelNumberOverlay(currentChannelIndex + 1);
        await fetchAndDisplaySubscriberCount(channelId);
        displayUploadDate(publishedAt);

        setTimeout(() => {
            hideStaticOverlay();
            player.loadVideoById({
                videoId,
                startSeconds: type === 'standard' ? Math.floor(Math.random() * 46) + 45 : 0,
                suggestedQuality: 'hd1080'
            });
            type === 'standard' ? addRestartButton() : removeRestartButton();
            type === 'live' && removeRestartButton();
            stopStaticSound();
        }, 500);
    };

    // Skip to Next Available Video
    const skipToNextVideo = () => changeChannel(currentChannelIndex + 1);

    // Overlay Functions
    const toggleOverlay = (element, show) => {
        if (element) element.style.display = show ? 'block' : 'none';
    };

    const showStaticOverlay = () => toggleOverlay(staticOverlay, true);
    const hideStaticOverlay = () => toggleOverlay(staticOverlay, false);

    const playStaticSound = () => {
        if (staticSound) {
            staticSound.currentTime = 0;
            staticSound.play().catch(console.error);
            isStaticPlaying = true;
            console.log('Static sound playing.');
        }
    };

    const stopStaticSound = () => {
        if (staticSound && isStaticPlaying) {
            staticSound.pause();
            staticSound.currentTime = 0;
            isStaticPlaying = false;
            console.log('Static sound stopped.');
        }
    };

    const showVideoInfoOverlay = (channelName, videoTitle) => {
        if (videoInfoOverlay) {
            const channelNameElem = videoInfoOverlay.querySelector('.channel-name');
            const videoTitleElem = videoInfoOverlay.querySelector('.video-title');

            if (channelNameElem) channelNameElem.textContent = channelName;
            if (videoTitleElem) videoTitleElem.textContent = videoTitle;

            videoInfoOverlay.classList.add('visible');
            resetVideoInfoOverlayTimer();
            console.log('Video info overlay shown.');
        }
    };

    const hideVideoInfoOverlay = () => {
        if (videoInfoOverlay) {
            videoInfoOverlay.classList.remove('visible');
            console.log('Video info overlay hidden.');
        }
    };

    const resetVideoInfoOverlayTimer = () => {
        clearTimeout(videoInfoOverlayTimer);
        videoInfoOverlayTimer = setTimeout(hideVideoInfoOverlay, 7000);
    };

    const showChannelNumberOverlay = (number) => {
        if (channelNumberOverlay) {
            channelNumberOverlay.textContent = `${number}`;
            channelNumberOverlay.classList.add('visible');
            setTimeout(() => channelNumberOverlay.classList.remove('visible'), 7000);
            console.log(`Channel number overlay shown: Channel ${number}`);
        }
    };

    const showError = (message) => {
        if (errorOverlay) {
            errorOverlay.textContent = message;
            errorOverlay.classList.add('visible');
            setTimeout(() => errorOverlay.classList.remove('visible'), 5000);
        } else {
            console.error('Error Overlay element not found.');
        }
    };

    // Populate TV Guide Panel
    const populateChannelList = (videos) => {
        if (channelList) {
            channelList.innerHTML = '';
            videos.forEach((video, index) => channelList.appendChild(createChannelEntry(video, index)));
            updateTVGuideSelection();
        }
    };

    const createChannelEntry = (video, index) => {
        const { type, channel, title, scheduledStartTime, scheduledEndTime } = video;
        const isLive = type === 'live';
        const duration = isLive && scheduledStartTime && scheduledEndTime ?
            `${new Date(scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(scheduledEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
            '';

        const channelEntry = document.createElement('div');
        channelEntry.classList.add('channel-entry');
        if (isLive) channelEntry.classList.add('live');
        channelEntry.setAttribute('data-channel-index', index);
        channelEntry.setAttribute('tabindex', '0');
        channelEntry.innerHTML = `
            <div class="channel-info">
                <span class="channel-number">${index + 1}</span>
                <span class="channel-name-list">${channel}</span>
            </div>
            <div class="video-title-box">
                <span class="current-program">${title}</span>
                ${isLive && duration ? `<span class="video-duration">${duration}</span>` : ''}
                ${!isLive ? `<button class="restart-button hidden" aria-label="Restart Video">⟲</button>` : ''}
            </div>
        `;

        channelEntry.addEventListener('click', () => changeChannel(index));
        channelEntry.addEventListener('keypress', (e) => (e.key === 'Enter' || e.key === ' ') && changeChannel(index));
        return channelEntry;
    };

    const updateTVGuideSelection = () => {
        if (channelList) {
            channelList.querySelectorAll('.channel-entry').forEach((entry, idx) => {
                entry.classList.toggle('active', idx === currentChannelIndex);
            });
            console.log('TV Guide Panel selection updated.');
        }
    };

    // TV Guide Panel Visibility
    const toggleTVGuidePanel = (show) => {
        if (tvGuidePanel) {
            tvGuidePanel.classList.toggle('visible', show);
            tvGuidePanelVisible = show;
            if (timeBar) timeBar.classList.toggle('hidden', !show);
            show ? startAutoScroll() : stopAutoScroll();
            console.log(`TV Guide Panel ${show ? 'shown' : 'hidden'}.`);
        }
    };

    const showTVGuidePanel = () => toggleTVGuidePanel(true);
    const hideTVGuidePanel = () => toggleTVGuidePanel(false);

    // Loading Indicator
    const toggleLoadingIndicator = (show) => {
        if (loadingIndicator) {
            loadingIndicator.classList.toggle('visible', show);
            console.log(`Loading indicator ${show ? 'shown' : 'hidden'}.`);
        }
    };

    const showLoadingIndicator = () => toggleLoadingIndicator(true);
    const hideLoadingIndicator = () => toggleLoadingIndicator(false);

    // Sound Effects
    const playButtonSound = () => {
        if (buttonSound) {
            buttonSound.currentTime = 0;
            buttonSound.play().catch(console.error);
        }
    };

    // Draggable Functionality
    const makeElementDraggable = (element, handle) => {
        let isDragging = false,
            startX,
            startY,
            initialX,
            initialY;

        const savedPosition = JSON.parse(localStorage.getItem('remotePosition'));
        if (savedPosition) {
            Object.assign(element.style, { left: savedPosition.left, top: savedPosition.top, position: 'fixed' });
        }

        const dragStart = (e) => {
            e.preventDefault();
            isDragging = true;
            element.classList.add('active');
            [startX, startY] = e.type.startsWith('touch') ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            console.log('Drag started.');
        };

        const dragging = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const [currentX, currentY] = e.type.startsWith('touch') ?
                [e.touches[0].clientX, e.touches[0].clientY] :
                [e.clientX, e.clientY];
            let newX = initialX + (currentX - startX);
            let newY = initialY + (currentY - startY);
            const { innerWidth: winW, innerHeight: winH } = window;
            newX = Math.max(0, Math.min(newX, winW - element.offsetWidth));
            newY = Math.max(0, Math.min(newY, winH - element.offsetHeight));
            Object.assign(element.style, { left: `${newX}px`, top: `${newY}px`, position: 'fixed' });
        };

        const dragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            element.classList.remove('active');
            localStorage.setItem('remotePosition', JSON.stringify({ left: element.style.left, top: element.style.top }));
            console.log('Drag ended.');
        };

        handle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragging);
        document.addEventListener('mouseup', dragEnd);
        handle.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', dragging, { passive: false });
        document.addEventListener('touchend', dragEnd);
    };

    // Remote Control Toggle
    const toggleRemote = () => {
        const remote = document.querySelector('.remote'),
            toggleBtn = document.getElementById('toggle-remote');
        if (remote && toggleBtn) {
            const hidden = remote.classList.toggle('hidden');
            toggleBtn.textContent = hidden ? 'Show Remote' : 'Hide Remote';
            if (!hidden) playButtonSound();
            console.log(`Remote controls ${hidden ? 'hidden' : 'shown'}.`);
        } else {
            console.error('Remote or Toggle Remote button not found.');
        }
    };

// Retro Mode Toggle
const toggleRetroMode = () => {
    const youtubePlayer = document.getElementById('youtube-player');
    if (youtubePlayer) {
        youtubePlayer.classList.toggle('retro-filter');
        const isRetro = youtubePlayer.classList.contains('retro-filter');
        console.log(`Retro Mode ${isRetro ? 'Activated' : 'Deactivated'}`);
        playButtonSound();

        if (isRetro) {
            createScanlinesOverlay();
            showScanlines();
        } else {
            hideScanlines();
            // Optionally, remove the overlay after hiding
            // setTimeout(removeScanlines, 500); // Matches the transition duration
        }
    } else {
        console.error('YouTube Player element not found.');
    }
};


    // Auto-Scroll Functions
    const startAutoScroll = () => {
        if (!channelList || autoScrollInterval) return;
        autoScrollInterval = setInterval(() => {
            if (autoScrollPaused) return;
            if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 1) {
                channelList.scrollTop = 0;
                console.log('Reached the end of the list. Looping back to the top.');
                pauseAutoScroll();
                return;
            }
            channelList.scrollTop += scrollStep;
            if (channelList.scrollTop % channelList.clientHeight === 0) {
                console.log('Scrolled a full page. Pausing for 5 seconds.');
                pauseAutoScroll();
            }
        }, scrollDelay);
        console.log('Auto-scroll started.');
    };

    const pauseAutoScroll = () => {
        autoScrollPaused = true;
        console.log('Auto-scroll paused.');
        setTimeout(() => {
            autoScrollPaused = false;
            console.log('Auto-scroll resumed.');
        }, scrollPauseDuration);
    };

    const stopAutoScroll = () => {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
        autoScrollPaused = false;
        console.log('Auto-scroll stopped.');
    };

    const setupAutoScrollPauseOnInteraction = () => {
        if (!channelList) return;
        const pause = () => pauseAutoScroll();
        channelList.addEventListener('mouseenter', pause);
        channelList.addEventListener('touchstart', pause, { passive: false });
        channelList.addEventListener('mouseleave', () => setTimeout(() => { autoScrollPaused = false; }, scrollPauseDuration));
        channelList.addEventListener('touchend', () => setTimeout(() => { autoScrollPaused = false; }, scrollPauseDuration));
    };

    // Initialize Auto-Scroll System
    const initializeAutoScroll = () => {
        setupAutoScrollPauseOnInteraction();
        startAutoScroll();
    };

    // Time Bar Initialization
    const initializeTimeBar = () => {
        if (!timeBar) return console.error('Time Bar element not found.');
        generateTimeBlocks();
        timeUpdateInterval = setInterval(generateTimeBlocks, 1000);
    };

    const generateTimeBlocks = () => {
        const currentTime = new Date();
        const hours = currentTime.getHours(),
            minutes = currentTime.getMinutes(),
            seconds = currentTime.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12,
            displayMinutes = minutes < 10 ? `0${minutes}` : minutes,
            displaySeconds = seconds < 10 ? `0${seconds}` : seconds;
        currentTimeElement.textContent = `${displayHours}:${displayMinutes}:${displaySeconds} ${ampm}`;

        // Remove existing upcoming blocks
        timeBar.querySelectorAll('.time-block.upcoming').forEach(block => block.remove());

        // Generate upcoming blocks
        const numberOfBlocks = 3;
        const baseTime = new Date(currentTime);
        if (minutes >= 15 && minutes < 45) {
            baseTime.setMinutes(30);
        } else if (minutes >= 45) {
            baseTime.setHours(hours + 1);
            baseTime.setMinutes(0);
        } else { // minutes < 15
            baseTime.setMinutes(0);
        }
        baseTime.setSeconds(0);

        for (let i = 1; i <= numberOfBlocks; i++) {
            const blockTime = new Date(baseTime.getTime() + i * 30 * 60000);
            const blockHours = blockTime.getHours(),
                blockMinutes = blockTime.getMinutes();
            const blockAMPM = blockHours >= 12 ? 'PM' : 'AM';
            const displayBlockHours = blockHours % 12 || 12,
                displayBlockMinutes = blockMinutes < 10 ? `0${blockMinutes}` : blockMinutes;
            const timeBlockString = `${displayBlockHours}:${displayBlockMinutes} ${blockAMPM}`;

            const timeBlock = document.createElement('div');
            timeBlock.classList.add('time-block', 'upcoming');
            timeBlock.textContent = timeBlockString;
            timeBar.appendChild(timeBlock);
        }
    };

    // Category Bar Functions
    const populateCategoryBar = () => {
        if (!categoryBar) return;
        categoryBar.innerHTML = '';
        categoryBar.appendChild(createCategoryItem('All', ''));
        popularCategories.forEach(category => categoryBar.appendChild(createCategoryItem(category, category)));
    };

    const createCategoryItem = (name, category) => {
        const item = document.createElement('div');
        item.classList.add('category-item');
        item.textContent = name;
        item.dataset.category = category;
        item.addEventListener('click', () => {
            setActiveCategory(item);
            filterChannelsByCategory(category);
        });
        return item;
    };

    const setActiveCategory = (activeItem) => {
        categoryBar.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
        activeItem.classList.add('active');
    };

    const filterChannelsByCategory = async (category) => {
        if (category) {
            console.log(`Fetching videos for category: ${category}`);
            await loadLiveAndStandardVideos(category);
        } else {
            console.log("No category selected. Loading top live and standard videos.");
            await loadLiveAndStandardVideos();
        }
    };

    // Touch Gestures for Channel Switching
    const handleTouchStart = (e) => touchStartY = e.touches[0].clientY;
    const handleTouchEnd = (e) => { touchEndY = e.changedTouches[0].clientY; handleSwipeGesture(); };
    const handleSwipeGesture = () => {
        const swipeThreshold = 50;
        const delta = touchStartY - touchEndY;
        if (Math.abs(delta) > swipeThreshold) {
            changeChannel(delta > 0 ? currentChannelIndex + 1 : currentChannelIndex - 1);
            console.log(`Swipe ${delta > 0 ? 'up' : 'down'} detected: ${delta > 0 ? 'Next' : 'Previous'} Channel`);
        } else {
            console.log('Swipe not long enough to be considered valid.');
        }
    };

    // Restart Button for Standard Videos
    const addRestartButton = () => {
        if (document.querySelector('.restart-button')) return; // Prevent multiple buttons
        const restartButton = document.createElement('button');
        restartButton.classList.add('restart-button');
        restartButton.textContent = '⟲';
        restartButton.setAttribute('aria-label', 'Restart Video');
        Object.assign(restartButton.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px',
            background: 'rgba(0, 0, 0, 0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '18px',
            zIndex: '10'
        });
        const youtubePlayer = document.getElementById('youtube-player');
        if (youtubePlayer) {
            youtubePlayer.style.position = 'relative'; // Ensure positioning context
            restartButton.addEventListener('click', () => {
                player.seekTo(0);
                console.log('Video restarted.');
            });
            youtubePlayer.appendChild(restartButton);
        } else {
            console.error('YouTube Player element not found for adding restart button.');
        }
    };

    const removeRestartButton = () => {
        const restartButton = document.querySelector('.restart-button');
        if (restartButton) {
            restartButton.remove();
            console.log('Restart button removed.');
        }
    };

    // Subscriber Count
    const fetchAndDisplaySubscriberCount = async (channelId) => {
        try {
            const apiKey = 'AIzaSyDOxYDTKmc_-SHUUcf9pbSirhgzou3SZb8'; // ⚠️ Replace with your secure method of handling API keys
            const data = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`);
            const subscriberCount = data.items[0]?.statistics?.subscriberCount;
            subscriberOverlay.textContent = `Subscribers: ${subscriberCount ? Number(subscriberCount).toLocaleString() : 'N/A'}`;
            subscriberOverlay.classList.add('visible');
        } catch {
            subscriberOverlay.textContent = 'Subscribers: N/A';
            subscriberOverlay.classList.add('visible');
        }
    };

    // Upload Date Display
    const displayUploadDate = (publishedAt) => {
        const date = new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        uploadDateOverlay.textContent = `Uploaded on: ${date}`;
        uploadDateOverlay.classList.add('visible');
        setTimeout(() => uploadDateOverlay.classList.remove('visible'), 7000);
    };

    // Remote Control Initialization
    const initializeDraggableRemote = () => {
        const remote = document.getElementById('remote-control'),
            handle = document.getElementById('drag-handle');
        if (remote && handle) makeElementDraggable(remote, handle);
        else console.error('Remote Control or Drag Handle not found in the DOM.');
    };


    // Function to create the scanlines overlay
const createScanlinesOverlay = () => {
    // Check if the overlay already exists to prevent duplicates
    if (document.querySelector('.scanlines-overlay')) return;

    // Create the overlay div
    const scanlinesOverlay = document.createElement('div');
    scanlinesOverlay.classList.add('scanlines-overlay');

    // Style the overlay using CSS
    Object.assign(scanlinesOverlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Allow interactions with the video
        background: 'repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 3px)',
        zIndex: '5', // Ensure it's above the video but below other overlays
        opacity: '1', // Start visible
        transition: 'opacity 0.5s ease' // Smooth transition
    });

    // Append the overlay to the YouTube player
    const youtubePlayer = document.getElementById('youtube-player');
    if (youtubePlayer) {
        // Ensure the YouTube player has a positioning context
        youtubePlayer.style.position = 'relative';
        youtubePlayer.appendChild(scanlinesOverlay);
    } else {
        console.error('YouTube Player element not found.');
    }
};


// Function to show the scanlines overlay
const showScanlines = () => {
    const scanlinesOverlay = document.querySelector('.scanlines-overlay');
    if (scanlinesOverlay) {
        scanlinesOverlay.style.opacity = '1';
    }
};

// Function to hide the scanlines overlay
const hideScanlines = () => {
    const scanlinesOverlay = document.querySelector('.scanlines-overlay');
    if (scanlinesOverlay) {
        scanlinesOverlay.style.opacity = '0';
    }
};

// Function to remove the scanlines overlay entirely (optional)
const removeScanlines = () => {
    const scanlinesOverlay = document.querySelector('.scanlines-overlay');
    if (scanlinesOverlay) {
        scanlinesOverlay.remove();
    }
};


    // Event Listeners Initialization
    const initializeApp = () => {
        const controls = {
            previous: document.getElementById('previous-channel'),
            next: document.getElementById('next-channel'),
            retro: document.getElementById('retro-mode'),
            toggleRemote: document.getElementById('toggle-remote'),
            guide: document.getElementById('hide-guide')
        };

        // Previous Channel Button
        if (controls.previous) {
            controls.previous.addEventListener('click', () => {
                changeChannel(currentChannelIndex - 1);
                playButtonSound();
            });
        } else {
            console.error('Previous Channel button not found.');
        }

        // Next Channel Button
        if (controls.next) {
            controls.next.addEventListener('click', () => {
                changeChannel(currentChannelIndex + 1);
                playButtonSound();
            });
        } else {
            console.error('Next Channel button not found.');
        }

        // Retro Mode Button
        if (controls.retro) {
            controls.retro.addEventListener('click', toggleRetroMode);
        } else {
            console.error('Retro Mode button not found.');
        }

        // Guide Button
        if (controls.guide) {
            controls.guide.addEventListener('click', () => {
                toggleTVGuidePanel(!tvGuidePanelVisible);
                playButtonSound();
            });
        } else {
            console.error('Guide button not found.');
        }

        // Toggle Remote Button
        if (controls.toggleRemote) {
            controls.toggleRemote.addEventListener('click', toggleRemote);
        } else {
            console.error('Toggle Remote button not found.');
        }

        initializeDraggableRemote();
        populateCategoryBar();
        filterChannelsByCategory('');
        initializeAutoScroll();
        initializeTimeBar();
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
    };

    // Initialize the Application on DOM Content Loaded
    document.addEventListener('DOMContentLoaded', () => {
        loadYouTubeIFrameAPI();
        initializeApp();
    });

    // Return exposed functions if needed
    return { changeChannel };
})();
