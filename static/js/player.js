/* =========================================
   NOSTALGIC RADIO
   YOUTUBE MUSIC PLAYER
   ========================================= */

let youtubePlayer = null;
let youtubeReady = false;
let currentMode = null;

let progressAnimationFrame = null;

/* =========================================
   DYNAMIC WAVEFORM
   ========================================= */

let lastWaveformVideoId = null;
let waveformColorIndex = -1;

const waveformColors = [
    {
        main: "#ff7a18",
        light: "#ffd166",
        glow: "rgba(255, 100, 20, 0.90)"
    },
    {
        main: "#b44cff",
        light: "#ff6bd6",
        glow: "rgba(180, 60, 255, 0.90)"
    },
    {
        main: "#00d9ff",
        light: "#8b7cff",
        glow: "rgba(0, 210, 255, 0.90)"
    },
    {
        main: "#9cff00",
        light: "#eaff75",
        glow: "rgba(150, 255, 0, 0.90)"
    },
    {
        main: "#ff3f81",
        light: "#ff9ac8",
        glow: "rgba(255, 50, 120, 0.90)"
    },
    {
        main: "#39a7ff",
        light: "#a875ff",
        glow: "rgba(50, 150, 255, 0.90)"
    },
    {
        main: "#ffbd39",
        light: "#fff0a3",
        glow: "rgba(255, 180, 40, 0.90)"
    }
];
/* =========================================
   YOUTUBE API READY
   ========================================= */

function onYouTubeIframeAPIReady() {

    console.log("YouTube API is ready");

    youtubeReady = true;

    if (currentMode) {
        createYouTubePlayer(currentMode);
    }
}


/* =========================================
   REFERRER POLICY
   ========================================= */

function setupYouTubeReferrer() {

    let referrerMeta =
        document.querySelector(
            'meta[name="referrer"]'
        );

    if (!referrerMeta) {

        referrerMeta =
            document.createElement("meta");

        referrerMeta.name = "referrer";

        document.head.appendChild(
            referrerMeta
        );
    }

    referrerMeta.content =
        "strict-origin-when-cross-origin";

    console.log(
        "YouTube referrer policy configured."
    );
}


/* =========================================
   CHANGE MUSIC MODE
   ========================================= */

function changeMusicMode(mode) {

    if (!mode) {
        return;
    }

    currentMode = mode;

    console.log(
        "Selected mode:",
        mode.name
    );

    console.log(
        "Playlist:",
        mode.youtube_playlist_id
    );


    /* Stop progress */

    stopProgressUpdate();


    /* Destroy old player */

    if (youtubePlayer) {

        try {

            youtubePlayer.destroy();

        } catch (error) {

            console.warn(
                "Could not destroy old YouTube player:",
                error
            );
        }

        youtubePlayer = null;
    }


    /* Reset UI */

    resetPlayerUI();


    /* Check API */

    if (!youtubeReady) {

        console.log(
            "Waiting for YouTube API..."
        );

        return;
    }


    /* Create new player */

    createYouTubePlayer(mode);
}


/* =========================================
   CREATE YOUTUBE PLAYER
   ========================================= */

function createYouTubePlayer(mode) {

    if (!mode || !youtubeReady) {
        return;
    }


    const playlistId =
        mode.youtube_playlist_id;


    const testVideoId =
        mode.test_video_id || null;


    if (
        !testVideoId &&
        (
            !playlistId ||
            playlistId === "YOUR_PLAYLIST_ID"
        )
    ) {

        console.log(
            "No YouTube source configured for:",
            mode.name
        );

        resetPlayerUI();

        return;
    }


    console.log(
        "Creating YouTube player..."
    );


    /* Configure referrer */

    setupYouTubeReferrer();


    /* Find container */

    const playerContainer =
        document.getElementById(
            "youtube-player"
        );


    if (!playerContainer) {

        console.error(
            "YouTube player container not found."
        );

        return;
    }


    /*
       Clean old iframe/container.
    */

    playerContainer.innerHTML = "";


    /* =====================================
       PLAYER CONFIGURATION
       ===================================== */

    const playerOptions = {

        height: "200",

        width: "300",


        playerVars: {

            /*
               Do not autoplay.
               User presses our Play button.
            */

            autoplay: 0,


            /*
               Our own controls are used.
            */

            controls: 0,


            /*
               Do not show unrelated videos.
            */

            rel: 0,


            /*
               Mobile inline playback.
            */

            playsinline: 1,


            /*
               Identify our website origin.
            */

            
        },


        events: {

            onReady:
                handlePlayerReady,

            onStateChange:
                handlePlayerStateChange,

            onError:
                handlePlayerError
        }
    };


    /*
       TEST VIDEO MODE

       If test_video_id exists, load
       that exact video instead of playlist.
    */

    if (testVideoId) {

        playerOptions.videoId =
            testVideoId;

        console.log(
            "Testing single video:",
            testVideoId
        );
    }


    /*
       NORMAL PLAYLIST MODE

       Only add playlist parameters
       when test_video_id is not present.
    */

    else {

        playerOptions.playerVars.listType =
            "playlist";

        playerOptions.playerVars.list =
            playlistId;

        console.log(
            "Loading playlist:",
            playlistId
        );
    }


    /* =====================================
       CREATE PLAYER
       ===================================== */

    youtubePlayer =
        new YT.Player(
            "youtube-player",
            playerOptions
        );
}


