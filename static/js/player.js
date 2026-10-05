/* =========================================
   NOSTALGIC RADIO
   YOUTUBE MUSIC PLAYER
   ========================================= */

let youtubePlayer = null;
let youtubeReady = false;
let currentMode = null;

let progressAnimationFrame = null;

/* =========================================
   BACKGROUND & SCREEN-OFF AUDIO SUBSYSTEM
   ========================================= */
let keepAliveAudio = null;
let backgroundKeepAliveInterval = null;
let backgroundResumeTimer = null;
let lastMediaSessionPositionUpdate = 0;
let wakeLock = null;

window.userInitiatedPause = false;
window.isPlaybackActive = false;
window.isBackgroundAudioEnabled = localStorage.getItem("nostalgic_background_playback") !== "false";

// Generates an inaudible 6-second PCM WAV Blob URL to retain Android/iOS browser audio focus
function getSilentAudioBlobUrl() {
    try {
        const sampleRate = 8000;
        const durationSec = 6;
        const numFrames = sampleRate * durationSec;
        const buffer = new ArrayBuffer(44 + numFrames * 2);
        const view = new DataView(buffer);

        const writeStr = (offset, str) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeStr(0, "RIFF");
        view.setUint32(4, 36 + numFrames * 2, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, "data");
        view.setUint32(40, numFrames * 2, true);

        const blob = new Blob([buffer], { type: "audio/wav" });
        return URL.createObjectURL(blob);
    } catch (e) {
        return "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAAAAAAAAAAAA";
    }
}

function initKeepAliveAudio() {
    if (keepAliveAudio) return keepAliveAudio;

    try {
        keepAliveAudio = document.createElement("audio");
        keepAliveAudio.id = "nostalgic-background-keepalive";
        keepAliveAudio.setAttribute("playsinline", "true");
        keepAliveAudio.setAttribute("webkit-playsinline", "true");
        keepAliveAudio.setAttribute("x5-playsinline", "true");
        keepAliveAudio.preload = "auto";
        keepAliveAudio.loop = true;
        keepAliveAudio.volume = 0.01;
        keepAliveAudio.src = getSilentAudioBlobUrl();
        keepAliveAudio.style.cssText = "position:absolute; width:1px; height:1px; opacity:0.01; pointer-events:none; left:-9999px; top:-9999px;";
        
        document.body.appendChild(keepAliveAudio);
    } catch (err) {
        console.warn("Could not create keep-alive audio element:", err);
    }
    return keepAliveAudio;
}

function playKeepAliveAudio() {
    if (!window.isBackgroundAudioEnabled) return;
    try {
        const audio = initKeepAliveAudio();
        if (audio && audio.paused) {
            const p = audio.play();
            if (p && typeof p.catch === "function") {
                p.catch(() => {});
            }
        }
    } catch (e) {}
}

function pauseKeepAliveAudio() {
    try {
        if (keepAliveAudio && !keepAliveAudio.paused) {
            keepAliveAudio.pause();
        }
    } catch (e) {}
}

async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLock && !document.hidden) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        } catch (e) {}
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        try {
            wakeLock.release().catch(() => {});
        } catch (e) {}
        wakeLock = null;
    }
}

/* =========================================
   MEDIA SESSION API (LOCK SCREEN & NOTIFICATIONS)
   ========================================= */

function updateMediaSession(songInfo) {
    if (!('mediaSession' in navigator)) return;

    try {
        const title = (songInfo && songInfo.title) || document.getElementById("song-title")?.textContent || "Nostalgic Radio";
        let artist = (songInfo && songInfo.artist) || "YouTube Music";
        if (currentMode && (!artist || artist === "YouTube Music")) {
            artist = `${currentMode.name} • Vintage Radio`;
        }
        const videoId = songInfo && songInfo.videoId;
        const artworkUrl = videoId
            ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            : "/static/images/backgrounds/papa-era.jpeg";

        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            album: currentMode ? `Nostalgic Radio — ${currentMode.name}` : "Nostalgic Radio",
            artwork: [
                { src: artworkUrl, sizes: "96x96", type: "image/jpeg" },
                { src: artworkUrl, sizes: "128x128", type: "image/jpeg" },
                { src: artworkUrl, sizes: "192x192", type: "image/jpeg" },
                { src: artworkUrl, sizes: "256x256", type: "image/jpeg" },
                { src: artworkUrl, sizes: "384x384", type: "image/jpeg" },
                { src: artworkUrl, sizes: "512x512", type: "image/jpeg" }
            ]
        });

        navigator.mediaSession.playbackState = "playing";
    } catch (err) {
        console.warn("Could not update MediaSession metadata:", err);
    }
}

function updateMediaSessionPositionState(currentTime, duration) {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== "function") return;
    try {
        if (duration && !isNaN(duration) && duration > 0 && currentTime !== undefined && !isNaN(currentTime)) {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1.0,
                position: Math.min(Math.max(currentTime, 0), duration)
            });
        }
    } catch (e) {}
}

