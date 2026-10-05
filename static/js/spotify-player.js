/* ==========================================================================
   NOSTALGIC RADIO — SPOTIFY-STYLE EXPANDED NOW PLAYING VIEW
   Includes:
   - Rock-solid Play/Pause state synchronization
   - Web Audio Synthesized Warm Vinyl & Tape Crackle Hiss
   - Interactive 33 RPM Vinyl Spin Mode
   - Sleep Timer with Live Countdown (15m, 30m, 45m, 60m)
   - Vividh Bharati Nostalgia Diary & Personal Farwaish Dedication
   ========================================================================== */

(function () {
    let isShuffleActive = false;
    let isRepeatActive = false;
    let areLyricsExpanded = false;
    let isVinylViewActive = false;
    let isCrackleActive = false;
    let lastTrackData = null;

    // Sleep timer state
    let sleepTimerMinutes = 0;
    let sleepTimerSecondsRemaining = 0;
    let sleepTimerInterval = null;

    // Web Audio Synthesizer for Vinyl Crackle & Tape Hiss
    let audioCtx = null;
    let crackleNoiseNode = null;
    let crackleGainNode = null;
    let crackleFilterNode = null;
    let cracklePopsTimer = null;

    // Curated classic lyrics for golden nostalgic eras
    const ERA_LYRICS_DB = {
        "papa-era": [
            { text: "Pal bhar thehar jaao, dil yeh sambhal jaaye...", highlight: false },
            { text: "Chhup gaye saare nazaare, oye kya baat ho gayi...", highlight: true },
            { text: "Mere mehboob qayamat hogi, aaj ruswa teri galiyon mein mohabbat hogi...", highlight: false },
            { text: "Naam niklega tera hi lab se, jaan jab is dil-e-bimaar se rukhsat hogi", highlight: false },
            { text: "Kishore Da aur Rafi Sahab ki awaaz mein purane zamaane ki mehak...", highlight: false }
        ],
        "90s-era": [
            { text: "Zara si dil mein de jagah tu, zara sa apna le bana...", highlight: false },
            { text: "Main chaahoon tujh ko, meri jaan, bepanaah!", highlight: true },
            { text: "Zara sa khwaabon mein sajaa tu, zara sa yaadon mein basaa...", highlight: false },
            { text: "Fida hoon tujhpe meri jaan bepanaah, deewangi ki hadh se aage nikal gaya hoon main.", highlight: false }
        ],
        "2000s-era": [
            { text: "Tu hi meri shab hai, subah hai, tu hi din hai mera...", highlight: false },
            { text: "Woh lamhe, woh baatein, koi na jaane thi kaisi raatein...", highlight: true },
            { text: "Barsaatein, bheegi bheegi yaadein, dilon ke fasle mitayein...", highlight: false },
            { text: "Early 2000s ki befikr shaamein aur purani dosti ki yaadein.", highlight: false }
        ],
        "romantic": [
            { text: "Pehla nasha, pehla khumaar, naya pyaar hai naya intezaar...", highlight: false },
            { text: "Karta hai dil kya karun aye dil-e-beqaraar...", highlight: true },
            { text: "Udhne lage hai parwaz ki tarah hawaon mein hum...", highlight: false },
            { text: "Har lamha tere naam se shuru, tere naam pe khatam.", highlight: false }
        ],
        "sad": [
            { text: "Kabhi alvida na kehna, kabhi alvida na kehna...", highlight: false },
            { text: "Aankhon mein aansu leke hothon se muskuraaye...", highlight: true },
            { text: "Hum jaise jee rahe hain koi jee ke to bataaye...", highlight: false },
            { text: "Raat ke sannate mein baje yeh geet dard ko dhalne dete hain.", highlight: false }
        ],
        "lofi": [
            { text: "Chalte chalte yunhi koi mil gaya tha, sar-e-raah chalte chalte...", highlight: false },
            { text: "Dheemi dheemi lofi beats, baarish ki boondein aur purani yaadein...", highlight: true },
            { text: "Sukoon ka ek kona jahaan waqt thehar jaata hai.", highlight: false }
        ],
        "night-drive": [
            { text: "Khoya khoya chaand, khula aasmaan, mastiyon mein dhalta hua jahaan...", highlight: false },
            { text: "Sunsaan sadkein, thandi hawa aur stereo pe retro taraane...", highlight: true },
            { text: "Raat ki tanhaayi mein sangeet ek sathi ban jaata hai.", highlight: false }
        ]
    };

    // Mode-specific palette gradients
    const ERA_THEME_PALETTES = {
        "papa-era": { top: "#3a2213", mid: "#1a0f07", bottom: "#0a0603", glow: "rgba(255, 170, 51, 0.45)" },
        "90s-era": { top: "#3a0922", mid: "#18040d", bottom: "#0b0105", glow: "rgba(255, 51, 153, 0.45)" },
        "2000s-era": { top: "#092a3a", mid: "#031118", bottom: "#01070b", glow: "rgba(0, 217, 255, 0.45)" },
        "romantic": { top: "#3a0717", mid: "#170309", bottom: "#090104", glow: "rgba(255, 42, 109, 0.45)" },
        "sad": { top: "#0c1d32", mid: "#040b14", bottom: "#020509", glow: "rgba(57, 167, 255, 0.45)" },
        "lofi": { top: "#270c3c", mid: "#100418", bottom: "#07010b", glow: "rgba(180, 76, 255, 0.45)" },
        "punjabi-bangers": { top: "#233808", mid: "#0c1602", bottom: "#050901", glow: "rgba(166, 255, 0, 0.45)" },
        "bihar-bangers": { top: "#3a1608", mid: "#170702", bottom: "#0a0301", glow: "rgba(255, 85, 34, 0.45)" },
        "truck": { top: "#3a2908", mid: "#171002", bottom: "#0a0701", glow: "rgba(255, 189, 57, 0.45)" },
        "night-drive": { top: "#1e0f3d", mid: "#0c0519", bottom: "#05020c", glow: "rgba(139, 92, 246, 0.45)" }
    };

    // Vividh Bharati nostalgia anecdotes
    const NOSTALGIA_STORIES = [
        "1969 mein jab Rajesh Khanna aur Mumtaz ki 'Do Raaste' aayi thi, toh chai ki dukaanon par transistor radio par 'Chhup Gaye Sare Nazaare' sunne ke liye bheed lagti thi.",
        "Kishore Kumar studio mein gaate waqt mic ke aage naachte the! Unke records aane par log radio ke paas diary leke baithte the taaki bol likh sakein.",
        "Mohammad Rafi sahab ke zamaane mein recording live orchestra ke saath ek hi take mein hoti thi. 60 musicians ek saath bajate the bina kisi digital cut ke.",
        "90s ke cassette zamaane mein pencil se reel ko rewind karna har gharelu bache ka favourite time-pass hua karta tha.",
        "Vividh Bharati par raat 10 baje 'Chhaya Geet' sunte hue balcony mein baithkar thandi hawa mehsoos karna 90s ka sabse bada sukoon tha.",
        "R.D. Burman ne 'Chura Liya' ke shuruat mein glass par chammach maar kar beats record kiye the. Aise bane the woh evergreen taraane."
    ];
    let currentStoryIndex = 0;

    // Curated authentic song lists for all eras (Up Next queue)
    const ERA_TRACKS_DB = {
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
            { title: "Rinkiya Ke Papa", artist: "Manoj Tiwari", videoId: "k_Z-qL6W_u8", duration: "4:42" },
            { title: "Chhalakata Hamro Jawaniya", artist: "Pawan Singh & Priyanka", videoId: "3m0F7x1U_t8", duration: "3:58" },
            { title: "Piyawa Se Pahile Hamar Rahlu", artist: "Ritesh Pandey", videoId: "V_eP8m0k4q8", duration: "4:10" },
            { title: "Dhibri Me Rahue Na Tel", artist: "Khesari Lal Yadav", videoId: "Y7r8k_L1x3s", duration: "3:40" }
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
            { title: "Chalte Chalte (Midnight Lo-Fi)", artist: "Lata Mangeshkar Chill", videoId: "T7m6p_1U_w8", duration: "3:50" },
            { title: "Kabira (Rain Chill Lofi)", artist: "Tochi Raina & Rekha B.", videoId: "jHNNMj5bNQw", duration: "4:20" },
            { title: "Agar Tum Saath Ho (Lofi Sunset)", artist: "Arijit Singh & Alka Yagnik", videoId: "sK7riqg2mr4", duration: "4:35" },
            { title: "Phir Le Aya Dil (Lo-Fi Session)", artist: "Arijit Singh", videoId: "W-ZzX1tX9M8", duration: "5:05" }
        ],
        "sad": [
            { title: "Tujhe Bhula Diya", artist: "Mohit Chauhan & Shekhar", videoId: "0bA3b4v5M_0", duration: "4:39" },
            { title: "Channa Mereya", artist: "Arijit Singh • ADHM", videoId: "bzSTpdcs-EI", duration: "4:49" },
            { title: "Jag Soona Soona Lage", artist: "Rahat Fateh Ali Khan", videoId: "0T5K_L7m8N0", duration: "5:31" },
            { title: "Hamari Adhuri Kahani", artist: "Arijit Singh", videoId: "s-mE-rV8rJ8", duration: "6:38" },
            { title: "Main Dhoondne Ko Zamaane Mein", artist: "Arijit Singh", videoId: "6m7t8X_Y1Z0", duration: "4:50" }
        ],
        "romantic": [
            { title: "Tum Hi Ho", artist: "Arijit Singh • Aashiqui 2", videoId: "Umqb9KENgmk", duration: "4:22" },
            { title: "Raabta (Kehte Hain Khuda)", artist: "Arijit Singh & Hamsika", videoId: "z-diRlyLGgg", duration: "4:04" },
            { title: "Subhanallah", artist: "Sreerama Chandra • YJHD", videoId: "pE1q4T7Y8m8", duration: "4:09" },
            { title: "Janam Janam", artist: "Arijit Singh • Dilwale", videoId: "Z9AZT1K-T2o", duration: "3:58" },
            { title: "Kesariya", artist: "Arijit Singh • Brahmastra", videoId: "BddP6PYo2gs", duration: "4:28" }
        ],
        "truck": [
            { title: "Khaike Paan Banaraswala", artist: "Kishore Kumar • Don", videoId: "vH_sK2H2W_8", duration: "3:57" },
            { title: "Dum Maro Dum", artist: "Asha Bhosle • Hare Rama", videoId: "p9_sT7H8M_8", duration: "4:36" },
            { title: "Gaddi Leke Aaya", artist: "Udit Narayan • Gadar", videoId: "K1v8u9L1Z_0", duration: "4:45" },
            { title: "Babuji Zara Dheere Chalo", artist: "Sukhwinder Singh", videoId: "8v_T7m6p_1U", duration: "4:58" },
            { title: "Jumma Chumma De De", artist: "Sudesh Bhosle • Hum", videoId: "3m0F7x1U_t8", duration: "5:05" }
        ],
        "night-drive": [
            { title: "Khoya Khoya Chaand", artist: "Mohammed Rafi", videoId: "hZ7v_1U_w8M", duration: "4:42" },
            { title: "Musafir Hoon Yaaron", artist: "Kishore Kumar • Parichay", videoId: "0bA3b4v5M_8", duration: "3:08" },
            { title: "Dil Chahta Hai", artist: "Shankar Mahadevan", videoId: "5_6_tZkS2s8", duration: "5:11" },
            { title: "Safarnama", artist: "Lucky Ali • Tamasha", videoId: "7m8k_2Ww48M", duration: "4:11" },
            { title: "Hairat", artist: "Lucky Ali • Anjaana Anjaani", videoId: "Y0vT6Ld4e7M", duration: "4:19" }
        ]
    };

    function initSpotifyPlayer() {
        bindModalTriggers();
        bindPlaybackControls();
        bindScrollerStickyHeader();
        bindLyricsToggle();
        bindOptionsAndUtilities();
        bindVinylModeToggle();
        bindSleepTimer();
        bindShareModal();
        bindQueueModal();
        loadUserQueue();
        bindOptionsModal();
        bindNostalgiaDiary();
        hookSongChange();

        // Load saved dedication
        const savedDedication = localStorage.getItem("nostalgic_radio_dedication");
        if (savedDedication) {
            const el = document.getElementById("diary-dedication-text");
            if (el) el.textContent = `Dedicated to: ${savedDedication}`;
        }

        // Live progress sync loop
        setInterval(syncProgressState, 350);

        // Global callback for player.js state updates
        window.syncSpotifyPlayState = function (isPlaying) {
            syncPlayButtonIcon(isPlaying);
        };
    }

    /* ----------------------------------------------------
       OPEN & CLOSE MODAL HANDLERS
       ---------------------------------------------------- */
    function openSpotifyModal() {
        const modal = document.getElementById("spotify-player-modal");
        if (!modal) return;
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        if (lastTrackData) {
            updateSpotifyView(lastTrackData);
        } else {
            syncFromDOM();
        }
        syncPlayButtonIcon();
        syncLikeState();

        if (typeof window.setActiveAppView === "function") {
            window.setActiveAppView("player");
        }
    }

    function closeSpotifyModal() {
        const modal = document.getElementById("spotify-player-modal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        if (typeof window.setActiveAppView === "function" && typeof window.getActiveAppView === "function" && window.getActiveAppView() === "player") {
            window.setActiveAppView("home");
        }
    }

    window.openSpotifyPlayerModal = openSpotifyModal;
    window.closeSpotifyPlayerModal = closeSpotifyModal;

    function bindModalTriggers() {
        const musicPlayer = document.getElementById("music-player");
        if (musicPlayer) {
            musicPlayer.addEventListener("click", function (e) {
                if (e.target.closest("#play-button") ||
                    e.target.closest("#previous-button") ||
                    e.target.closest("#next-button") ||
                    e.target.closest("#like-button") ||
                    e.target.closest("#progress-control") ||
                    e.target.closest(".waveform-progress")) {
                    return;
                }
                openSpotifyModal();
            });
        }

        const expandBtn = document.getElementById("player-expand-btn");
        if (expandBtn) {
            expandBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                openSpotifyModal();
            });
        }

        const minimizeBtn = document.getElementById("spotify-minimize-btn");
        if (minimizeBtn) {
            minimizeBtn.addEventListener("click", function () {
                closeSpotifyModal();
            });
        }

        const backdrop = document.getElementById("spotify-backdrop");
        if (backdrop) {
            backdrop.addEventListener("click", function () {
                closeSpotifyModal();
            });
        }

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                const modal = document.getElementById("spotify-player-modal");
                if (modal && modal.classList.contains("open")) {
                    closeSpotifyModal();
                }
            }
        });
    }

    /* ----------------------------------------------------
       PLAYBACK CONTROLS (BIDIRECTIONAL SYNC)
       ---------------------------------------------------- */
    function bindPlaybackControls() {
        const spotifyPlayBtn = document.getElementById("spotify-play-btn");
        const stickyPlayBtn = document.getElementById("spotify-sticky-play-btn");

        function handlePlayToggle() {
            if (typeof togglePlayPause === "function") {
                togglePlayPause();
            } else {
                const mainPlayBtn = document.getElementById("play-button");
                if (mainPlayBtn) mainPlayBtn.click();
            }

            // Immediately check and update
            setTimeout(() => {
                syncPlayButtonIcon();
            }, 100);
        }

        if (spotifyPlayBtn) spotifyPlayBtn.addEventListener("click", handlePlayToggle);
        if (stickyPlayBtn) stickyPlayBtn.addEventListener("click", handlePlayToggle);

        const canvasTouchShield = document.getElementById("spotify-canvas-touch-shield");
        if (canvasTouchShield) {
            canvasTouchShield.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                handlePlayToggle();
            });
        }

        const spotifyNextBtn = document.getElementById("spotify-next-btn");
        if (spotifyNextBtn) {
            spotifyNextBtn.addEventListener("click", function () {
                if (typeof window.playNextFromQueue === "function" && window.playNextFromQueue()) {
                    return;
                }
                if (typeof nextSong === "function") {
                    nextSong();
                } else {
                    const mainNext = document.getElementById("next-button");
                    if (mainNext) mainNext.click();
                }
            });
        }

        const spotifyPrevBtn = document.getElementById("spotify-prev-btn");
        if (spotifyPrevBtn) {
            spotifyPrevBtn.addEventListener("click", function () {
                if (typeof previousSong === "function") {
                    previousSong();
                } else {
                    const mainPrev = document.getElementById("previous-button");
                    if (mainPrev) mainPrev.click();
                }
            });
        }

        const shuffleBtn = document.getElementById("spotify-shuffle-btn");
        if (shuffleBtn) {
            shuffleBtn.addEventListener("click", function () {
                isShuffleActive = !isShuffleActive;
                window.isShuffleActive = isShuffleActive;
                shuffleBtn.classList.toggle("active", isShuffleActive);
                if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.setShuffle) {
                    try { youtubePlayer.setShuffle(isShuffleActive); } catch(e){}
                }
                if (window.showToast) {
                    window.showToast(isShuffleActive ? "🔀 Era Shuffle: ON (Random songs enabled)" : "🔀 Era Shuffle: OFF");
                }
            });
        }

        const repeatBtn = document.getElementById("spotify-repeat-btn");
        if (repeatBtn) {
            repeatBtn.addEventListener("click", function () {
                isRepeatActive = !isRepeatActive;
                window.isRepeatActive = isRepeatActive;
                repeatBtn.classList.toggle("active", isRepeatActive);
                if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.setLoop) {
                    try { youtubePlayer.setLoop(isRepeatActive); } catch(e){}
                }
                if (window.showToast) {
                    window.showToast(isRepeatActive ? "🔁 Repeat Track: ON (Song will loop)" : "🔁 Repeat Track: OFF");
                }
            });
        }

        const spotifyLikeBtn = document.getElementById("spotify-like-btn");
        const stickyLikeBtn = document.getElementById("spotify-sticky-like-btn");

        function handleLikeClick(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof window.toggleWishlistCurrentSong === "function") {
                window.toggleWishlistCurrentSong();
            } else {
                const mainLikeBtn = document.getElementById("like-button");
                if (mainLikeBtn) mainLikeBtn.click();
            }
            setTimeout(syncLikeState, 60);
        }

        if (spotifyLikeBtn && spotifyLikeBtn.dataset.boundSpotifyLike !== "true") {
            spotifyLikeBtn.dataset.boundSpotifyLike = "true";
            spotifyLikeBtn.addEventListener("click", handleLikeClick);
        }
        if (stickyLikeBtn && stickyLikeBtn.dataset.boundSpotifyLike !== "true") {
            stickyLikeBtn.dataset.boundSpotifyLike = "true";
            stickyLikeBtn.addEventListener("click", handleLikeClick);
        }

        const progressSlider = document.getElementById("spotify-progress-slider");
        if (progressSlider) {
            progressSlider.addEventListener("input", function (e) {
                const targetPercent = parseFloat(e.target.value);
                if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.getDuration) {
                    const duration = youtubePlayer.getDuration() || 0;
                    if (duration > 0) {
                        const seekTime = (targetPercent / 100) * duration;
                        youtubePlayer.seekTo(seekTime, true);
                    }
                }
            });
        }
    }

    /* ----------------------------------------------------
       SPOTIFY CANVAS / ALBUM ART / VINYL 3-WAY VIEW TOGGLE
       ---------------------------------------------------- */
    let currentVisualMode = "art"; // Default to Album Art view as requested

    function setVisualMode(mode, showToastFeedback = false) {
        currentVisualMode = mode;
        try {
            localStorage.setItem("nostalgic_radio_visual_mode", mode);
        } catch (e) {}
        const sheetContainer = document.getElementById("spotify-sheet-container");
        const artCard = document.getElementById("spotify-art-card");
        const modeIcon = document.getElementById("spotify-art-mode-icon");
        const modeText = document.getElementById("spotify-art-mode-text");

        if (sheetContainer) {
            sheetContainer.classList.remove("mode-canvas", "mode-art", "mode-vinyl");
            sheetContainer.classList.add(`mode-${mode}`);
        }
        if (artCard) {
            artCard.classList.toggle("vinyl-active", mode === "vinyl");
        }

        if (mode === "canvas") {
            if (modeIcon) modeIcon.textContent = "🎥";
            if (modeText) modeText.textContent = "Canvas Video";
            if (showToastFeedback && window.showToast) window.showToast("🎥 Spotify Canvas Video: Active");
        } else if (mode === "art") {
            if (modeIcon) modeIcon.textContent = "🖼️";
            if (modeText) modeText.textContent = "Album Art";
            if (showToastFeedback && window.showToast) window.showToast("🖼️ Album Art View: Active");
        } else if (mode === "vinyl") {
            if (modeIcon) modeIcon.textContent = "💿";
            if (modeText) modeText.textContent = "Vinyl View";
            if (showToastFeedback && window.showToast) window.showToast("💿 33 RPM Vinyl Mode: Active");
        }
    }

    function bindVinylModeToggle() {
        const toggleBtn = document.getElementById("spotify-art-toggle-btn");

        // Initialize default view to Album Art (or saved preference)
        const savedVisualMode = localStorage.getItem("nostalgic_radio_visual_mode") || "art";
        setVisualMode(savedVisualMode, false);

        function cycleVisualMode() {
            if (currentVisualMode === "art") {
                setVisualMode("vinyl", true);
            } else if (currentVisualMode === "vinyl") {
                setVisualMode("canvas", true);
            } else {
                setVisualMode("art", true);
            }
        }

        if (toggleBtn) {
            toggleBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                cycleVisualMode();
            });
        }
    }

    /* ----------------------------------------------------
       WARM VINYL CRACKLE & TAPE HISS SYNTHESIZER
       ---------------------------------------------------- */
    function initVinylCrackleAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();

            // Generate 4 seconds of warm analog tape noise
            const bufferSize = audioCtx.sampleRate * 4;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02; // soft pink-ish noise
                lastOut = output[i];
            }

            crackleNoiseNode = audioCtx.createBufferSource();
            crackleNoiseNode.buffer = noiseBuffer;
            crackleNoiseNode.loop = true;

            // Low-pass filter for vintage warmth
            crackleFilterNode = audioCtx.createBiquadFilter();
            crackleFilterNode.type = "lowpass";
            crackleFilterNode.frequency.value = 1100;

            // Gain volume
            crackleGainNode = audioCtx.createGain();
            crackleGainNode.gain.value = 0.06;

            crackleNoiseNode.connect(crackleFilterNode);
            crackleFilterNode.connect(crackleGainNode);
            crackleGainNode.connect(audioCtx.destination);
            crackleNoiseNode.start(0);

            // Pop / click generator
            cracklePopsTimer = setInterval(() => {
                if (!isCrackleActive || !audioCtx) return;
                if (Math.random() > 0.45) {
                    playVinylClick(audioCtx);
                }
            }, 300);

        } catch (e) {
            console.warn("Could not start Web Audio crackle:", e);
        }
    }

    function playVinylClick(ctx) {
        try {
            const clickOsc = ctx.createOscillator();
            const clickGain = ctx.createGain();
            const clickFilter = ctx.createBiquadFilter();

            clickFilter.type = "bandpass";
            clickFilter.frequency.value = 1800 + Math.random() * 800;

            clickOsc.type = "sawtooth";
            clickOsc.frequency.setValueAtTime(300 + Math.random() * 600, ctx.currentTime);

            clickGain.gain.setValueAtTime(0.04, ctx.currentTime);
            clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);

            clickOsc.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(ctx.destination);

            clickOsc.start();
            clickOsc.stop(ctx.currentTime + 0.03);
        } catch (e) {}
    }

    function toggleVinylCrackle() {
        const crackleBtn = document.getElementById("spotify-crackle-btn");
        isCrackleActive = !isCrackleActive;

        if (isCrackleActive) {
            if (!audioCtx) {
                initVinylCrackleAudio();
            } else if (audioCtx.state === "suspended") {
                audioCtx.resume();
            }
            if (crackleGainNode) crackleGainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
            if (crackleBtn) crackleBtn.classList.add("active");
            if (window.showToast) window.showToast("📻 Warm Vinyl Crackle & Tape Hiss: ON");
        } else {
            if (crackleGainNode && audioCtx) {
                crackleGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            }
            if (crackleBtn) crackleBtn.classList.remove("active");
            if (window.showToast) window.showToast("📻 Warm Vinyl Crackle: OFF");
        }
    }

    /* ----------------------------------------------------
       LATE-NIGHT SLEEP TIMER (CHHALTA WAQT)
       ---------------------------------------------------- */
    function bindSleepTimer() {
        const timerBtn = document.getElementById("spotify-timer-btn");
        const badge = document.getElementById("spotify-timer-badge");

        const durations = [0, 15, 30, 45, 60];

        function stopAllAudioForSleep() {
            if (sleepTimerInterval) {
                clearInterval(sleepTimerInterval);
                sleepTimerInterval = null;
            }
            sleepTimerMinutes = 0;
            sleepTimerSecondsRemaining = 0;
            if (badge) badge.style.display = "none";
            if (timerBtn) {
                timerBtn.classList.remove("active");
                timerBtn.title = "Sleep Timer (15m, 30m, 45m, 60m)";
            }

            // Gently pause YouTube
            if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.pauseVideo) {
                try { youtubePlayer.pauseVideo(); } catch (e) {}
            }

            // Stop vinyl crackle noise
            if (isCrackleActive) {
                toggleVinylCrackle();
            }

            // Stop rain ambience
            if (typeof window.stopRainAudio === "function") {
                try { window.stopRainAudio(); } catch (e) {}
            }

            // Stop animations & update buttons
            if (typeof window.syncSpotifyPlayState === "function") {
                window.syncSpotifyPlayState(false);
            }
            const mainPlayBtn = document.getElementById("play-button");
            if (mainPlayBtn) mainPlayBtn.textContent = "▶";

            const albumArt = document.getElementById("album-art");
            if (albumArt) albumArt.classList.remove("playing");
            const musicPlayer = document.querySelector(".music-player");
            if (musicPlayer) musicPlayer.classList.remove("playing");

            if (window.showToast) {
                window.showToast("🌙 Radiowa band ho gaya hai... Shubh Ratri! 📻", 5000);
            }
        }

        if (timerBtn) {
            timerBtn.addEventListener("click", function () {
                const currentIndex = durations.indexOf(sleepTimerMinutes);
                const nextIndex = (currentIndex + 1) % durations.length;
                sleepTimerMinutes = durations[nextIndex];

                if (sleepTimerInterval) {
                    clearInterval(sleepTimerInterval);
                    sleepTimerInterval = null;
                }

                if (sleepTimerMinutes === 0) {
                    if (badge) badge.style.display = "none";
                    timerBtn.classList.remove("active");
                    timerBtn.title = "Sleep Timer (15m, 30m, 45m, 60m)";
                    if (window.showToast) window.showToast("⏱ Sleep Timer: OFF");
                } else {
                    sleepTimerSecondsRemaining = sleepTimerMinutes * 60;
                    timerBtn.classList.add("active");
                    if (badge) {
                        badge.style.display = "inline-block";
                        badge.textContent = `${sleepTimerMinutes}m`;
                    }
                    timerBtn.title = `Sleep Timer: ${sleepTimerMinutes}m remaining (click to change)`;
                    if (window.showToast) {
                        window.showToast(`🌙 Sleep Timer set for ${sleepTimerMinutes} minutes`);
                    }

                    sleepTimerInterval = setInterval(() => {
                        sleepTimerSecondsRemaining--;
                        if (sleepTimerSecondsRemaining <= 0) {
                            stopAllAudioForSleep();
                        } else {
                            const mins = Math.ceil(sleepTimerSecondsRemaining / 60);
                            if (badge) badge.textContent = `${mins}m`;
                            timerBtn.title = `Sleep Timer: ${mins}m remaining (click to change)`;
                        }
                    }, 1000);
                }
            });
        }
    }

    /* ----------------------------------------------------
       VIVIDH BHARATI NOSTALGIA DIARY & FARWAISH
       ---------------------------------------------------- */
    function bindNostalgiaDiary() {
        const nextBtn = document.getElementById("diary-next-trivia-btn");
        const storyEl = document.getElementById("diary-story-text");
        const editDedicationBtn = document.getElementById("diary-edit-dedication-btn");
        const dedicationText = document.getElementById("diary-dedication-text");

        if (nextBtn && storyEl) {
            nextBtn.addEventListener("click", function () {
                currentStoryIndex = (currentStoryIndex + 1) % NOSTALGIA_STORIES.length;
                storyEl.style.opacity = "0";
                setTimeout(() => {
                    storyEl.textContent = `"${NOSTALGIA_STORIES[currentStoryIndex]}"`;
                    storyEl.style.opacity = "1";
                }, 200);
            });
        }

        if (editDedicationBtn && dedicationText) {
            editDedicationBtn.addEventListener("click", function () {
                const userText = prompt("Kiske naam karna chahenge yeh geet? (e.g. Papa's chai time, School yaadein):", "Papa's chai time & monsoon memories");
                if (userText && userText.trim()) {
                    const clean = userText.trim();
                    localStorage.setItem("nostalgic_radio_dedication", clean);
                    dedicationText.textContent = `Dedicated to: ${clean} ☕`;
                    if (window.showToast) window.showToast("✨ Memory dedication saved!");
                }
            });
        }
    }

    /* ----------------------------------------------------
       STICKY HEADER ON SCROLL (SCREENSHOT 3)
       ---------------------------------------------------- */
    function bindScrollerStickyHeader() {
        const scroller = document.getElementById("spotify-scroll-viewport");
        const stickyHeader = document.getElementById("spotify-sticky-header");

        if (scroller && stickyHeader) {
            scroller.addEventListener("scroll", function () {
                if (scroller.scrollTop > 240) {
                    stickyHeader.classList.add("visible");
                } else {
                    stickyHeader.classList.remove("visible");
                }
            });
        }
    }

    /* ----------------------------------------------------
       LYRICS TOGGLE & LIVE HIGHLIGHTING PREVIEW
       ---------------------------------------------------- */
    let currentActiveLyricIdx = 0;

    function bindLyricsToggle() {
        const toggleBtn = document.getElementById("spotify-toggle-lyrics-btn");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", function () {
                areLyricsExpanded = !areLyricsExpanded;
                toggleBtn.textContent = areLyricsExpanded ? "Collapse lyrics" : "Show lyrics";
                renderLyricsLines();
            });
        }
    }

    function renderLyricsLines() {
        const linesContainer = document.getElementById("spotify-lyrics-lines");
        if (!linesContainer) return;

        const modeId = (lastTrackData && lastTrackData.mode) ? lastTrackData.mode.id : "papa-era";
        const lyricsList = ERA_LYRICS_DB[modeId] || ERA_LYRICS_DB["papa-era"];

        linesContainer.innerHTML = "";
        const visibleLines = areLyricsExpanded ? lyricsList : lyricsList.slice(0, 3);

        visibleLines.forEach((line, idx) => {
            const p = document.createElement("p");
            const isHighlighted = idx === currentActiveLyricIdx;
            p.className = "lyric-line" + (isHighlighted ? " highlight" : "");
            p.textContent = line.text;
            p.style.cursor = "pointer";
            p.title = "Tap to jump song here";
            p.dataset.index = idx;

            p.addEventListener("click", function () {
                currentActiveLyricIdx = idx;
                linesContainer.querySelectorAll(".lyric-line").forEach(el => el.classList.remove("highlight"));
                p.classList.add("highlight");

                // Jump YouTube player to this section of the song
                if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.getDuration && youtubePlayer.seekTo) {
                    const dur = youtubePlayer.getDuration() || 0;
                    if (dur > 0) {
                        const targetTime = (idx / visibleLines.length) * dur;
                        youtubePlayer.seekTo(targetTime, true);
                    }
                }
                if (window.showToast) {
                    window.showToast(`🎶 "${line.text.slice(0, 35)}..."`);
                }
            });

            linesContainer.appendChild(p);
        });
    }

    function syncLyricsHighlight(currentTime, duration) {
        const linesContainer = document.getElementById("spotify-lyrics-lines");
        if (!linesContainer) return;

        const lines = linesContainer.querySelectorAll(".lyric-line");
        if (!lines || lines.length === 0 || duration <= 0) return;

        // Calculate which lyric line matches the current playback progress
        const ratio = Math.max(0, Math.min(0.999, currentTime / duration));
        const activeIdx = Math.floor(ratio * lines.length);

        if (activeIdx !== currentActiveLyricIdx) {
            currentActiveLyricIdx = activeIdx;
            lines.forEach((p, idx) => {
                if (idx === activeIdx) {
                    p.classList.add("highlight");
                    if (areLyricsExpanded) {
                        p.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                } else {
                    p.classList.remove("highlight");
                }
            });
        }
    }

    /* ----------------------------------------------------
       UP NEXT QUEUE (AUTHENTIC SONGS FROM ACTIVE ERA)
       ---------------------------------------------------- */
    function renderUpNextQueue(mode) {
        const container = document.getElementById("spotify-explore-cards");
        const titleEl = document.getElementById("spotify-explore-title");
        const countEl = document.getElementById("spotify-queue-count");
        if (!container) return;

        const eraName = mode ? mode.name : (lastTrackData && lastTrackData.mode ? lastTrackData.mode.name : "Nostalgic Radio");
        const modeId = (mode && mode.id) ? mode.id : (lastTrackData && lastTrackData.mode ? lastTrackData.mode.id : "papa-era");

        if (titleEl) titleEl.textContent = `Up Next in ${eraName} • Agle Gaane`;

        const tracks = ERA_TRACKS_DB[modeId] || ERA_TRACKS_DB["papa-era"];
        window.currentEraTracks = tracks;

        // Current playing videoId and title
        const currentVideoId = (lastTrackData && lastTrackData.videoId) ? lastTrackData.videoId : null;
        const currentTitle = (lastTrackData && lastTrackData.title) ? lastTrackData.title.toLowerCase() : "";

        // Filter out currently playing song so that user sees UP NEXT songs!
        let nextSongs = tracks.filter(t => {
            if (currentVideoId && t.videoId === currentVideoId) return false;
            if (currentTitle && t.title.toLowerCase() === currentTitle) return false;
            return true;
        });

        if (nextSongs.length === 0) {
            nextSongs = tracks;
        }

        if (countEl) {
            countEl.textContent = `${nextSongs.length} upcoming songs`;
        }

        container.innerHTML = "";
        nextSongs.forEach((song, idx) => {
            const card = document.createElement("div");
            card.className = "spotify-explore-card spotify-upnext-card";
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.title = `Click to play: ${song.title} (${song.artist})`;

            const badgeText = idx === 0 ? "UP NEXT" : `#${idx + 1} IN QUEUE`;
            const thumbUrl = song.videoId ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg` : "";
            const fallbackBg = mode && mode.background ? `/static/images/backgrounds/${mode.background}` : "/static/images/backgrounds/papa-era.jpeg";
            const initialSrc = thumbUrl || fallbackBg;

            card.innerHTML = `
                <div class="upnext-badge">${badgeText}</div>
                <div class="upnext-img-wrap">
                    <img src="${initialSrc}" alt="${song.title}" loading="lazy" class="upnext-thumb-img"
                        onload="if (this.naturalWidth <= 120 && !this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${fallbackBg}'; }"
                        onerror="if (!this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${fallbackBg}'; }">
                    <div class="upnext-play-overlay">
                        <span class="upnext-play-btn">▶</span>
                    </div>
                </div>
                <div class="spotify-explore-card-title">
                    <div class="upnext-song-name">${song.title}</div>
                    <div class="upnext-song-meta">
                        <span>${song.artist}</span>
                        ${song.duration ? `<span class="upnext-duration">• ${song.duration}</span>` : ""}
                    </div>
                    <div class="explore-card-actions">
                        <button class="card-quick-queue-btn" type="button" title="Add to Queue">+ Queue</button>
                    </div>
                </div>
            `;

            const quickQueueBtn = card.querySelector(".card-quick-queue-btn");
            if (quickQueueBtn) {
                quickQueueBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    addToPlaybackQueue(song);
                });
            }

            function handlePlayThisSong() {
                if (typeof window.playSongById === "function") {
                    window.playSongById(song.videoId, song.title, song.artist);
                } else if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.loadVideoById) {
                    youtubePlayer.loadVideoById(song.videoId);
                    youtubePlayer.playVideo();
                }
                if (window.showToast) {
                    window.showToast(`▶ Playing Next: ${song.title} 🎶`);
                }
                // Re-render queue with this song active
                setTimeout(() => {
                    renderUpNextQueue(mode);
                }, 300);
            }

            card.addEventListener("click", handlePlayThisSong);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlayThisSong();
                }
            });

            container.appendChild(card);
        });
    }

    function renderCredits(trackData) {
        const list = document.getElementById("spotify-credits-list");
        if (!list) return;

        const mainArtist = trackData && trackData.author ? trackData.author.split("-")[0].trim() : "Kishore Kumar";
        const modeName = trackData && trackData.mode ? trackData.mode.name : "Papa's Era";

        const credits = [
            { name: mainArtist, role: "Main Artist • Singer", following: false },
            { name: modeName + " Orchestra", role: "Music Director • Composer", following: true },
            { name: "Majrooh Sultanpuri", role: "Lyricist • Golden Poetry", following: false }
        ];

        list.innerHTML = "";
        credits.forEach(credit => {
            const row = document.createElement("div");
            row.className = "credits-row-item";
            row.innerHTML = `
                <div class="credits-author-info">
                    <h4>${credit.name}</h4>
                    <p>${credit.role}</p>
                </div>
                <button type="button" class="credits-follow-btn ${credit.following ? "following" : ""}">
                    ${credit.following ? "Following" : "Follow"}
                </button>
            `;

            const btn = row.querySelector(".credits-follow-btn");
            btn.addEventListener("click", function () {
                const isNowFollowing = !btn.classList.contains("following");
                btn.classList.toggle("following", isNowFollowing);
                btn.textContent = isNowFollowing ? "Following" : "Follow";
                if (window.showToast) {
                    window.showToast(isNowFollowing ? `Followed ${credit.name}` : `Unfollowed ${credit.name}`);
                }
            });

            list.appendChild(row);
        });
    }

    /* ----------------------------------------------------
       OPTIONS & SECONDARY UTILITY ACTIONS
       ---------------------------------------------------- */
    function bindOptionsAndUtilities() {
        const visualizerBtn = document.getElementById("spotify-visualizer-btn");
        if (visualizerBtn) {
            visualizerBtn.addEventListener("click", function () {
                const screensaverBtn = document.getElementById("screensaver-button");
                if (screensaverBtn) {
                    closeSpotifyModal();
                    screensaverBtn.click();
                } else {
                    if (window.showToast) window.showToast("Visualizer mode active ✨");
                }
            });
        }

        const crackleBtn = document.getElementById("spotify-crackle-btn");
        if (crackleBtn) {
            crackleBtn.addEventListener("click", function () {
                toggleVinylCrackle();
            });
        }

        const shareBtn = document.getElementById("spotify-share-btn");
        if (shareBtn) {
            shareBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                if (typeof window.openShareModal === "function") {
                    window.openShareModal();
                }
            });
        }

        const queueBtn = document.getElementById("spotify-queue-btn");
        if (queueBtn) {
            queueBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                openQueueModal();
            });
        }

        const optionsBtn = document.getElementById("spotify-options-btn");
        if (optionsBtn) {
            optionsBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                openOptionsModal();
            });
        }
    }

    /* ----------------------------------------------------
       SHARE MODAL LOGIC (WHATSAPP, TWITTER, CLIPBOARD)
       ---------------------------------------------------- */
    function bindShareModal() {
        const shareModal = document.getElementById("spotify-share-modal");
        const closeBtn = document.getElementById("close-share-modal");
        const whatsappBtn = document.getElementById("share-btn-whatsapp");
        const twitterBtn = document.getElementById("share-btn-twitter");
        const copyBtn = document.getElementById("share-btn-copy");
        const quickCopyBtn = document.getElementById("share-quick-copy-btn");
        const nativeBtn = document.getElementById("share-btn-native");
        const linkInput = document.getElementById("share-link-input");
        const modalImg = document.getElementById("share-modal-img");
        const modalTitle = document.getElementById("share-modal-song-title");
        const modalArtist = document.getElementById("share-modal-song-artist");

        function openShare() {
            if (!shareModal) return;

            const title = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
            const artist = (lastTrackData && lastTrackData.author) ? lastTrackData.author : "Vintage Melodies";
            const mode = (lastTrackData && lastTrackData.mode) ? lastTrackData.mode.name : "Golden Era";
            const videoId = (lastTrackData && lastTrackData.videoId) ? lastTrackData.videoId : "";

            const shareUrl = window.location.origin + (videoId ? `/?v=${videoId}#player` : "");

            if (modalTitle) modalTitle.textContent = title;
            if (modalArtist) modalArtist.textContent = `${artist} • ${mode}`;
            if (modalImg) {
                if (videoId) {
                    modalImg.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                } else {
                    modalImg.src = "/static/images/backgrounds/papa-era.jpeg";
                }
            }
            if (linkInput) linkInput.value = shareUrl;

            // Show native share option on mobile/tablets if supported
            if (nativeBtn) {
                nativeBtn.style.display = (typeof navigator !== "undefined" && navigator.share) ? "flex" : "none";
            }

            shareModal.style.zIndex = "1000005";
            shareModal.classList.add("open");
            shareModal.setAttribute("aria-hidden", "false");
        }

        window.openShareModal = openShare;

        function closeShare() {
            if (!shareModal) return;
            shareModal.classList.remove("open");
            shareModal.setAttribute("aria-hidden", "true");
        }

        function copyLinkToClipboard() {
            const url = (linkInput && linkInput.value) ? linkInput.value : window.location.href;
            const copyLabel = document.getElementById("share-copy-label");
            
            function onCopied() {
                if (copyLabel) copyLabel.textContent = "Copied! ✨";
                if (quickCopyBtn) quickCopyBtn.textContent = "Copied! ✓";
                if (window.showToast) window.showToast("🔗 Song link copied to clipboard!");
                setTimeout(() => {
                    if (copyLabel) copyLabel.textContent = "Copy Link";
                    if (quickCopyBtn) quickCopyBtn.textContent = "Copy";
                }, 2500);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(onCopied).catch(() => {
                    fallbackCopy(url, onCopied);
                });
            } else {
                fallbackCopy(url, onCopied);
            }
        }

        function fallbackCopy(text, cb) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand("copy");
                if (cb) cb();
            } catch (err) {
                if (window.showToast) window.showToast("Copied to clipboard!");
            }
            document.body.removeChild(textArea);
        }

        if (closeBtn) closeBtn.addEventListener("click", closeShare);

        if (shareModal) {
            shareModal.addEventListener("click", function (e) {
                if (e.target === shareModal) closeShare();
            });
        }

        if (whatsappBtn) {
            whatsappBtn.addEventListener("click", function () {
                const title = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
                const shareUrl = (linkInput && linkInput.value) ? linkInput.value : window.location.href;
                const msg = `📻 Suno na! "${title}" on Nostalgic Radio: ${shareUrl}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
            });
        }

        const telegramBtn = document.getElementById("share-btn-telegram");
        if (telegramBtn) {
            telegramBtn.addEventListener("click", function () {
                const title = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
                const shareUrl = (linkInput && linkInput.value) ? linkInput.value : window.location.href;
                const msg = `📻 Listening to "${title}" on Nostalgic Radio!`;
                window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(msg)}`, "_blank");
            });
        }

        if (twitterBtn) {
            twitterBtn.addEventListener("click", function () {
                const title = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
                const shareUrl = (linkInput && linkInput.value) ? linkInput.value : window.location.href;
                const msg = `Tuning into "${title}" on Nostalgic Radio 📻 #RetroVibes #NostalgicRadio`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
            });
        }

        if (copyBtn) copyBtn.addEventListener("click", copyLinkToClipboard);
        if (quickCopyBtn) quickCopyBtn.addEventListener("click", copyLinkToClipboard);

        if (nativeBtn) {
            nativeBtn.addEventListener("click", function () {
                const title = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
                const shareUrl = (linkInput && linkInput.value) ? linkInput.value : window.location.href;
                if (navigator.share) {
                    navigator.share({
                        title: title,
                        text: `Listening to "${title}" on Nostalgic Radio 📻`,
                        url: shareUrl
                    }).catch(() => {});
                }
            });
        }
    }

    /* ----------------------------------------------------
       PLAYBACK QUEUE SYSTEM (AANE WALE GAANE)
       ---------------------------------------------------- */
    let userPlaybackQueue = [];
    const STORAGE_KEY_QUEUE = "nostalgic_radio_user_queue";

    function loadUserQueue() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
            userPlaybackQueue = raw ? JSON.parse(raw) : [];
        } catch (e) {
            userPlaybackQueue = [];
        }
    }

    function saveUserQueue() {
        try {
            localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(userPlaybackQueue));
        } catch (e) {}
    }

    function addToPlaybackQueue(track) {
        if (!track || !track.title) return;
        const songItem = {
            title: track.title,
            artist: track.artist || (track.author ? track.author.split("-")[0].trim() : "Nostalgic Radio"),
            videoId: track.videoId || "",
            duration: track.duration || "4:00"
        };
        userPlaybackQueue.push(songItem);
        saveUserQueue();
        renderQueueModal();
        if (window.showToast) {
            window.showToast(`🎶 Added to Queue: "${songItem.title}"`);
        }
    }

    function removeFromPlaybackQueue(index) {
        if (index >= 0 && index < userPlaybackQueue.length) {
            const removed = userPlaybackQueue.splice(index, 1)[0];
            saveUserQueue();
            renderQueueModal();
            if (window.showToast) {
                window.showToast(`Removed "${removed.title}" from queue`);
            }
        }
    }

    function clearPlaybackQueue() {
        userPlaybackQueue = [];
        saveUserQueue();
        renderQueueModal();
        if (window.showToast) {
            window.showToast("Queue cleared ✨");
        }
    }

    function playFromPlaybackQueue(index) {
        if (index >= 0 && index < userPlaybackQueue.length) {
            const track = userPlaybackQueue.splice(index, 1)[0];
            saveUserQueue();
            renderQueueModal();
            if (typeof window.playSongById === "function") {
                window.playSongById(track.videoId, track.title, track.artist);
            } else if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.loadVideoById) {
                youtubePlayer.loadVideoById(track.videoId);
                youtubePlayer.playVideo();
            }
            if (window.showToast) {
                window.showToast(`▶ Now Playing: ${track.title} 🎵`);
            }
            closeQueueModal();
        }
    }

    function playNextFromQueue() {
        if (userPlaybackQueue && userPlaybackQueue.length > 0) {
            const track = userPlaybackQueue.shift();
            saveUserQueue();
            renderQueueModal();
            if (typeof window.playSongById === "function") {
                window.playSongById(track.videoId, track.title, track.artist);
            } else if (typeof youtubePlayer !== "undefined" && youtubePlayer && youtubePlayer.loadVideoById) {
                youtubePlayer.loadVideoById(track.videoId);
                youtubePlayer.playVideo();
            }
            if (window.showToast) {
                window.showToast(`▶ Up Next from Queue: ${track.title} 🎵`);
            }
            return true;
        }
        return false;
    }

    window.playNextFromQueue = playNextFromQueue;
    window.addToPlaybackQueue = addToPlaybackQueue;

    function renderQueueModal() {
        const queueModal = document.getElementById("spotify-queue-modal");
        if (!queueModal) return;

        // 1. Now Playing
        const nowArt = document.getElementById("queue-now-art");
        const nowTitle = document.getElementById("queue-now-title");
        const nowArtist = document.getElementById("queue-now-artist");

        const curTitle = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
        const curArtist = (lastTrackData && lastTrackData.author) ? lastTrackData.author : "Vintage Collection";
        const curVideoId = (lastTrackData && lastTrackData.videoId) ? lastTrackData.videoId : null;

        const activeMode = (lastTrackData && lastTrackData.mode) ? lastTrackData.mode : null;
        const curFallback = (activeMode && activeMode.background) ? `/static/images/backgrounds/${activeMode.background}` : "/static/images/backgrounds/papa-era.jpeg";

        if (nowTitle) nowTitle.textContent = curTitle;
        if (nowArtist) nowArtist.textContent = curArtist;
        if (nowArt) {
            nowArt.src = curVideoId ? `https://img.youtube.com/vi/${curVideoId}/hqdefault.jpg` : curFallback;
            nowArt.onload = function() {
                if (this.naturalWidth <= 120 && !this.dataset.fallbackDone) {
                    this.dataset.fallbackDone = '1';
                    this.src = curFallback;
                }
            };
            nowArt.onerror = function() {
                if (!this.dataset.fallbackDone) {
                    this.dataset.fallbackDone = '1';
                    this.src = curFallback;
                }
            };
        }

        // 2. User Queue List
        const countBadge = document.getElementById("user-queue-count");
        const userList = document.getElementById("user-queue-list");
        if (countBadge) countBadge.textContent = `${userPlaybackQueue.length} song${userPlaybackQueue.length === 1 ? "" : "s"}`;

        if (userList) {
            userList.innerHTML = "";
            if (userPlaybackQueue.length === 0) {
                userList.innerHTML = `<p class="queue-empty-msg">Aapne abhi koi gaana queue mein nahi dala. Neeche se gaane "+ Queue" karein!</p>`;
            } else {
                userPlaybackQueue.forEach((item, idx) => {
                    const row = document.createElement("div");
                    row.className = "queue-item-row";
                    const thumb = item.videoId ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` : curFallback;

                    row.innerHTML = `
                        <span class="queue-row-index">#${idx + 1}</span>
                        <img src="${thumb}" class="queue-item-thumb" alt="${item.title}" loading="lazy"
                            onload="if (this.naturalWidth <= 120 && !this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${curFallback}'; }"
                            onerror="if (!this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${curFallback}'; }">
                        <div class="queue-item-info">
                            <span class="queue-item-title">${item.title}</span>
                            <span class="queue-item-artist">${item.artist} ${item.duration ? `• ${item.duration}` : ""}</span>
                        </div>
                        <div class="queue-row-actions">
                            <button type="button" class="queue-play-now-btn" title="Play Now">▶</button>
                            <button type="button" class="queue-remove-btn" title="Remove from queue">✕</button>
                        </div>
                    `;

                    row.querySelector(".queue-play-now-btn").addEventListener("click", () => playFromPlaybackQueue(idx));
                    row.querySelector(".queue-remove-btn").addEventListener("click", () => removeFromPlaybackQueue(idx));

                    userList.appendChild(row);
                });
            }
        }

        // 3. Era Upcoming Tracks List
        const eraList = document.getElementById("era-queue-list");
        const eraTitle = document.getElementById("era-queue-section-title");
        const modeId = activeMode ? activeMode.id : "papa-era";
        const modeName = activeMode ? activeMode.name : "Papa's Era";

        if (eraTitle) eraTitle.textContent = `NEXT FROM ${modeName.toUpperCase()}`;

        if (eraList) {
            const eraTracks = ERA_TRACKS_DB[modeId] || ERA_TRACKS_DB["papa-era"];
            eraList.innerHTML = "";
            eraTracks.slice(0, 8).forEach((item, idx) => {
                const row = document.createElement("div");
                row.className = "queue-item-row";
                const thumb = item.videoId ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` : curFallback;

                row.innerHTML = `
                    <span class="queue-row-index">${idx + 1}</span>
                    <img src="${thumb}" class="queue-item-thumb" alt="${item.title}" loading="lazy"
                        onload="if (this.naturalWidth <= 120 && !this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${curFallback}'; }"
                        onerror="if (!this.dataset.fallbackDone) { this.dataset.fallbackDone='1'; this.src='${curFallback}'; }">
                    <div class="queue-item-info">
                        <span class="queue-item-title">${item.title}</span>
                        <span class="queue-item-artist">${item.artist} ${item.duration ? `• ${item.duration}` : ""}</span>
                    </div>
                    <div class="queue-row-actions">
                        <button type="button" class="queue-add-pill-btn" title="Add to Queue">+ Queue</button>
                        <button type="button" class="queue-play-now-btn" title="Play Now">▶</button>
                    </div>
                `;

                row.querySelector(".queue-add-pill-btn").addEventListener("click", () => addToPlaybackQueue(item));
                row.querySelector(".queue-play-now-btn").addEventListener("click", () => {
                    if (typeof window.playSongById === "function") {
                        window.playSongById(item.videoId, item.title, item.artist);
                    }
                    closeQueueModal();
                });

                eraList.appendChild(row);
            });
        }
    }

    function openQueueModal() {
        const modal = document.getElementById("spotify-queue-modal");
        if (!modal) return;
        renderQueueModal();
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeQueueModal() {
        const modal = document.getElementById("spotify-queue-modal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }

    function bindQueueModal() {
        const modal = document.getElementById("spotify-queue-modal");
        const backdrop = document.getElementById("spotify-queue-backdrop");
        const closeBtn = document.getElementById("queue-close-btn");
        const clearBtn = document.getElementById("queue-clear-btn");
        const addBtn = document.getElementById("queue-custom-add-btn");
        const customInput = document.getElementById("queue-custom-input");

        if (backdrop) backdrop.addEventListener("click", closeQueueModal);
        if (closeBtn) closeBtn.addEventListener("click", closeQueueModal);
        if (clearBtn) clearBtn.addEventListener("click", clearPlaybackQueue);

        function handleCustomAdd() {
            if (!customInput) return;
            const text = customInput.value.trim();
            if (!text) return;

            let videoId = "";
            let songTitle = text;

            // Check if YouTube URL was pasted
            const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
            const match = text.match(ytRegex);
            if (match && match[1]) {
                videoId = match[1];
                songTitle = `Requested Song (${videoId.substring(0, 5)}...)`;
            }

            addToPlaybackQueue({
                title: songTitle,
                artist: "Custom Request • Queue",
                videoId: videoId,
                duration: "Custom"
            });

            customInput.value = "";
        }

        if (addBtn) addBtn.addEventListener("click", handleCustomAdd);
        if (customInput) {
            customInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleCustomAdd();
                }
            });
        }

        window.openQueueModal = openQueueModal;
        window.closeQueueModal = closeQueueModal;
    }

    /* ----------------------------------------------------
       3-DOT OPTIONS ACTION SHEET MODAL
       ---------------------------------------------------- */
    function openOptionsModal() {
        const modal = document.getElementById("spotify-options-modal");
        if (!modal) return;

        const thumbEl = document.getElementById("options-song-art");
        const titleEl = document.getElementById("options-song-title");
        const artistEl = document.getElementById("options-song-artist");
        const likeTitle = document.getElementById("opt-action-like-title");
        const timerTitle = document.getElementById("opt-action-timer-title");
        const crackleTitle = document.getElementById("opt-action-crackle-title");

        const curTitle = (lastTrackData && lastTrackData.title) ? lastTrackData.title : "Nostalgic Radio";
        const curArtist = (lastTrackData && lastTrackData.author) ? lastTrackData.author : "Vintage Collection";
        const curVideoId = (lastTrackData && lastTrackData.videoId) ? lastTrackData.videoId : null;

        if (titleEl) titleEl.textContent = curTitle;
        if (artistEl) artistEl.textContent = curArtist;
        if (thumbEl) {
            thumbEl.src = curVideoId ? `https://img.youtube.com/vi/${curVideoId}/hqdefault.jpg` : "/static/images/logo.png";
        }

        // Check wishlist state
        if (likeTitle && typeof window.isCurrentSongInWishlist === "function") {
            const inWishlist = window.isCurrentSongInWishlist();
            likeTitle.textContent = inWishlist ? "Saved in Memories Wishlist (Remove)" : "Save to Memories Wishlist";
        }

        if (timerTitle) {
            timerTitle.textContent = sleepTimerMinutes > 0 ? `Sleep Timer (${sleepTimerMinutes}m active)` : "Sleep Timer (Off)";
        }

        if (crackleTitle) {
            crackleTitle.textContent = isCrackleActive ? "Warm Vinyl Crackle (ON)" : "Warm Vinyl Crackle (OFF)";
        }

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeOptionsModal() {
        const modal = document.getElementById("spotify-options-modal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }

    function bindOptionsModal() {
        const modal = document.getElementById("spotify-options-modal");
        const backdrop = document.getElementById("spotify-options-backdrop");
        const cancelBtn = document.getElementById("options-close-btn");

        if (backdrop) backdrop.addEventListener("click", closeOptionsModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeOptionsModal);

        const likeBtn = document.getElementById("opt-action-like");
        if (likeBtn) {
            likeBtn.addEventListener("click", function () {
                const mainLike = document.getElementById("like-button");
                if (mainLike) mainLike.click();
                closeOptionsModal();
            });
        }

        const memTitleBtn = document.getElementById("opt-action-memory-title");
        if (memTitleBtn) {
            memTitleBtn.addEventListener("click", function () {
                closeOptionsModal();
                if (lastTrackData && lastTrackData.videoId && window.openMemoryTitleModal) {
                    window.openMemoryTitleModal(lastTrackData.videoId);
                } else if (window.showToast) {
                    window.showToast("Rename available when playing an era song ✨");
                }
            });
        }

        const queueBtn = document.getElementById("opt-action-queue");
        if (queueBtn) {
            queueBtn.addEventListener("click", function () {
                closeOptionsModal();
                openQueueModal();
            });
        }

        const shareBtn = document.getElementById("opt-action-share");
        if (shareBtn) {
            shareBtn.addEventListener("click", function () {
                closeOptionsModal();
                if (typeof window.openShareModal === "function") {
                    window.openShareModal();
                }
            });
        }

        const eraBtn = document.getElementById("opt-action-era");
        if (eraBtn) {
            eraBtn.addEventListener("click", function () {
                closeOptionsModal();
                closeSpotifyModal();
                const modeBtn = document.getElementById("mode-button");
                if (modeBtn) modeBtn.click();
            });
        }

        const timerBtn = document.getElementById("opt-action-timer");
        if (timerBtn) {
            timerBtn.addEventListener("click", function () {
                const mainTimer = document.getElementById("spotify-timer-btn");
                if (mainTimer) mainTimer.click();
                closeOptionsModal();
            });
        }

        const crackleBtn = document.getElementById("opt-action-crackle");
        if (crackleBtn) {
            crackleBtn.addEventListener("click", function () {
                toggleVinylCrackle();
                closeOptionsModal();
            });
        }

        window.openSpotifyOptionsModal = openOptionsModal;
        window.closeSpotifyOptionsModal = closeOptionsModal;
    }

    /* ----------------------------------------------------
       DYNAMIC SONG-BASED COLOR THEME ENGINE (LIKE SPOTIFY)
       ---------------------------------------------------- */
    function getSongSpecificPalette(songKey, fallbackModeId) {
        let hash = 0;
        const str = (songKey || "nostalgic") + (fallbackModeId || "papa-era");
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
        }
        const hue = Math.abs(hash) % 360;
        return {
            top: `hsl(${hue}, 80%, 34%)`,
            mid: `hsl(${hue}, 75%, 15%)`,
            bottom: `hsl(${hue}, 80%, 5%)`,
            glow: `hsla(${hue}, 95%, 60%, 0.55)`
        };
    }

    function applyDynamicSongColorPalette(trackData, mode) {
        const sheetContainer = document.getElementById("spotify-sheet-container");
        if (!sheetContainer) return;

        const songIdentifier = (trackData && (trackData.title || trackData.videoId)) ? (trackData.title + (trackData.videoId || "")) : "";
        const modeId = (mode && mode.id) ? mode.id : "papa-era";
        
        // 1. Initial instantaneous smooth palette matching song
        const generated = getSongSpecificPalette(songIdentifier, modeId);
        sheetContainer.style.setProperty("--spotify-theme-top", generated.top);
        sheetContainer.style.setProperty("--spotify-theme-mid", generated.mid);
        sheetContainer.style.setProperty("--spotify-theme-bottom", generated.bottom);
        sheetContainer.style.setProperty("--spotify-art-glow", generated.glow);

        // 2. If videoId exists, attempt Canvas cover-art dominant color extraction
        if (trackData && trackData.videoId) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function () {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = 16;
                    canvas.height = 16;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, 16, 16);
                    const imgData = ctx.getImageData(0, 0, 16, 16).data;
                    let bestR = 0, bestG = 0, bestB = 0, maxSaturation = 0;

                    for (let i = 0; i < imgData.length; i += 4) {
                        const r = imgData[i];
                        const g = imgData[i + 1];
                        const b = imgData[i + 2];
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const sat = max === 0 ? 0 : (max - min) / max;
                        if (sat > 0.28 && max > 45 && min < 210) {
                            if (sat > maxSaturation) {
                                maxSaturation = sat;
                                bestR = r;
                                bestG = g;
                                bestB = b;
                            }
                        }
                    }

                    if (maxSaturation > 0.3) {
                        const topColor = `rgb(${Math.round(bestR * 0.72)}, ${Math.round(bestG * 0.72)}, ${Math.round(bestB * 0.72)})`;
                        const midColor = `rgb(${Math.round(bestR * 0.32)}, ${Math.round(bestG * 0.32)}, ${Math.round(bestB * 0.32)})`;
                        const bottomColor = `rgb(${Math.round(bestR * 0.12)}, ${Math.round(bestG * 0.12)}, ${Math.round(bestB * 0.12)})`;
                        const glowColor = `rgba(${bestR}, ${bestG}, ${bestB}, 0.55)`;

                        sheetContainer.style.setProperty("--spotify-theme-top", topColor);
                        sheetContainer.style.setProperty("--spotify-theme-mid", midColor);
                        sheetContainer.style.setProperty("--spotify-theme-bottom", bottomColor);
                        sheetContainer.style.setProperty("--spotify-art-glow", glowColor);
                    }
                } catch (e) {}
            };
            img.src = `https://img.youtube.com/vi/${trackData.videoId}/hqdefault.jpg`;
        }
    }

    /* ----------------------------------------------------
       SYNCING STATE FROM PLAYER & DOM
       ---------------------------------------------------- */
    function hookSongChange() {
        const origOnSongChanged = window.onSongChanged;
        window.onSongChanged = function (trackData) {
            if (typeof origOnSongChanged === "function") {
                origOnSongChanged(trackData);
            }
            lastTrackData = trackData;
            updateSpotifyView(trackData);
        };
    }

    function updateSpotifyView(trackData) {
        if (!trackData) return;
        lastTrackData = trackData;

        let displayTitle = trackData.title || "Nostalgic Radio";
        if (typeof window.getCustomTitleForSong === "function" && trackData.videoId) {
            const custom = window.getCustomTitleForSong(trackData.videoId);
            if (custom) displayTitle = custom;
        }

        const trackTitle = document.getElementById("spotify-track-title");
        const stickyTitle = document.getElementById("spotify-sticky-title");
        if (trackTitle) trackTitle.textContent = displayTitle;
        if (stickyTitle) stickyTitle.textContent = displayTitle;

        const mode = trackData.mode || (typeof currentMode !== "undefined" ? currentMode : null);
        const artist = trackData.author || "YouTube Music";
        const artistEl = document.getElementById("spotify-track-artist");
        const stickyArtistEl = document.getElementById("spotify-sticky-artist");
        const headerEraEl = document.getElementById("spotify-header-era-name");

        if (artistEl) artistEl.textContent = `${artist} • ${mode ? mode.name : "Nostalgic Era"}`;
        if (stickyArtistEl) stickyArtistEl.textContent = `${artist} • ${mode ? mode.name : "Nostalgic Era"}`;
        if (headerEraEl) headerEraEl.textContent = `${mode ? mode.name : "Papa's Era"} ${mode && mode.icon ? mode.icon : "📻"}`;

        const artImg = document.getElementById("spotify-large-art");
        const vinylImg = document.getElementById("spotify-vinyl-label-img");
        const ambientImg = document.getElementById("spotify-ambient-img");
        const metaThumb = document.getElementById("spotify-meta-thumb");

        const fallbackBg = mode && mode.background ? `/static/images/backgrounds/${mode.background}` : "/static/images/backgrounds/papa-era.jpeg";
        const thumbUrl = trackData.videoId ? `https://img.youtube.com/vi/${trackData.videoId}/hqdefault.jpg` : fallbackBg;

        if (artImg) {
            artImg.src = thumbUrl;
            artImg.onerror = function() { this.src = fallbackBg; };
        }
        if (vinylImg) {
            vinylImg.src = thumbUrl;
            vinylImg.onerror = function() { this.src = fallbackBg; };
        }
        if (ambientImg) {
            ambientImg.src = thumbUrl;
            ambientImg.onerror = function() { this.src = fallbackBg; };
        }
        if (metaThumb) {
            metaThumb.src = thumbUrl;
            metaThumb.onerror = function() { this.src = fallbackBg; };
        }

        // Apply Spotify-style dynamic song-based background color transitions
        applyDynamicSongColorPalette(trackData, mode);

        renderLyricsLines();
        renderUpNextQueue(mode);
        renderCredits(trackData);
        syncLikeState();
        syncPlayButtonIcon();
    }

    function syncFromDOM() {
        const songTitleEl = document.getElementById("song-title");
        const songSourceEl = document.getElementById("song-source");
        const albumImgEl = document.getElementById("album-image");

        const data = {
            title: songTitleEl ? songTitleEl.textContent : "Nostalgic Radio",
            author: songSourceEl ? songSourceEl.textContent : "YouTube Music",
            mode: typeof currentMode !== "undefined" ? currentMode : null,
            videoId: albumImgEl ? albumImgEl.getAttribute("data-video-id") : null
        };
        updateSpotifyView(data);
    }

    /* ----------------------------------------------------
       ROCK-SOLID PLAY/PAUSE STATE SYNCHRONIZATION
       ---------------------------------------------------- */
    function syncPlayButtonIcon(explicitPlaying) {
        const mainPlayBtn = document.getElementById("play-button");
        const spotifyPlayIcon = document.getElementById("spotify-play-icon");
        const stickyPlayIcon = document.querySelector(".spotify-sticky-play-icon");
        const artCard = document.getElementById("spotify-art-card");
        const musicPlayer = document.querySelector(".music-player");

        let isPlaying = false;

        if (typeof explicitPlaying === "boolean") {
            isPlaying = explicitPlaying;
        } else {
            // Check 1: YouTube player state directly (1 = YT.PlayerState.PLAYING)
            if (typeof youtubePlayer !== "undefined" && youtubePlayer && typeof youtubePlayer.getPlayerState === "function") {
                try {
                    const state = youtubePlayer.getPlayerState();
                    if (state === 1) {
                        isPlaying = true;
                    }
                } catch (e) {}
            }

            // Check 2: Main player button text (detects Roman numeral 'Ⅱ' and pause symbol)
            if (!isPlaying && mainPlayBtn) {
                const text = mainPlayBtn.textContent.trim();
                if (text === "Ⅱ" || text === "⏸" || text === "||" || text === "pause") {
                    isPlaying = true;
                }
            }

            // Check 3: Music player element has .playing class or album art is rotating
            if (!isPlaying && musicPlayer && musicPlayer.classList.contains("playing")) {
                isPlaying = true;
            }
        }

        const iconText = isPlaying ? "⏸" : "▶";

        if (spotifyPlayIcon) spotifyPlayIcon.textContent = iconText;
        if (stickyPlayIcon) stickyPlayIcon.textContent = iconText;
        if (artCard) artCard.classList.toggle("is-playing", isPlaying);

        const spotifyPlayBtn = document.getElementById("spotify-play-btn");
        if (spotifyPlayBtn) {
            spotifyPlayBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
        }

        const sheetContainer = document.getElementById("spotify-sheet-container");
        const playerModal = document.getElementById("spotify-player-modal");
        if (sheetContainer) {
            sheetContainer.classList.toggle("is-playing", isPlaying);
            sheetContainer.classList.toggle("is-paused", !isPlaying);
        }
        if (playerModal) {
            playerModal.classList.toggle("is-playing", isPlaying);
            playerModal.classList.toggle("is-paused", !isPlaying);
        }
    }

    window.syncSpotifyPlayState = syncPlayButtonIcon;

    function syncLikeState() {
        const mainLikeBtn = document.getElementById("like-button");
        const isLiked = mainLikeBtn && mainLikeBtn.classList.contains("liked");

        const spotifyLike = document.getElementById("spotify-like-btn");
        const stickyLike = document.getElementById("spotify-sticky-like-btn");

        if (spotifyLike) spotifyLike.classList.toggle("liked", !!isLiked);
        if (stickyLike) stickyLike.classList.toggle("liked", !!isLiked);
    }

    function syncProgressState() {
        if (typeof youtubePlayer === "undefined" || !youtubePlayer || !youtubePlayer.getCurrentTime) return;

        try {
            const currentTime = youtubePlayer.getCurrentTime() || 0;
            const duration = youtubePlayer.getDuration() || 0;

            const timeCurrentEl = document.getElementById("spotify-time-current");
            const timeTotalEl = document.getElementById("spotify-time-total");
            const fillEl = document.getElementById("spotify-progress-fill");
            const sliderEl = document.getElementById("spotify-progress-slider");

            if (timeCurrentEl) timeCurrentEl.textContent = formatTime(currentTime);
            if (timeTotalEl) timeTotalEl.textContent = formatTime(duration);

            if (duration > 0) {
                const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
                if (fillEl) fillEl.style.width = percent + "%";
                if (sliderEl && document.activeElement !== sliderEl) {
                    sliderEl.value = percent;
                }
                syncLyricsHighlight(currentTime, duration);
            }
        } catch (e) {}

        syncPlayButtonIcon();
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // Initialize on DOM load
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSpotifyPlayer);
    } else {
        initSpotifyPlayer();
    }
})();