/* =========================================
   PLAYER READY
   ========================================= */

function handlePlayerReady(event) {

    console.log(
        "YouTube player is ready"
    );


    /*
     * Configure actual iframe after
     * YouTube has created it.
     */

    try {

        const iframe =
            event.target.getIframe();

        if (iframe) {

            iframe.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin"
            );

            console.log(
                "YouTube iframe configured."
            );
        }

    } catch (error) {

        console.warn(
            "Could not configure YouTube iframe:",
            error
        );
    }


    /*
     * Update source immediately.
     */

    updateSongSource();


    /*
     * IMPORTANT:
     * Do NOT wait 500ms here.
     *
     * Update the current song and artwork
     * immediately when YouTube provides it.
     */

    updateCurrentSong();

    updateProgress();
}


/* =========================================
   PLAYER ERROR
   ========================================= */

function handlePlayerError(event) {

    console.error(
        "YouTube Player Error:",
        event.data
    );


    switch (event.data) {

        case 2:

            console.error(
                "YouTube Error 2: Invalid parameter."
            );

            break;


        case 5:

            console.error(
                "YouTube Error 5: HTML5 player error."
            );

            break;


        case 100:

            console.error(
                "YouTube Error 100: Video not found or removed."
            );

            console.warn(
                "Skipping unavailable song..."
            );

            skipToNextSong();

            break;


        case 101:

            console.error(
                "YouTube Error 101: Video owner does not allow embedding."
            );

            console.warn(
                "Skipping this song..."
            );

            skipToNextSong();

            break;


        case 150:

            console.error(
                "YouTube Error 150: Video owner does not allow embedding."
            );

            console.warn(
                "Skipping this song..."
            );

            skipToNextSong();

            break;


        case 153:

            console.error(
                "YouTube Error 153: Missing HTTP Referer."
            );

            break;


        default:

            console.error(
                "Unknown YouTube error:",
                event.data
            );
    }


    stopAlbumRotation();


    const playButton =
        document.getElementById(
            "play-button"
        );


    if (playButton) {

        playButton.textContent =
            "▶";
    }
}

function skipToNextSong() {

    if (!youtubePlayer) {
        console.warn(
            "YouTube player is not available."
        );
        return;
    }

    console.log(
        "Trying next song..."
    );

    setTimeout(function () {

        try {

            youtubePlayer.nextVideo();

        } catch (error) {

            console.error(
                "Could not skip to next song:",
                error
            );
        }

    }, 1000);
}


/* =========================================
   PLAYER STATE
   ========================================= */