let mediaSessionHandlersConfigured = false;
function setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator) || mediaSessionHandlersConfigured) return;
    mediaSessionHandlersConfigured = true;

    const actionHandlers = [
        ['play', () => {
            console.log("MediaSession [LockScreen]: Play requested");
            window.userInitiatedPause = false;
            window.isPlaybackActive = true;
            if (youtubePlayer && typeof youtubePlayer.playVideo === "function") {
                youtubePlayer.playVideo();
            }
            playKeepAliveAudio();
            requestWakeLock();
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
        }],
        ['pause', () => {
            console.log("MediaSession [LockScreen]: Pause requested");
            window.userInitiatedPause = true;
            window.isPlaybackActive = false;
            if (youtubePlayer && typeof youtubePlayer.pauseVideo === "function") {
                youtubePlayer.pauseVideo();
            }
            pauseKeepAliveAudio();
            releaseWakeLock();
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        }],
        ['previoustrack', () => {
            console.log("MediaSession [LockScreen]: Previous track requested");
            window.userInitiatedPause = false;
            if (typeof previousSong === "function") {
                previousSong();
            }
        }],
        ['nexttrack', () => {
            console.log("MediaSession [LockScreen]: Next track requested");
            window.userInitiatedPause = false;
            if (typeof nextSong === "function") {
                nextSong();
            }
        }],
        ['seekto', (details) => {
            if (details.seekTime !== undefined && youtubePlayer && typeof youtubePlayer.seekTo === "function") {
                youtubePlayer.seekTo(details.seekTime, true);
                if (typeof youtubePlayer.getDuration === "function") {
                    updateMediaSessionPositionState(details.seekTime, youtubePlayer.getDuration());
                }
            }
        }],
        ['seekbackward', (details) => {
            const skip = details.seekOffset || 10;
            if (youtubePlayer && typeof youtubePlayer.getCurrentTime === "function") {
                const cur = youtubePlayer.getCurrentTime();
                const target = Math.max(cur - skip, 0);
                youtubePlayer.seekTo(target, true);
                if (typeof youtubePlayer.getDuration === "function") {
                    updateMediaSessionPositionState(target, youtubePlayer.getDuration());
                }
            }
        }],
        ['seekforward', (details) => {
            const skip = details.seekOffset || 10;
            if (youtubePlayer && typeof youtubePlayer.getCurrentTime === "function") {
                const cur = youtubePlayer.getCurrentTime();
                const target = cur + skip;
                youtubePlayer.seekTo(target, true);
                if (typeof youtubePlayer.getDuration === "function") {
                    updateMediaSessionPositionState(target, youtubePlayer.getDuration());
                }
            }
        }],
        ['stop', () => {
            window.userInitiatedPause = true;
            window.isPlaybackActive = false;
            if (youtubePlayer && typeof youtubePlayer.pauseVideo === "function") {
                youtubePlayer.pauseVideo();
            }
            pauseKeepAliveAudio();
            releaseWakeLock();
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        }]
    ];

    for (const [action, handler] of actionHandlers) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            console.warn(`MediaSession action "${action}" not supported:`, e);
        }
    }
}

/* =========================================
   BACKGROUND VISIBILITY & SCREEN LOCK WATCHER
   ========================================= */

document.addEventListener("visibilitychange", function () {
    if (!window.isBackgroundAudioEnabled) return;

    if (document.hidden) {
        console.log("App moved to background / Phone screen turned off");
        
        // If actively playing and not paused by user, protect audio playback
        if (window.isPlaybackActive && !window.userInitiatedPause) {
            playKeepAliveAudio();

            // Mobile Chrome / Safari may pause iframe video when hidden. Resume immediately!
            if (backgroundResumeTimer) clearTimeout(backgroundResumeTimer);
            backgroundResumeTimer = setTimeout(function () {
                if (!window.userInitiatedPause && youtubePlayer && typeof youtubePlayer.getPlayerState === "function") {
                    try {
                        const st = youtubePlayer.getPlayerState();
                        if (st === 2 || st === -1) { // 2 = PAUSED, -1 = UNSTARTED
                            console.log("Background Watcher: Resuming audio playback...");
                            youtubePlayer.playVideo();
                        }
                    } catch (e) {}
                }
            }, 180);

            // Maintain watchdog while screen is off / app in background
            if (backgroundKeepAliveInterval) clearInterval(backgroundKeepAliveInterval);
            let checks = 0;
            backgroundKeepAliveInterval = setInterval(function () {
                checks++;
                if (checks > 45 || !document.hidden || window.userInitiatedPause) {
                    clearInterval(backgroundKeepAliveInterval);
                    backgroundKeepAliveInterval = null;
                    return;
                }
                if (youtubePlayer && typeof youtubePlayer.getPlayerState === "function") {
                    try {
                        const st = youtubePlayer.getPlayerState();
                        if (st === 2 && !window.userInitiatedPause) {
                            console.log("Background Watchdog: Keeping stream alive...");
                            youtubePlayer.playVideo();
                        }
                    } catch (e) {}
                }
            }, 1200);
        }
    } else {
        console.log("App returned to foreground");
        if (backgroundResumeTimer) {
            clearTimeout(backgroundResumeTimer);
            backgroundResumeTimer = null;
        }
        if (backgroundKeepAliveInterval) {
            clearInterval(backgroundKeepAliveInterval);
            backgroundKeepAliveInterval = null;
        }

        // Resync UI elements
        if (youtubePlayer && typeof youtubePlayer.getPlayerState === "function") {
            try {
                const st = youtubePlayer.getPlayerState();
                if (st === 1) { // PLAYING
                    const playButton = document.getElementById("play-button");
                    if (playButton) playButton.textContent = "Ⅱ";
                    const musicPlayer = document.querySelector(".music-player");
                    if (musicPlayer) musicPlayer.classList.add("playing");
                    if (typeof window.syncSpotifyPlayState === "function") {
                        window.syncSpotifyPlayState(true);
                    }
                    startProgressUpdate();
                    requestWakeLock();
                }
            } catch (e) {}
        }
    }
});