function handlePlayerStateChange(event) {

    const albumArt =
        document.getElementById(
            "album-art"
        );


    const playButton =
        document.getElementById(
            "play-button"
        );

        const musicPlayer =
    document.querySelector(".music-player");
    /* =====================================
       PLAYING
       ===================================== */

    if (
        event.data ===
        YT.PlayerState.PLAYING
    ) {

        console.log(
            "YouTube: PLAYING"
        );


        if (albumArt) {

            albumArt.classList.add(
                "playing"
            );
        }
        if (musicPlayer) {
    musicPlayer.classList.add("playing");
}

        if (playButton) {

            playButton.textContent =
                "Ⅱ";
        }


        updateCurrentSong();

        startProgressUpdate();
    }


    /* =====================================
       PAUSED
       ===================================== */

    else if (
        event.data ===
        YT.PlayerState.PAUSED
    ) {

        console.log(
            "YouTube: PAUSED"
        );


        if (albumArt) {

            albumArt.classList.remove(
                "playing"
            );
        }

        if (musicPlayer) {
    musicPlayer.classList.remove("playing");
}
        if (playButton) {

            playButton.textContent =
                "▶";
        }


        stopProgressUpdate();
    }


    /* =====================================
       ENDED
       ===================================== */

    else if (
        event.data ===
        YT.PlayerState.ENDED
    ) {

        console.log(
            "YouTube: ENDED"
        );


        if (albumArt) {

            albumArt.classList.remove(
                "playing"
            );
        }
        if (musicPlayer) {
    musicPlayer.classList.remove("playing");
}
        
        if (playButton) {

            playButton.textContent =
                "▶";
        }


        stopProgressUpdate();
    }


    /* =====================================
       BUFFERING
       ===================================== */

    else if (
        event.data ===
        YT.PlayerState.BUFFERING
    ) {

        console.log(
            "YouTube: BUFFERING..."
        );
    }
}
/* =========================================
   WAVEFORM COLOR
   ========================================= */

function changeWaveformColor(videoId) {

    if (!videoId) {
        return;
    }

    /*
     * Same song:
     * Keep the same color.
     */

    if (lastWaveformVideoId === videoId) {
        return;
    }

    lastWaveformVideoId = videoId;

    /*
     * Move to the next color.
     */

    waveformColorIndex =
        (
            waveformColorIndex + 1
        ) % waveformColors.length;

    const color =
        waveformColors[waveformColorIndex];

    const musicPlayer =
        document.querySelector(
            ".music-player"
        );

    if (!musicPlayer) {
        return;
    }

    musicPlayer.style.setProperty(
        "--wave-main",
        color.main
    );

    musicPlayer.style.setProperty(
        "--wave-light",
        color.light
    );

    musicPlayer.style.setProperty(
        "--wave-glow",
        color.glow
    );

    console.log(
        "Waveform color changed:",
        color.main
    );
}

/* =========================================
   CURRENT SONG
   ========================================= */

function updateCurrentSong() {

    if (!youtubePlayer) {
        return;
    }


    let videoData = null;


    try {

        videoData =
            youtubePlayer.getVideoData();

    } catch (error) {

        console.warn(
            "Could not get YouTube video data:",
            error
        );

        return;
    }


    if (!videoData) {
        return;
    }


    const videoId =
        videoData.video_id;


    const title =
        videoData.title;


    /*
       Update song title.
    */

    const songTitle =
        document.getElementById(
            "song-title"
        );


    if (
        songTitle &&
        title
    ) {

        songTitle.textContent =
            title;
    }


    /*
       Update source.
    */

    updateSongSource();


    /*
       Update album art.
    */

    if (videoId) {

    updateAlbumImage(
        videoId
    );

    changeWaveformColor(
        videoId
    );
}
}


/* =========================================
   SONG SOURCE
   ========================================= */

function updateSongSource() {

    const songSource =
        document.getElementById(
            "song-source"
        );


    if (!songSource) {
        return;
    }


    if (currentMode) {

        songSource.textContent =
            `${currentMode.name} • YouTube Music`;

    } else {

        songSource.textContent =
            "YouTube Music";
    }
}


/* =========================================
   ALBUM ART
   ========================================= */

function updateAlbumImage(videoId) {

    const albumImage =
        document.getElementById(
            "album-image"
        );


    if (
        !albumImage ||
        !videoId
    ) {

        return;
    }


    /*
     * Automatically use YouTube
     * thumbnail.
     *
     * No manual cover image needed.
     */

    const thumbnail =
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;


    /*
     * If this is already the current artwork,
     * don't reload it again.
     */

    if (
        albumImage.dataset.videoId ===
        videoId
    ) {

        return;
    }


    /*
     * Remember current video.
     */

    albumImage.dataset.videoId =
        videoId;


    /*
     * Load new artwork immediately.
     */

    albumImage.src =
        thumbnail;


    albumImage.onerror =
        function () {

            console.error(
                "Could not load YouTube thumbnail:",
                thumbnail
            );


            albumImage.removeAttribute(
                "src"
            );


            albumImage.removeAttribute(
                "data-video-id"
            );

        };
}


/* =========================================
   PLAY / PAUSE
   ========================================= */

function togglePlayPause() {

    if (!youtubePlayer) {

        console.log(
            "YouTube player is not ready yet."
        );

        return;
    }


    let state;


    try {

        state =
            youtubePlayer.getPlayerState();

    } catch (error) {

        console.error(
            "Could not get player state:",
            error
        );

        return;
    }


    /*
       PLAYING → PAUSE
    */

    if (
        state ===
        YT.PlayerState.PLAYING
    ) {

        youtubePlayer.pauseVideo();

        return;
    }


    /*
       Otherwise → PLAY
    */

    try {

        youtubePlayer.playVideo();

    } catch (error) {

        console.error(
            "Could not play video:",
            error
        );
    }
}


/* =========================================
   NEXT SONG
   ========================================= */

function nextSong() {

    if (!youtubePlayer) {
        return;
    }


    try {

        youtubePlayer.nextVideo();

    } catch (error) {

        console.error(
            "Could not play next song:",
            error
        );
    }
}


/* =========================================
   PREVIOUS SONG
   ========================================= */

function previousSong() {

    if (!youtubePlayer) {
        return;
    }


    try {

        youtubePlayer.previousVideo();

    } catch (error) {

        console.error(
            "Could not play previous song:",
            error
        );
    }
}


/* =========================================
   START PROGRESS UPDATE
   ========================================= */

function startProgressUpdate() {

    /*
       Don't create duplicate loops.
    */

    if (progressAnimationFrame) {
        return;
    }


    updateProgress();
}


/* =========================================
   STOP PROGRESS UPDATE
   ========================================= */

function stopProgressUpdate() {

    if (
        progressAnimationFrame
    ) {

        cancelAnimationFrame(
            progressAnimationFrame
        );

        progressAnimationFrame =
            null;
    }
}


/* =========================================
   PROGRESS
   ========================================= */

function updateProgress() {

    if (!youtubePlayer) {

        progressAnimationFrame =
            null;

        return;
    }


    const progressControl =
        document.getElementById(
            "progress-control"
        );


    const currentTimeElement =
        document.getElementById(
            "current-time"
        );


    const durationElement =
        document.getElementById(
            "duration"
        );


    if (!progressControl) {

        progressAnimationFrame =
            null;

        return;
    }


    let currentTime = 0;
    let duration = 0;


    try {

        currentTime =
            youtubePlayer.getCurrentTime();

        duration =
            youtubePlayer.getDuration();

    } catch (error) {

        progressAnimationFrame =
            null;

        return;
    }


    /*
       Progress percentage.
    */

    if (
        duration &&
        duration > 0
    ) {

        progressControl.value =
            (
                currentTime /
                duration
            ) * 100;
    }

    const waveform =
    document.querySelector(
        ".waveform-line-front"
    );

if (
    waveform &&
    duration &&
    duration > 0
) {

    const percentage =
        (
            currentTime /
            duration
        ) * 100;

    waveform.style.clipPath =
        `inset(0 ${100 - percentage}% 0 0)`;
}
    /*
       Current time.
    */

    if (currentTimeElement) {

        currentTimeElement.textContent =
            formatTime(currentTime);
    }


    /*
       Total duration.
    */

    if (durationElement) {

        durationElement.textContent =
            formatTime(duration);
    }

    updateDynamicWaveform(
    performance.now()
);
    /*
       Continue updating.
    */

    progressAnimationFrame =
        requestAnimationFrame(
            updateProgress
        );
}


/* =========================================
   SEEK SONG
   ========================================= */

function seekSong(event) {

    if (!youtubePlayer) {
        return;
    }


    let duration = 0;


    try {

        duration =
            youtubePlayer.getDuration();

    } catch (error) {

        return;
    }


    if (
        !duration ||
        duration <= 0
    ) {

        return;
    }


    const percentage =
        Number(
            event.target.value
        );


    const targetTime =
        (
            percentage /
            100
        ) * duration;


    try {

        youtubePlayer.seekTo(
            targetTime,
            true
        );

    } catch (error) {

        console.error(
            "Could not seek song:",
            error
        );
    }
}


/* =========================================
   FORMAT TIME
   ========================================= */