// Curated authentic song lists for all eras (Direct Single-Video Clean Playback)
window.ERA_TRACKS_DB = window.ERA_TRACKS_DB || {
    "papa-era": [
        { title: "Mere Mehboob Qayamat Hogi", artist: "Kishore Kumar", videoId: "yIzCBU0_LyY", duration: "3:45" },
        { title: "Chhup Gaye Saare Nazaare", artist: "Mohd Rafi & Lata Mangeshkar", videoId: "1lyJyjSezC8", duration: "5:22" },
        { title: "Pal Pal Dil Ke Paas", artist: "Kishore Kumar", videoId: "t2v3GDhEZno", duration: "5:12" },
        { title: "Yeh Shaam Mastani", artist: "Kishore Kumar", videoId: "lbfWsIpXsCA", duration: "4:38" },
        { title: "Lag Ja Gale Ke Phir", artist: "Lata Mangeshkar", videoId: "y2fgw1Oqz28", duration: "4:18" },
        { title: "Chura Liya Hai Tumne Jo Dil Ko", artist: "Asha Bhosle & Mohd Rafi", videoId: "seFeZOgyFsc", duration: "4:48" },
        { title: "Kahin Door Jab Din Dhal Jaaye", artist: "Mukesh", videoId: "iJlbuFnKssM", duration: "4:40" },
        { title: "O Mere Dil Ke Chain", artist: "Kishore Kumar", videoId: "-Px0efU00uQ", duration: "4:32" }
    ],
    "90s-era": [
        { title: "Tujhe Dekha Toh Yeh Jaana Sanam", artist: "Kumar Sanu & Lata Mangeshkar", videoId: "cNV5hLSa9H8", duration: "5:04" },
        { title: "Dheere Dheere Se Meri Zindagi", artist: "Kumar Sanu & Anuradha Paudwal", videoId: "mNuhKUOD_A0", duration: "5:28" },
        { title: "Pehla Nasha", artist: "Udit Narayan & Sadhana Sargam", videoId: "SBfPs-PMGTA", duration: "4:51" },
        { title: "Tip Tip Barsa Paani", artist: "Udit Narayan & Alka Yagnik", videoId: "VMsn5-a45-s", duration: "5:58" },
        { title: "Chura Ke Dil Mera", artist: "Kumar Sanu & Alka Yagnik", videoId: "Yqj1_V90KJo", duration: "5:00" },
        { title: "Kuch Kuch Hota Hai", artist: "Udit Narayan & Alka Yagnik", videoId: "bKZTnnFU9HA", duration: "4:56" },
        { title: "Aankh Marey O Ladki Aankh Marey", artist: "Kumar Sanu & Kavita K.", videoId: "2YDZDHF20_M", duration: "5:10" },
        { title: "Chaiyya Chaiyya", artist: "Sukhwinder Singh & Sapna Awasthi", videoId: "zaJPvEM7fVY", duration: "6:52" }
    ],
    "2000s-era": [
        { title: "Woh Lamhe Woh Baatein", artist: "Atif Aslam", videoId: "FLKxnL7KwHw", duration: "5:18" },
        { title: "Tu Hi Meri Shab Hai", artist: "KK • Gangster", videoId: "mWBvudKcByg", duration: "6:26" },
        { title: "Zara Sa", artist: "KK • Jannat", videoId: "ZsAOnmByy38", duration: "5:02" },
        { title: "Kal Ho Naa Ho", artist: "Sonu Nigam", videoId: "g0eO74UmRBs", duration: "5:21" },
        { title: "Bheegi Bheegi", artist: "James • Gangster", videoId: "WeY9hdsmIaQ", duration: "5:44" },
        { title: "Kya Mujhe Pyaar Hai", artist: "KK • Woh Lamhe", videoId: "lrAM_H7v8wM", duration: "4:32" },
        { title: "Tum Se Hi", artist: "Mohit Chauhan • Jab We Met", videoId: "mt9xg0mmt28", duration: "5:23" },
        { title: "Pee Loon", artist: "Mohit Chauhan • OUATIM", videoId: "D8XFTglfSMg", duration: "4:48" }
    ],
    "bihar-bangers": [
        { title: "Lollypop Lagelu", artist: "Pawan Singh", videoId: "Gr8G_ldltDE", duration: "4:15" },
        { title: "Rinkiya Ke Papa", artist: "Manoj Tiwari", videoId: "R3L01qO3R0Q", duration: "4:42" },
        { title: "Chhalakata Hamro Jawaniya", artist: "Pawan Singh & Priyanka", videoId: "Gr8G_ldltDE", duration: "3:58" },
        { title: "Piyawa Se Pahile Hamar Rahlu", artist: "Ritesh Pandey", videoId: "R3L01qO3R0Q", duration: "4:10" },
        { title: "Dhibri Me Rahue Na Tel", artist: "Khesari Lal Yadav", videoId: "Gr8G_ldltDE", duration: "3:40" }
    ],
    "punjabi-bangers": [
        { title: "Mundian To Bach Ke", artist: "Panjabi MC", videoId: "DJztXj2GPfk", duration: "3:58" },
        { title: "Amplifier", artist: "Imran Khan", videoId: "uuCFRaAn45o", duration: "3:52" },
        { title: "Brown Munde", artist: "AP Dhillon & Gurinder Gill", videoId: "VNs_cCtdbPc", duration: "4:07" },
        { title: "High Rated Gabru", artist: "Guru Randhawa", videoId: "hjWf8A0YNSE", duration: "3:34" },
        { title: "3 Peg", artist: "Sharry Mann", videoId: "hzTg4zPBtDU", duration: "4:12" }
    ],
    "lofi": [
        { title: "Iktara (Lo-Fi Flip)", artist: "Amit Trivedi & Kavita Seth", videoId: "f6vYZh4gK0s", duration: "4:12" },
        { title: "Chalte Chalte (Midnight Lo-Fi)", artist: "Lata Mangeshkar Chill", videoId: "f6vYZh4gK0s", duration: "3:50" },
        { title: "Kabira (Rain Chill Lofi)", artist: "Tochi Raina & Rekha B.", videoId: "jHNNMj5bNQw", duration: "4:20" },
        { title: "Agar Tum Saath Ho (Lofi Sunset)", artist: "Arijit Singh & Alka Yagnik", videoId: "XW999v4896E", duration: "4:35" },
        { title: "Phir Le Aya Dil (Lo-Fi Session)", artist: "Arijit Singh", videoId: "W-ZzX1tX9M8", duration: "5:05" }
    ],
    "sad": [
        { title: "Tujhe Bhula Diya", artist: "Mohit Chauhan & Shekhar", videoId: "NPb9WIzIQsQ", duration: "4:39" },
        { title: "Channa Mereya", artist: "Arijit Singh • ADHM", videoId: "284Ov7ysmfA", duration: "4:49" },
        { title: "Jag Soona Soona Lage", artist: "Rahat Fateh Ali Khan", videoId: "NPb9WIzIQsQ", duration: "5:31" },
        { title: "Agar Tum Saath Ho", artist: "Arijit Singh • Tamasha", videoId: "XW999v4896E", duration: "5:41" },
        { title: "Kabira (Encore)", artist: "Arijit Singh & Harshdeep", videoId: "jHNNMj5bNQw", duration: "4:29" }
    ],
    "romantic": [
        { title: "Tum Hi Ho", artist: "Arijit Singh • Aashiqui 2", videoId: "Umqb9KENgmk", duration: "4:22" },
        { title: "Raabta (Kehte Hain Khuda)", artist: "Arijit Singh & Hamsika", videoId: "z-diRlyLGgg", duration: "4:04" },
        { title: "Janam Janam", artist: "Arijit Singh • Dilwale", videoId: "Z9AZT1K-T2o", duration: "3:58" },
        { title: "Kesariya", artist: "Arijit Singh • Brahmastra", videoId: "BddP6PYo2gs", duration: "4:28" },
        { title: "Subhanallah", artist: "Sreerama Chandra • YJHD", videoId: "BddP6PYo2gs", duration: "4:09" }
    ],
    "truck": [
        { title: "Main Nikla Gaddi Leke", artist: "Udit Narayan • Gadar", videoId: "uK1p46_b1lU", duration: "4:45" },
        { title: "Khaike Paan Banaraswala", artist: "Kishore Kumar • Don", videoId: "F3_8f4xY2dE", duration: "3:57" },
        { title: "Dum Maro Dum", artist: "Asha Bhosle • Hare Rama", videoId: "S386h8J52bA", duration: "4:36" },
        { title: "Babuji Zara Dheere Chalo", artist: "Sukhwinder Singh • Dum", videoId: "kYJzU88R39s", duration: "4:58" },
        { title: "Jumma Chumma De De", artist: "Sudesh Bhosle • Hum", videoId: "EsxsAZT85s4", duration: "5:05" }
    ],
    "night-drive": [
        { title: "Dil Chahta Hai", artist: "Shankar Mahadevan", videoId: "kYJ8a2k0TfU", duration: "5:11" },
        { title: "Safarnama", artist: "Lucky Ali • Tamasha", videoId: "7mTDBsdfw88", duration: "4:11" },
        { title: "Hairat", artist: "Lucky Ali • Anjaana Anjaani", videoId: "P7FwOmXTUzY", duration: "4:19" },
        { title: "Khoya Khoya Chaand", artist: "Mohammed Rafi • Kala Bazar", videoId: "J4kR7yFuZEs", duration: "4:42" },
        { title: "Musafir Hoon Yaaron", artist: "Kishore Kumar • Parichay", videoId: "u1cR5kS85m4", duration: "3:08" }
    ]
};

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