function formatTime(seconds) {

    if (
        !seconds ||
        isNaN(seconds)
    ) {

        return "0:00";
    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        Math.floor(
            seconds % 60
        );


    return `${minutes}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}


/* =========================================
   STOP ALBUM ROTATION
   ========================================= */

function stopAlbumRotation() {

    const albumArt =
        document.getElementById(
            "album-art"
        );


    if (albumArt) {

        albumArt.classList.remove(
            "playing"
        );
    }
}


/* =========================================
   RESET PLAYER UI
   ========================================= */

function resetPlayerUI() {

    const songTitle =
        document.getElementById(
            "song-title"
        );


    const songSource =
        document.getElementById(
            "song-source"
        );


    const albumImage =
        document.getElementById(
            "album-image"
        );


    const playButton =
        document.getElementById(
            "play-button"
        );


    const progressControl =
        document.getElementById(
            "progress-control"
        );


    const currentTimeElement =
        document.getElementById(
            "current-time"
        );


    const durationElement =
        document.getElementById(
            "duration"
        );


    /* Song title */

    if (songTitle) {

        songTitle.textContent =
            currentMode
                ? currentMode.name
                : "Nostalgic Radio";
    }


    /* Source */

    if (songSource) {

        songSource.textContent =
            currentMode
                ? `${currentMode.name} • YouTube Music`
                : "YouTube Music";
    }


    /* Album */

    if (albumImage) {

    albumImage.removeAttribute(
        "src"
    );

    albumImage.removeAttribute(
        "data-video-id"
    );
}


    /* Play button */

    if (playButton) {

        playButton.textContent =
            "▶";
    }


    /* Progress */

    if (progressControl) {

        progressControl.value =
            0;
    }


    /* Current time */

    if (currentTimeElement) {

        currentTimeElement.textContent =
            "0:00";
    }


    /* Duration */

    if (durationElement) {

        durationElement.textContent =
            "0:00";
    }


    /* Album rotation */

    stopAlbumRotation();
}

const frontWave =
    document.querySelector(
        ".waveform-line-front"
    );

if (frontWave) {

    frontWave.style.clipPath =
        "inset(0 100% 0 0)";
}


const musicPlayer =
    document.querySelector(
        ".music-player"
    );

if (musicPlayer) {

    musicPlayer.classList.remove(
        "playing"
    );
}
/* =========================================
   BUTTON EVENTS
   ========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        /* PLAY */

        const playButton =
            document.getElementById(
                "play-button"
            );


        if (playButton) {

            playButton.addEventListener(
                "click",
                togglePlayPause
            );
        }


        /* NEXT */

        const nextButton =
            document.getElementById(
                "next-button"
            );


        if (nextButton) {

            nextButton.addEventListener(
                "click",
                nextSong
            );
        }


        /* PREVIOUS */

        const previousButton =
            document.getElementById(
                "previous-button"
            );


        if (previousButton) {

            previousButton.addEventListener(
                "click",
                previousSong
            );
        }


        /* PROGRESS */

        const progressControl =
            document.getElementById(
                "progress-control"
            );


        if (progressControl) {

            progressControl.addEventListener(
                "input",
                seekSong
            );
        }


        console.log(
            "Player controls initialized."
        );
    }
);
/* =========================================
   DYNAMIC WAVEFORM
   ========================================= */

function updateDynamicWaveform(time) {

    const frontWave =
        document.querySelector(
            ".waveform-line-front"
        );

    const backWave =
        document.querySelector(
            ".waveform-line-back"
        );

    if (!frontWave || !backWave) {
        return;
    }

    const points = [];

    const pointCount = 61;

    for (
        let i = 0;
        i < pointCount;
        i++
    ) {

        const x =
            (
                i /
                (pointCount - 1)
            ) * 600;

        /*
         * Multiple waves combined together.
         *
         * This creates a natural
         * continuously changing waveform.
         */

        const wave1 =
            Math.sin(
                time * 0.004 +
                i * 0.42
            );

        const wave2 =
            Math.sin(
                time * 0.006 +
                i * 0.19 +
                1.7
            );

        const wave3 =
            Math.sin(
                time * 0.0025 +
                i * 0.73
            );

        /*
         * Center amplitude.
         */

        let amplitude =
            (
                wave1 * 8 +
                wave2 * 5 +
                wave3 * 3
            );

        /*
         * Keep the waveform subtle
         * near the edges.
         */

        const edgeFactor =
            Math.sin(
                (
                    i /
                    (pointCount - 1)
                ) * Math.PI
            );

        amplitude *=
            0.55 +
            edgeFactor * 0.45;

        const y =
            35 + amplitude;

        points.push(
            `${x.toFixed(1)} ${y.toFixed(1)}`
        );
    }

    const pathData =
        "M " +
        points.join(" L ");

    frontWave.setAttribute(
        "d",
        pathData
    );

    backWave.setAttribute(
        "d",
        pathData
    );
}