function changeMusicMode(mode, targetVideoId = null) {

    if (!mode) {
        return;
    }

    currentMode = mode;

    try {
        localStorage.setItem("nostalgic_radio_current_mode", mode.id);
    } catch (e) {}

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

    createYouTubePlayer(mode, targetVideoId);
}


/* =========================================
   CREATE YOUTUBE PLAYER
   ========================================= */

function createYouTubePlayer(mode, targetVideoId = null) {

    if (!mode || !youtubeReady) {
        return;
    }


    const playlistId =
        mode.youtube_playlist_id;

    const testVideoId =
        mode.test_video_id || null;

    const eraTracks = (window.ERA_TRACKS_DB && window.ERA_TRACKS_DB[mode.id]) ? window.ERA_TRACKS_DB[mode.id] : null;
    const initialVideoId = targetVideoId || testVideoId || (eraTracks && eraTracks.length > 0 ? eraTracks[0].videoId : null);

    if (
        !initialVideoId &&
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
        height: "1080",
        width: "1920",

        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            autohide: 1,
            origin: window.location.origin
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
       CLEAN SINGLE VIDEO MODE
       Avoids YouTube playlist UI overlay (prev/next controls, title bars)
    */

    if (initialVideoId) {

        playerOptions.videoId =
            initialVideoId;

        console.log(
            "Clean single video mode:",
            initialVideoId
        );
    } else {

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
            iframe.setAttribute(
                "allow",
                "autoplay; encrypted-media; picture-in-picture"
            );
            iframe.setAttribute("playsinline", "1");
            iframe.setAttribute("tabindex", "-1");
            iframe.blur();

            console.log(
                "YouTube iframe configured."
            );
        }

        setupMediaSessionHandlers();

    } catch (error) {

        console.warn(
            "Could not configure YouTube iframe:",
            error
        );
    }


    /*
     * Update source immediately.
     */
    const eraTracks = (window.ERA_TRACKS_DB && currentMode) ? window.ERA_TRACKS_DB[currentMode.id] : null;
    if (eraTracks && eraTracks[0]) {
        window.currentEraTracks = eraTracks;
        const firstTrack = eraTracks[0];
        const songTitleEl = document.getElementById("song-title");
        if (songTitleEl) songTitleEl.textContent = firstTrack.title;
        const songSourceEl = document.getElementById("song-source");
        if (songSourceEl) songSourceEl.textContent = `${firstTrack.artist} • ${currentMode.name}`;
        updateAlbumImage(firstTrack.videoId);
        changeWaveformColor(firstTrack.videoId);
        if (typeof window.onSongChanged === "function") {
            window.onSongChanged({
                videoId: firstTrack.videoId,
                title: firstTrack.title,
                author: firstTrack.artist,
                mode: currentMode
            });
        }
    } else {
        updateSongSource();
        updateCurrentSong();
    }

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

    try {
        if (event.target && typeof event.target.getIframe === "function") {
            const ifr = event.target.getIframe();
            if (ifr) {
                ifr.setAttribute("tabindex", "-1");
                ifr.blur();
            }
        }
    } catch(e){}

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

        window.isPlaybackActive = true;
        window.userInitiatedPause = false;
        playKeepAliveAudio();
        requestWakeLock();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }

        if (albumArt) {

            albumArt.classList.add(
                "playing"
            );
        }
        if (musicPlayer) {
            musicPlayer.classList.add("playing");
        }

        if (playButton) {
            playButton.textContent = "Ⅱ";
        }

        if (typeof window.syncSpotifyPlayState === "function") {
            window.syncSpotifyPlayState(true);
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

        // If tab/phone screen is off or in background and user did NOT manually tap pause,
        // this was triggered by browser's background video policy. Auto-resume immediately!
        if (document.hidden && !window.userInitiatedPause && window.isBackgroundAudioEnabled) {
            console.log("Background pause detected. Auto-resuming music...");
            setTimeout(function () {
                if (!window.userInitiatedPause && youtubePlayer && typeof youtubePlayer.playVideo === "function") {
                    youtubePlayer.playVideo();
                }
            }, 120);
            return;
        }

        window.isPlaybackActive = false;
        pauseKeepAliveAudio();
        releaseWakeLock();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
        }

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

        if (typeof window.syncSpotifyPlayState === "function") {
            window.syncSpotifyPlayState(false);
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

        window.userInitiatedPause = false;

        // 0. PLAYBACK QUEUE: If user queued any songs, play the queued song first!
        if (typeof window.playNextFromQueue === "function" && window.playNextFromQueue()) {
            console.log("Queue Active: Playing next song from user queue...");
            return;
        }

        // 1. REPEAT / LOOP CURRENT TRACK
        if (window.isRepeatActive) {
            console.log("Repeat Active: Replaying current track...");
            try {
                youtubePlayer.seekTo(0);
                youtubePlayer.playVideo();
                return;
            } catch (err) {
                console.error("Repeat replay error:", err);
            }
        }

        // 2. AUTO-ADVANCE TO NEXT SONG (Continuous Radio Experience)
        console.log("Track finished: Advancing to next song...");
        nextSong();
        return;

        if (albumArt) {

            albumArt.classList.remove(
                "playing"
            );
        }

        if (typeof window.syncSpotifyPlayState === "function") {
            window.syncSpotifyPlayState(false);
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

    const customTitleTag =
        document.getElementById(
            "custom-memory-tag"
        );

    const customTitleText =
        document.getElementById(
            "custom-memory-tag-text"
        );

    const customMemoryTitle =
        (typeof window.getCustomTitleForSong === "function" && videoId)
            ? window.getCustomTitleForSong(videoId)
            : null;

    if (
        songTitle &&
        title
    ) {
        if (customMemoryTitle) {
            songTitle.textContent = customMemoryTitle;
            if (customTitleTag && customTitleText) {
                customTitleTag.style.display = "inline-flex";
                customTitleText.textContent = `Memory: ${customMemoryTitle}`;
            }
        } else {
            songTitle.textContent = title;
            if (customTitleTag) {
                customTitleTag.style.display = "none";
            }
        }
    }

    /*
       Notify Wishlist and UI of song change
    */
    if (typeof window.onSongChanged === "function") {
        window.onSongChanged({
            videoId: videoId,
            title: title,
            author: videoData.author || "YouTube Music",
            mode: currentMode
        });
    }

    if (videoId) {
        try {
            localStorage.setItem("nostalgic_radio_current_video_id", videoId);
            if (currentMode) {
                localStorage.setItem("nostalgic_radio_current_mode", currentMode.id);
            }
            const currentHash = window.location.hash || "";
            window.history.replaceState(null, "", `/?v=${videoId}${currentHash}`);
        } catch (e) {}
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

    let cleanArtist = "YouTube Music";
    if (currentMode && window.ERA_TRACKS_DB && window.ERA_TRACKS_DB[currentMode.id]) {
        const foundTrack = window.ERA_TRACKS_DB[currentMode.id].find(t => t.videoId === videoId);
        if (foundTrack && foundTrack.artist) cleanArtist = foundTrack.artist;
    }
    if (cleanArtist === "YouTube Music" && videoData.author) {
        cleanArtist = videoData.author;
    }

    updateMediaSession({
        title: customMemoryTitle || title || "Nostalgic Radio",
        artist: cleanArtist,
        videoId: videoId
    });
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

        window.userInitiatedPause = true;
        window.isPlaybackActive = false;
        pauseKeepAliveAudio();
        releaseWakeLock();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
        }

        youtubePlayer.pauseVideo();

        return;
    }


    /*
       Otherwise → PLAY
    */

    try {

        window.userInitiatedPause = false;
        window.isPlaybackActive = true;
        playKeepAliveAudio();
        requestWakeLock();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }

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

    window.userInitiatedPause = false;
    window.isPlaybackActive = true;
    playKeepAliveAudio();
    requestWakeLock();

    // 0. Check Playback Queue first
    if (typeof window.playNextFromQueue === "function" && window.playNextFromQueue()) {
        return;
    }

    try {
        const tracks = window.currentEraTracks || ((window.ERA_TRACKS_DB && currentMode) ? window.ERA_TRACKS_DB[currentMode.id] : null);
        if (tracks && tracks.length > 0) {
            const currentVideoData = (youtubePlayer.getVideoData) ? youtubePlayer.getVideoData() : null;
            const curId = currentVideoData ? currentVideoData.video_id : null;
            let curIdx = tracks.findIndex(t => t.videoId === curId);
            if (curIdx === -1) curIdx = 0;

            let nextIdx;
            if (window.isShuffleActive) {
                const pool = tracks.filter((t, i) => i !== curIdx);
                const pick = pool[Math.floor(Math.random() * pool.length)] || tracks[0];
                nextIdx = tracks.indexOf(pick);
            } else {
                nextIdx = (curIdx + 1) % tracks.length;
            }

            const nextTrack = tracks[nextIdx];
            if (nextTrack && typeof window.playSongById === "function") {
                window.playSongById(nextTrack.videoId, nextTrack.title, nextTrack.artist);
                return;
            }
        }

        if (typeof youtubePlayer.nextVideo === "function") {
            youtubePlayer.nextVideo();
        }

    } catch (error) {

        console.error(
            "Could not play next song:",
            error
        );
    }
}

/* =========================================
   PLAY SONG BY ID DIRECTLY
   ========================================= */

window.playSongById = function (videoId, songTitle, artist) {
    if (!youtubePlayer || !videoId) return;

    window.userInitiatedPause = false;
    window.isPlaybackActive = true;
    playKeepAliveAudio();
    requestWakeLock();

    try {
        const playlist = (typeof youtubePlayer.getPlaylist === "function") ? youtubePlayer.getPlaylist() : null;
        if (playlist && playlist.indexOf(videoId) !== -1) {
            youtubePlayer.playVideoAt(playlist.indexOf(videoId));
        } else {
            youtubePlayer.loadVideoById(videoId);
            youtubePlayer.playVideo();
        }

        // Optimistically update song details immediately
        const songTitleEl = document.getElementById("song-title");
        if (songTitleEl && songTitle) songTitleEl.textContent = songTitle;

        const songSourceEl = document.getElementById("song-source");
        if (songSourceEl) {
            songSourceEl.textContent = `${artist || "YouTube Music"} • ${currentMode ? currentMode.name : "Nostalgic Radio"}`;
        }

        updateAlbumImage(videoId);
        changeWaveformColor(videoId);

        updateMediaSession({
            title: songTitle || "Nostalgic Song",
            artist: artist || "YouTube Music",
            videoId: videoId
        });

        if (typeof window.onSongChanged === "function") {
            window.onSongChanged({
                videoId: videoId,
                title: songTitle || "Nostalgic Song",
                author: artist || "YouTube Music",
                mode: currentMode
            });
        }
    } catch (err) {
        console.error("Could not play song by ID:", err);
    }
};


/* =========================================
   PREVIOUS SONG
   ========================================= */

function previousSong() {

    if (!youtubePlayer) {
        return;
    }

    window.userInitiatedPause = false;
    window.isPlaybackActive = true;
    playKeepAliveAudio();
    requestWakeLock();

    try {
        const tracks = window.currentEraTracks || ((window.ERA_TRACKS_DB && currentMode) ? window.ERA_TRACKS_DB[currentMode.id] : null);
        if (tracks && tracks.length > 0) {
            const currentVideoData = (youtubePlayer.getVideoData) ? youtubePlayer.getVideoData() : null;
            const curId = currentVideoData ? currentVideoData.video_id : null;
            let curIdx = tracks.findIndex(t => t.videoId === curId);
            if (curIdx === -1) curIdx = 0;

            const prevIdx = (curIdx - 1 + tracks.length) % tracks.length;
            const prevTrack = tracks[prevIdx];
            if (prevTrack && typeof window.playSongById === "function") {
                window.playSongById(prevTrack.videoId, prevTrack.title, prevTrack.artist);
                return;
            }
        }

        if (typeof youtubePlayer.previousVideo === "function") {
            youtubePlayer.previousVideo();
        }

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

    const nowTime = Date.now();
    if (nowTime - lastMediaSessionPositionUpdate > 1000) {
        lastMediaSessionPositionUpdate = nowTime;
        updateMediaSessionPositionState(currentTime, duration);
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

/* =========================================
   PLAY SPECIFIC SONG (WISHLIST & SEARCH INTEGRATION)
   ========================================= */

window.playSpecificSong = function (videoId, customTitle, modeId, artistName) {
    if (!videoId) return;

    window.userInitiatedPause = false;
    window.isPlaybackActive = true;
    playKeepAliveAudio();
    requestWakeLock();

    console.log("Playing specific song:", videoId, customTitle);

    const songTitle = document.getElementById("song-title");
    if (songTitle && customTitle) {
        songTitle.textContent = customTitle;
    }
    const songSource = document.getElementById("song-source");
    if (songSource && artistName) {
        songSource.textContent = artistName;
    }

    updateMediaSession({
        title: customTitle || "Nostalgic Classic",
        artist: artistName || "YouTube Music",
        videoId: videoId
    });

    if (typeof updateAlbumImage === "function") {
        updateAlbumImage(videoId);
    }
    if (typeof changeWaveformColor === "function") {
        changeWaveformColor(videoId);
    }

    const albumArt = document.getElementById("album-art");
    if (albumArt) {
        albumArt.classList.add("playing");
    }
    const playButton = document.getElementById("play-button");
    if (playButton) {
        playButton.textContent = "Ⅱ";
    }

    if (typeof window.onSongChanged === "function") {
        window.onSongChanged({
            videoId: videoId,
            title: customTitle || "Nostalgic Classic",
            author: artistName || "YouTube Music",
            mode: currentMode || { name: "Nostalgic Radio" }
        });
    }

    if (youtubePlayer && typeof youtubePlayer.loadVideoById === "function") {
        try {
            youtubePlayer.loadVideoById({
                videoId: videoId,
                startSeconds: 0
            });
            youtubePlayer.playVideo();
        } catch (err) {
            console.error("Could not load specific video:", err);
        }
    } else {
        if (typeof createYouTubePlayer === "function" && currentMode) {
            createYouTubePlayer(currentMode, videoId);
        }
    }
};

/* =========================================================
   MONGODB WISHLIST INTEGRATION
   ========================================================= */

(function () {

    let lastWishlistVideoId = null;
    let currentWishlistLiked = false;
    let wishlistBusy = false;

    /* ---------------------------------------------------------
       TOAST
       --------------------------------------------------------- */

    function wishlistToast(message, type = "success") {

        let container = document.getElementById("wishlist-toast-container");

        if (!container) {

            container = document.createElement("div");

            container.id = "wishlist-toast-container";

            container.style.cssText = `
                position: fixed;
                left: 50%;
                bottom: 32px;
                transform: translateX(-50%);
                z-index: 999999;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            `;

            document.body.appendChild(container);
        }

        const toast = document.createElement("div");

        toast.textContent = message;

        toast.style.cssText = `
            padding: 12px 18px;
            border-radius: 14px;
            background: rgba(20,20,20,0.94);
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 10px 35px rgba(0,0,0,0.35);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.12);
            opacity: 0;
            transform: translateY(10px);
            transition: all .25s ease;
        `;

        if (type === "error") {
            toast.style.borderColor = "rgba(255,80,80,.45)";
        }

        container.appendChild(toast);

        requestAnimationFrame(() => {

            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        });

        setTimeout(() => {

            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";

            setTimeout(() => {
                toast.remove();
            }, 250);

        }, 2200);
    }


    /* ---------------------------------------------------------
       GET CURRENT SONG
       --------------------------------------------------------- */

    function getCurrentWishlistSong() {

        if (!youtubePlayer) {
            return null;
        }

        try {

            const data = youtubePlayer.getVideoData();

            if (!data || !data.video_id) {
                return null;
            }

            const videoId = data.video_id;

            const titleElement =
                document.getElementById("song-title");

            const sourceElement =
                document.getElementById("song-source");

            const title =
                titleElement?.textContent?.trim() ||
                data.title ||
                "Nostalgic Song";

            let artist =
                data.author ||
                "YouTube Music";

            /*
             * song-source normally contains:
             * Artist • Era
             */
            if (sourceElement) {

                const sourceText =
                    sourceElement.textContent.trim();

                if (sourceText) {

                    const parts =
                        sourceText.split("•");

                    if (parts[0]?.trim()) {
                        artist = parts[0].trim();
                    }
                }
            }

            const era =
                currentMode?.name ||
                "Nostalgic Radio";

            const thumbnail =
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            return {
                video_id: videoId,
                original_title: data.title || title,
                custom_title: title,
                artist: artist,
                thumbnail: thumbnail,
                era: era
            };

        } catch (error) {

            console.error(
                "Could not get current wishlist song:",
                error
            );

            return null;
        }
    }


    /* ---------------------------------------------------------
       UPDATE HEART UI
       --------------------------------------------------------- */

    function updateWishlistButtons(liked) {

        currentWishlistLiked = liked;

        const buttons = [
            document.getElementById("like-button"),
            document.getElementById("spotify-sticky-like-btn"),
            document.getElementById("opt-action-like")
        ];

        buttons.forEach(button => {

            if (!button) {
                return;
            }

            button.classList.toggle(
                "liked",
                liked
            );

            button.setAttribute(
                "aria-pressed",
                liked ? "true" : "false"
            );

            if (button.id === "like-button") {

                button.title =
                    liked
                        ? "Remove from Wishlist"
                        : "Save to Memories Wishlist";

                button.setAttribute(
                    "aria-label",
                    liked
                        ? "Remove song from wishlist"
                        : "Save song to memories wishlist"
                );
            }

            if (
                button.id ===
                "spotify-sticky-like-btn"
            ) {

                button.title =
                    liked
                        ? "Remove from Wishlist"
                        : "Save to Wishlist";
            }

            if (
                button.id ===
                "opt-action-like"
            ) {

                const title =
                    document.getElementById(
                        "opt-action-like-title"
                    );

                if (title) {

                    title.textContent =
                        liked
                            ? "Remove from Memories Wishlist"
                            : "Save to Memories Wishlist";
                }
            }
        });
    }


    /* ---------------------------------------------------------
       CHECK WHETHER CURRENT SONG IS ALREADY LIKED
       --------------------------------------------------------- */

    async function syncWishlistState(videoId) {

        if (!videoId) {
            return;
        }

        try {

            const response =
                await fetch(
                    `/api/wishlist/check/${encodeURIComponent(videoId)}`,
                    {
                        method: "GET",
                        credentials: "same-origin"
                    }
                );

            if (response.status === 401) {

                updateWishlistButtons(false);

                return;
            }

            if (!response.ok) {

                console.warn(
                    "Wishlist check failed:",
                    response.status
                );

                return;
            }

            const data =
                await response.json();

            if (data.success) {

                updateWishlistButtons(
                    Boolean(data.liked)
                );
            }

        } catch (error) {

            console.error(
                "Wishlist check error:",
                error
            );
        }
    }


    /* ---------------------------------------------------------
       ADD SONG
       --------------------------------------------------------- */

    async function addCurrentSongToWishlist(song) {

        if (!song || !song.video_id) {

            wishlistToast(
                "No song is currently playing.",
                "error"
            );

            return false;
        }

        try {

            const response =
                await fetch(
                    "/api/wishlist",
                    {
                        method: "POST",

                        credentials: "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify(song)
                    }
                );

            if (response.status === 401) {

                wishlistToast(
                    "Please login first.",
                    "error"
                );

                return false;
            }

            const data =
                await response.json();

            if (!response.ok || !data.success) {

                wishlistToast(
                    data.message ||
                    "Could not save song.",
                    "error"
                );

                return false;
            }

            updateWishlistButtons(true);

            if (data.already_exists) {

                wishlistToast(
                    "Already in your wishlist ❤️"
                );

            } else {

                wishlistToast(
                    "Added to your wishlist ❤️"
                );
            }

            return true;

        } catch (error) {

            console.error(
                "Add wishlist error:",
                error
            );

            wishlistToast(
                "Something went wrong while saving.",
                "error"
            );

            return false;
        }
    }


    /* ---------------------------------------------------------
       REMOVE SONG
       --------------------------------------------------------- */

    async function removeCurrentSongFromWishlist(song) {

        if (!song || !song.video_id) {
            return false;
        }

        try {

            const response =
                await fetch(
                    `/api/wishlist/${encodeURIComponent(song.video_id)}`,
                    {
                        method: "DELETE",
                        credentials: "same-origin"
                    }
                );

            if (response.status === 401) {

                wishlistToast(
                    "Please login first.",
                    "error"
                );

                return false;
            }

            const data =
                await response.json();

            if (!response.ok || !data.success) {

                wishlistToast(
                    data.message ||
                    "Could not remove song.",
                    "error"
                );

                return false;
            }

            updateWishlistButtons(false);

            if (data.removed) {

                wishlistToast(
                    "Removed from wishlist."
                );

            } else {

                wishlistToast(
                    "Song was not in your wishlist."
                );
            }

            return true;

        } catch (error) {

            console.error(
                "Remove wishlist error:",
                error
            );

            wishlistToast(
                "Something went wrong.",
                "error"
            );

            return false;
        }
    }


    /* ---------------------------------------------------------
       TOGGLE LIKE
       --------------------------------------------------------- */

    async function toggleWishlist() {

        if (wishlistBusy) {
            return;
        }

        const song =
            getCurrentWishlistSong();

        if (!song) {

            wishlistToast(
                "Please wait for the song to load.",
                "error"
            );

            return;
        }

        wishlistBusy = true;

        try {

            if (currentWishlistLiked) {

                await removeCurrentSongFromWishlist(
                    song
                );

            } else {

                await addCurrentSongToWishlist(
                    song
                );
            }

        } finally {

            wishlistBusy = false;
        }
    }


    /* ---------------------------------------------------------
       BUTTON INITIALIZATION
       --------------------------------------------------------- */

    function initializeWishlistButtons() {

        const buttonIds = [
            "like-button",
            "spotify-sticky-like-btn",
            "opt-action-like"
        ];

        buttonIds.forEach(id => {

            const button =
                document.getElementById(id);

            if (!button) {
                return;
            }

            /*
             * Prevent duplicate listeners
             */
            if (
                button.dataset.wishlistListener ===
                "true"
            ) {
                return;
            }

            button.dataset.wishlistListener =
                "true";

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleWishlist();
                }
            );
        });

        console.log(
            "MongoDB wishlist buttons initialized."
        );
    }


    /* ---------------------------------------------------------
       WATCH CURRENT YOUTUBE SONG
       --------------------------------------------------------- */

    function watchCurrentSong() {

        if (!youtubePlayer) {
            return;
        }

        try {

            const data =
                youtubePlayer.getVideoData();

            if (!data || !data.video_id) {
                return;
            }

            const videoId =
                data.video_id;

            /*
             * Song changed
             */
            if (
                lastWishlistVideoId !==
                videoId
            ) {

                lastWishlistVideoId =
                    videoId;

                /*
                 * Reset first so UI never
                 * shows previous song's heart.
                 */
                updateWishlistButtons(false);

                syncWishlistState(
                    videoId
                );
            }

        } catch (error) {

            /*
             * Player may not be ready yet.
             */
        }
    }


    /* ---------------------------------------------------------
       START
       --------------------------------------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initializeWishlistButtons();

            /*
             * Buttons can be rendered after
             * initial DOM load, so retry.
             */
            setTimeout(
                initializeWishlistButtons,
                500
            );

            setTimeout(
                initializeWishlistButtons,
                1500
            );

            /*
             * Watch current YouTube video.
             */
            setInterval(
                watchCurrentSong,
                1000
            );

        }
    );


    /* ---------------------------------------------------------
       EXPOSE FOR OTHER APP SCRIPTS
       --------------------------------------------------------- */

    window.NostalgicWishlist = {

        add: addCurrentSongToWishlist,

        remove: removeCurrentSongFromWishlist,

        toggle: toggleWishlist,

        sync: syncWishlistState,

        getCurrentSong:
            getCurrentWishlistSong
    };


})();
