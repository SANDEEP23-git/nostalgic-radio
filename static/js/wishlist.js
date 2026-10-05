/* =========================================================
   NOSTALGIC RADIO — WISHLIST + MEMORIES
   MongoDB / USER BASED VERSION
   UI structure is kept unchanged.
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       STATE
       ========================================================= */

    let wishlist = [];
    let memoriesHistory = [];
    let currentTrack = null;

    let songBeingEdited = null;
    let wishlistPlaybackIndex = -1;
    let isWishlistPlaying = false;

    let currentLikedSort = "date-desc";

    const STORAGE_KEY_WISHLIST = "nostalgic_wishlist";
    const STORAGE_KEY_MEMORIES = "nostalgic_memories_history";

    function getLocalWishlist() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_WISHLIST);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(normalizeWishlistItem) : [];
        } catch (e) {
            return [];
        }
    }

    function saveLocalWishlist(list) {
        try {
            localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(list || []));
        } catch (e) {}
    }

    function getLocalMemories() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_MEMORIES);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(normalizeMemoryItem) : [];
        } catch (e) {
            return [];
        }
    }

    function saveLocalMemories(list) {
        try {
            localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(list || []));
        } catch (e) {}
    }

    /* =========================================================
       API HELPER
       ========================================================= */

    async function apiRequest(url, options = {}) {
        const config = {
            credentials: "same-origin",
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        };

        const response = await fetch(url, config);

        let data = {};

        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }

        if (!response.ok) {
            const error = new Error(
                data.message || `Request failed: ${response.status}`
            );

            error.status = response.status;
            error.data = data;

            throw error;
        }

        return data;
    }

    function isLoggedIn() {
        if (window.currentUser && (window.currentUser.id || window.currentUser._id || window.currentUser.name)) {
            return true;
        }
        if (typeof window.getCurrentUser === "function") {
            const u = window.getCurrentUser();
            if (u && (u.id || u._id || u.name)) return true;
        }
        try {
            const saved = localStorage.getItem("nostalgic_radio_user");
            if (saved) {
                const u = JSON.parse(saved);
                if (u && (u.id || u._id || u.name)) return true;
            }
        } catch (e) {}
        return false;
    }

    /* =========================================================
       INIT
       ========================================================= */

    async function initWishlist() {

        bindLikeButton();
        bindSettingsWishlist();
        bindMemoryModal();
        bindLikedPageControls();
        bindMemoriesPageControls();

        window.onSongChanged = handleSongChanged;

        window.getCustomTitleForSong = getCustomTitleForSong;
        window.getWishlistCount = () => wishlist.length;

        window.openSettingsWishlist = openSettingsWishlist;
        window.renderLikedPageView = renderLikedPageView;
        window.renderMemoriesPageView = renderMemoriesPageView;

        window.openMemoryTitleModal = openMemoryTitleModal;
        window.toggleWishlistCurrentSong = toggleCurrentTrackLike;

        /*
         * First load data from MongoDB.
         */
        await loadWishlist();
        await loadMemories();

        updateWishlistCounters();
        renderLikedPageView();
        renderMemoriesPageView();
    }

    /* =========================================================
       LOAD WISHLIST (LOCALSTORAGE + MONGODB SYNC)
       ========================================================= */

    async function loadWishlist() {
        // 1. Immediately read from localStorage
        const local = getLocalWishlist();
        if (local && local.length > 0) {
            wishlist = local;
        }

        // 2. If logged in, fetch from MongoDB and sync
        if (isLoggedIn()) {
            try {
                const data = await apiRequest("/api/wishlist");
                const serverItems = Array.isArray(data.wishlist) ? data.wishlist.map(normalizeWishlistItem) : [];

                // Check for local items that need to be synced to DB
                const serverIds = new Set(serverItems.map(s => s.videoId));
                const unsynced = (local || []).filter(item => item && item.videoId && !serverIds.has(item.videoId));

                if (unsynced.length > 0) {
                    try {
                        await apiRequest("/api/wishlist/sync", {
                            method: "POST",
                            body: JSON.stringify({ songs: unsynced })
                        });
                        unsynced.forEach(s => serverItems.push(s));
                    } catch (syncErr) {
                        console.warn("Could not sync local items to DB:", syncErr);
                    }
                }

                wishlist = serverItems;
                saveLocalWishlist(wishlist);
            } catch (error) {
                console.warn("Could not load wishlist from server, using local cache:", error);
            }
        }
    }

    /* =========================================================
       LOAD MEMORIES / LISTENING HISTORY
       ========================================================= */

    async function loadMemories() {
        const local = getLocalMemories();
        if (local && local.length > 0) {
            memoriesHistory = local;
        }

        if (isLoggedIn()) {
            try {
                const data = await apiRequest("/api/listening-history");
                const serverList = Array.isArray(data.history)
                    ? data.history.map(normalizeMemoryItem)
                    : [];
                memoriesHistory = serverList;
                saveLocalMemories(memoriesHistory);
            } catch (error) {
                console.warn("Could not load listening history from server:", error);
            }
        }
    }

    /* =========================================================
       NORMALIZE MONGODB DATA
       ========================================================= */

    function normalizeWishlistItem(item) {

        return {
            id:
                item.id ||
                item._id ||
                ("wish_" + Date.now()),

            videoId:
                item.video_id ||
                item.videoId ||
                "",

            originalTitle:
                item.original_title ||
                item.originalTitle ||
                item.title ||
                "Nostalgic Radio Track",

            customTitle:
                item.custom_title ||
                item.customTitle ||
                "",

            author:
                item.author ||
                "YouTube Music",

            modeId:
                item.mode_id ||
                item.modeId ||
                "papa-era",

            modeName:
                item.mode_name ||
                item.modeName ||
                "Nostalgic Era",

            albumArt:
                item.album_art ||
                item.albumArt ||
                "",

            likedAt:
                item.liked_at ||
                item.likedAt ||
                null
        };
    }

    function normalizeMemoryItem(item) {

        return {
            id:
                item.id ||
                item._id ||
                ("mem_" + Date.now()),

            videoId:
                item.video_id ||
                item.videoId ||
                "",

            title:
                item.title ||
                item.original_title ||
                item.originalTitle ||
                "Nostalgic Classic",

            author:
                item.author ||
                "YouTube Music",

            albumArt:
                item.thumbnail ||
                item.album_art ||
                item.albumArt ||
                "",

            modeName:
                item.era ||
                item.mode_name ||
                item.modeName ||
                "Nostalgic Era",

            playedAt:
                item.played_at ||
                item.playedAt ||
                Date.now()
        };
    }

    /* =========================================================
       SAVE WISHLIST (LOCALSTORAGE + MONGODB)
       ========================================================= */

    async function saveWishlistItem(item) {
        const normalized = normalizeWishlistItem(item);

        // 1. Always update local storage first so user never loses song
        const existingIdx = wishlist.findIndex(w => w.videoId === normalized.videoId);
        if (existingIdx >= 0) {
            wishlist[existingIdx] = normalized;
        } else {
            wishlist.unshift(normalized);
        }
        saveLocalWishlist(wishlist);

        // 2. If logged in, persist to database
        if (isLoggedIn()) {
            try {
                await apiRequest("/api/wishlist", {
                    method: "POST",
                    body: JSON.stringify({
                        video_id: normalized.videoId,
                        videoId: normalized.videoId,
                        original_title: normalized.originalTitle,
                        originalTitle: normalized.originalTitle,
                        custom_title: normalized.customTitle || "",
                        customTitle: normalized.customTitle || "",
                        author: normalized.author,
                        artist: normalized.author,
                        mode_id: normalized.modeId,
                        modeId: normalized.modeId,
                        mode_name: normalized.modeName,
                        era: normalized.modeName,
                        album_art: normalized.albumArt,
                        albumArt: normalized.albumArt,
                        thumbnail: normalized.albumArt
                    })
                });
            } catch (error) {
                console.warn("Could not save wishlist to DB, kept in localStorage:", error);
            }
        }

        return true;
    }

    /* =========================================================
       DELETE WISHLIST (LOCALSTORAGE + MONGODB)
       ========================================================= */

    async function deleteWishlistItem(videoId) {
        // 1. Remove from local storage
        wishlist = wishlist.filter(item => item.videoId !== videoId);
        saveLocalWishlist(wishlist);

        // 2. If logged in, delete from database
        if (isLoggedIn()) {
            try {
                await apiRequest(`/api/wishlist/${encodeURIComponent(videoId)}`, {
                    method: "DELETE"
                });
            } catch (error) {
                console.warn("Could not delete from DB, removed locally:", error);
            }
        }

        return true;
    }

    /* =========================================================
       SAVE LISTENING HISTORY
       ========================================================= */

    async function saveListeningHistory(track) {

        if (!isLoggedIn()) {
            return false;
        }

        if (!track || !track.videoId) {
            return false;
        }

        try {

            await apiRequest(
                "/api/listening-history",
                {
                    method: "POST",
                    body: JSON.stringify({
                        video_id: track.videoId,

                        title:
                            track.customTitle ||
                            track.originalTitle ||
                            "Nostalgic Radio Track",

                        artist:
                            track.author ||
                            "YouTube Music",

                        thumbnail:
                            track.albumArt ||
                            "",

                        era:
                            track.modeName ||
                            "Nostalgic Era"
                    })
                }
            );

            return true;

        } catch (error) {

            console.error(
                "Could not save listening history:",
                error
            );

            return false;
        }
    }

    /* =========================================================
       SONG CHANGED
       ========================================================= */

    async function handleSongChanged(trackData) {

        if (!trackData) {
            return;
        }

        currentTrack = {

            videoId:
                trackData.videoId,

            originalTitle:
                trackData.title ||
                "Nostalgic Radio Track",

            author:
                trackData.author ||
                "YouTube Music",

            modeId:
                trackData.mode
                    ? trackData.mode.id
                    : "papa-era",

            modeName:
                trackData.mode
                    ? trackData.mode.name
                    : "Nostalgic Era",

            albumArt:
                trackData.videoId
                    ? `https://img.youtube.com/vi/${trackData.videoId}/hqdefault.jpg`
                    : ""
        };

        /*
         * Custom wishlist title
         */

        const existing = wishlist.find(
            item =>
                item.videoId ===
                currentTrack.videoId
        );

        if (
            existing &&
            existing.customTitle
        ) {

            currentTrack.customTitle =
                existing.customTitle;

            const songTitleEl =
                document.getElementById(
                    "song-title"
                );

            if (songTitleEl) {
                songTitleEl.textContent =
                    existing.customTitle;
            }

            const customTitleTag =
                document.getElementById(
                    "custom-memory-tag"
                );

            const customTitleText =
                document.getElementById(
                    "custom-memory-tag-text"
                );

            if (
                customTitleTag &&
                customTitleText
            ) {

                customTitleTag.style.display =
                    "inline-flex";

                customTitleText.textContent =
                    `Memory: ${existing.customTitle}`;
            }

        } else {

            const customTitleTag =
                document.getElementById(
                    "custom-memory-tag"
                );

            if (customTitleTag) {
                customTitleTag.style.display =
                    "none";
            }
        }

        updateLikeButtonState();

        /*
         * IMPORTANT:
         * Every played song goes to MongoDB.
         */

        await saveListeningHistory(
            currentTrack
        );

        /*
         * Refresh local memory list
         * from MongoDB.
         */

        await loadMemories();

        renderMemoriesPageView();
        renderLikedPageView();

        if (
            typeof window.addToRecentlyPlayed ===
            "function"
        ) {

            window.addToRecentlyPlayed(
                currentTrack
            );
        }
    }

    /* =========================================================
       CUSTOM TITLE
       ========================================================= */

    function getCustomTitleForSong(videoId) {

        const found =
            wishlist.find(
                item =>
                    item.videoId === videoId
            );

        return found &&
            found.customTitle
            ? found.customTitle
            : null;
    }

    /* =========================================================
       LIKE STATE
       ========================================================= */

    function isCurrentSongLiked() {

        if (
            !currentTrack ||
            !currentTrack.videoId
        ) {
            return false;
        }

        return wishlist.some(
            item =>
                item.videoId ===
                currentTrack.videoId
        );
    }

    function updateLikeButtonState() {
        const liked = isCurrentSongLiked();
        const buttonIds = [
            "like-button",
            "spotify-like-btn",
            "spotify-sticky-like-btn",
            "opt-action-like"
        ];

        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle("liked", liked);
            btn.setAttribute("aria-pressed", liked ? "true" : "false");
            if (id === "like-button" || id === "spotify-like-btn") {
                btn.title = liked ? "In Wishlist (Click to remove)" : "Save to Memories Wishlist";
            }
            if (id === "opt-action-like") {
                const title = document.getElementById("opt-action-like-title");
                if (title) {
                    title.textContent = liked ? "Remove from Memories Wishlist" : "Save to Memories Wishlist";
                }
            }
        });
    }

    /* =========================================================
       LIKE BUTTONS BINDING (ALL APP VIEWS)
       ========================================================= */

    function bindLikeButton() {
        const buttonIds = [
            "like-button",
            "spotify-like-btn",
            "spotify-sticky-like-btn",
            "opt-action-like"
        ];

        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (btn.dataset.boundWishlist === "true") return;
            btn.dataset.boundWishlist = "true";

            btn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                toggleCurrentTrackLike();
            });
        });
    }

    async function toggleCurrentTrackLike() {
        if (!currentTrack || !currentTrack.videoId) {
            if (typeof window.getCurrentPlayingTrackInfo === "function") {
                const info = window.getCurrentPlayingTrackInfo();
                if (info && info.videoId) {
                    currentTrack = {
                        videoId: info.videoId,
                        originalTitle: info.title || "Nostalgic Radio Track",
                        author: info.author || "YouTube Music",
                        modeId: info.mode?.id || "papa-era",
                        modeName: info.mode?.name || "Nostalgic Era",
                        albumArt: info.albumArt || `https://img.youtube.com/vi/${info.videoId}/hqdefault.jpg`
                    };
                }
            }
        }

        if (
            !currentTrack ||
            !currentTrack.videoId
        ) {

            showToast(
                "No song is currently playing."
            );

            return;
        }

        const existingIndex =
            wishlist.findIndex(
                item =>
                    item.videoId ===
                    currentTrack.videoId
            );

        /*
         * REMOVE
         */

        if (existingIndex >= 0) {

            const removed =
                wishlist[existingIndex];

            const success =
                await deleteWishlistItem(
                    currentTrack.videoId
                );

            if (!success) {
                return;
            }

            wishlist.splice(
                existingIndex,
                1
            );

            updateWishlistCounters();
            renderWishlistItems();
            renderLikedPageView();
            updateLikeButtonState();

            showToast(
                `Removed "${removed.customTitle || removed.originalTitle}" from wishlist.`
            );

            return;
        }

        /*
         * ADD
         */

        const newItem = {

            id:
                "wish_" +
                Date.now(),

            videoId:
                currentTrack.videoId,

            originalTitle:
                currentTrack.originalTitle,

            customTitle:
                "",

            author:
                currentTrack.author,

            modeId:
                currentTrack.modeId,

            modeName:
                currentTrack.modeName,

            albumArt:
                currentTrack.albumArt,

            likedAt:
                new Date().toISOString()
        };

        const success =
            await saveWishlistItem(
                newItem
            );

        if (!success) {
            return;
        }

        wishlist.unshift(
            newItem
        );

        updateWishlistCounters();
        renderWishlistItems();
        renderLikedPageView();
        updateLikeButtonState();

        const likeBtn =
            document.getElementById(
                "like-button"
            );

        if (likeBtn) {

            likeBtn.classList.add(
                "pop-anim"
            );

            setTimeout(
                () => {
                    likeBtn.classList.remove(
                        "pop-anim"
                    );
                },
                600
            );
        }

        showToast(
            `Saved to Wishlist! ❤️`
        );
    }

    /* =========================================================
       COUNTERS
       ========================================================= */

    function updateWishlistCounters() {

        const count =
            wishlist.length;

        const topBadge =
            document.getElementById(
                "wishlist-badge-count"
            );

        const settingsBadge =
            document.getElementById(
                "wishlist-badge"
            );

        const tabCount =
            document.getElementById(
                "wishlist-tab-count"
            );

        if (topBadge) {

            topBadge.textContent =
                count;

            topBadge.style.display =
                count > 0
                    ? "inline-flex"
                    : "none";
        }

        if (settingsBadge) {
            settingsBadge.textContent =
                count;
        }

        if (tabCount) {
            tabCount.textContent =
                count;
        }
    }

    /* =========================================================
       SETTINGS WISHLIST
       ========================================================= */

    function bindSettingsWishlist() {

        const wishlistTopBtn =
            document.getElementById(
                "wishlist-top-button"
            );

        if (wishlistTopBtn) {

            wishlistTopBtn.addEventListener(
                "click",
                openSettingsWishlist
            );
        }

        const tabPrefBtn =
            document.getElementById(
                "tab-pref-btn"
            );

        const tabWishlistBtn =
            document.getElementById(
                "tab-wishlist-btn"
            );

        const panePref =
            document.getElementById(
                "settings-pref-pane"
            );

        const paneWishlist =
            document.getElementById(
                "settings-wishlist-pane"
            );

        if (
            tabPrefBtn &&
            tabWishlistBtn
        ) {

            tabPrefBtn.addEventListener(
                "click",
                () => {

                    tabPrefBtn.classList.add(
                        "active"
                    );

                    tabWishlistBtn.classList.remove(
                        "active"
                    );

                    if (panePref) {
                        panePref.classList.add(
                            "active"
                        );
                    }

                    if (paneWishlist) {
                        paneWishlist.classList.remove(
                            "active"
                        );
                    }
                }
            );

            tabWishlistBtn.addEventListener(
                "click",
                () => {

                    tabWishlistBtn.classList.add(
                        "active"
                    );

                    tabPrefBtn.classList.remove(
                        "active"
                    );

                    if (paneWishlist) {
                        paneWishlist.classList.add(
                            "active"
                        );
                    }

                    if (panePref) {
                        panePref.classList.remove(
                            "active"
                        );
                    }

                    renderWishlistItems();
                }
            );
        }

        const playAllBtn =
            document.getElementById(
                "wishlist-play-all"
            );

        if (playAllBtn) {

            playAllBtn.addEventListener(
                "click",
                playWishlistAll
            );
        }
    }

    function openSettingsWishlist() {

        const settingsPanel =
            document.getElementById(
                "settings-panel"
            );

        const tabPrefBtn =
            document.getElementById(
                "tab-pref-btn"
            );

        const tabWishlistBtn =
            document.getElementById(
                "tab-wishlist-btn"
            );

        const panePref =
            document.getElementById(
                "settings-pref-pane"
            );

        const paneWishlist =
            document.getElementById(
                "settings-wishlist-pane"
            );

        if (settingsPanel) {

            settingsPanel.classList.add(
                "open"
            );

            settingsPanel.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        if (
            tabWishlistBtn &&
            tabPrefBtn
        ) {

            tabWishlistBtn.classList.add(
                "active"
            );

            tabPrefBtn.classList.remove(
                "active"
            );
        }

        if (
            paneWishlist &&
            panePref
        ) {

            paneWishlist.classList.add(
                "active"
            );

            panePref.classList.remove(
                "active"
            );
        }

        if (
            typeof window.setActiveAppView ===
            "function"
        ) {

            window.setActiveAppView(
                "wishlist"
            );
        }

        renderWishlistItems();
    }

    /* =========================================================
       WISHLIST RENDER
       ========================================================= */

    function renderWishlistItems() {

        const container =
            document.getElementById(
                "wishlist-list"
            );

        if (!container) {
            return;
        }

        if (wishlist.length === 0) {

            container.innerHTML = `
                <div class="wishlist-empty-state">
                    <span class="empty-icon">📻</span>

                    <h4>No Saved Memories Yet</h4>

                    <p>
                        When you hear a song you love,
                        click the <strong>❤️ heart icon</strong>
                        on the right of the music bar.
                    </p>

                    <p class="empty-hint">
                        You can give any song your own
                        custom memory title, like
                        <em>"Papa's Era"</em> or
                        <em>"90s Monsoon Memories"</em>.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML = "";

        wishlist.forEach(
            (item, index) => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "wishlist-card";

                if (
                    currentTrack &&
                    currentTrack.videoId ===
                    item.videoId
                ) {

                    card.classList.add(
                        "now-playing"
                    );
                }

                const displayTitle =
                    item.customTitle ||
                    item.originalTitle;

                const hasCustomTitle =
                    !!item.customTitle;

                card.innerHTML = `
                    <div class="wishlist-card-thumb">

                        <img
                            src="${
                                item.albumArt ||
                                "/static/images/backgrounds/90s.jpeg"
                            }"
                            alt="${displayTitle}"
                            onerror="this.src='/static/images/backgrounds/papa-era.jpeg'"
                        >

                        <button
                            class="wishlist-quick-play"
                            type="button"
                            title="Play Now"
                        >
                            ▶
                        </button>

                    </div>

                    <div class="wishlist-card-info">

                        <div class="wishlist-titles">

                            <h4 class="wishlist-main-title ${
                                hasCustomTitle
                                    ? "has-custom"
                                    : ""
                            }">
                                ${displayTitle}
                            </h4>

                            ${
                                hasCustomTitle
                                    ? `
                                <p class="wishlist-original-sub">
                                    Original:
                                    ${item.originalTitle}
                                </p>
                                `
                                    : ""
                            }

                        </div>

                        <div class="wishlist-meta">

                            <span class="wishlist-era-tag">
                                📻
                                ${item.modeName || "Classic"}
                            </span>

                            <span class="wishlist-author">
                                ${item.author || "YouTube Music"}
                            </span>

                        </div>

                    </div>

                    <div class="wishlist-card-actions">

                        <button
                            class="wishlist-btn edit-title-btn"
                            type="button"
                            title="Edit Memory Title"
                        >
                            ✏️
                        </button>

                        <button
                            class="wishlist-btn delete-wish-btn"
                            type="button"
                            title="Remove from Wishlist"
                        >
                            🗑️
                        </button>

                    </div>
                `;

                const playBtn =
                    card.querySelector(
                        ".wishlist-quick-play"
                    );

                if (playBtn) {

                    playBtn.addEventListener(
                        "click",
                        () => {
                            playWishlistSong(
                                item,
                                index
                            );
                        }
                    );
                }

                const editBtn =
                    card.querySelector(
                        ".edit-title-btn"
                    );

                if (editBtn) {

                    editBtn.addEventListener(
                        "click",
                        () => {
                            openMemoryTitleModal(
                                item.videoId
                            );
                        }
                    );
                }

                const deleteBtn =
                    card.querySelector(
                        ".delete-wish-btn"
                    );

                if (deleteBtn) {

                    deleteBtn.addEventListener(
                        "click",
                        () => {
                            removeWishlistItem(
                                item.videoId
                            );
                        }
                    );
                }

                container.appendChild(
                    card
                );
            }
        );
    }

    /* =========================================================
       PLAY WISHLIST
       ========================================================= */

    function playWishlistSong(
        item,
        index
    ) {

        wishlistPlaybackIndex =
            index;

        isWishlistPlaying =
            true;

        if (
            window.playSpecificSong
        ) {

            window.playSpecificSong(
                item.videoId,
                item.customTitle ||
                    item.originalTitle,
                item.modeId
            );

        } else {

            console.warn(
                "playSpecificSong is not available."
            );
        }

        renderWishlistItems();

        showToast(
            `Now Playing: ${
                item.customTitle ||
                item.originalTitle
            } 🎶`
        );
    }

    function playWishlistAll() {

        if (wishlist.length === 0) {

            showToast(
                "Your wishlist is empty. Like a song first!"
            );

            return;
        }

        playWishlistSong(
            wishlist[0],
            0
        );
    }

    async function removeWishlistItem(
        videoId
    ) {

        const item =
            wishlist.find(
                i =>
                    i.videoId ===
                    videoId
            );

        const success =
            await deleteWishlistItem(
                videoId
            );

        if (!success) {
            return;
        }

        wishlist =
            wishlist.filter(
                i =>
                    i.videoId !==
                    videoId
            );

        updateWishlistCounters();
        renderWishlistItems();
        renderLikedPageView();
        updateLikeButtonState();

        showToast(
            `Removed "${
                item
                    ? (
                        item.customTitle ||
                        item.originalTitle
                    )
                    : "Song"
            }" from wishlist.`
        );
    }

    /* =========================================================
       MEMORY TITLE MODAL
       ========================================================= */

    function bindMemoryModal() {

        const modal =
            document.getElementById(
                "edit-memory-modal"
            );

        const closeBtn =
            document.getElementById(
                "close-memory-modal"
            );

        const cancelBtn =
            document.getElementById(
                "cancel-memory-edit"
            );

        const saveBtn =
            document.getElementById(
                "save-memory-title"
            );

        const input =
            document.getElementById(
                "custom-title-input"
            );

        if (closeBtn) {
            closeBtn.addEventListener(
                "click",
                closeMemoryModal
            );
        }

        if (cancelBtn) {
            cancelBtn.addEventListener(
                "click",
                closeMemoryModal
            );
        }

        if (modal) {

            modal.addEventListener(
                "click",
                e => {

                    if (
                        e.target ===
                        modal
                    ) {
                        closeMemoryModal();
                    }
                }
            );
        }

        if (saveBtn) {

            saveBtn.addEventListener(
                "click",
                saveCustomMemoryTitle
            );
        }

        if (input) {

            input.addEventListener(
                "keydown",
                e => {

                    if (
                        e.key ===
                        "Enter"
                    ) {

                        e.preventDefault();

                        saveCustomMemoryTitle();
                    }
                }
            );
        }

        document
            .querySelectorAll(
                ".preset-chip"
            )
            .forEach(
                chip => {

                    chip.addEventListener(
                        "click",
                        () => {

                            if (input) {

                                input.value =
                                    chip.textContent.trim();

                                input.focus();
                            }
                        }
                    );
                }
            );
    }

    function openMemoryTitleModal(
        videoId
    ) {

        const item =
            wishlist.find(
                i =>
                    i.videoId ===
                    videoId
            );

        if (!item) {
            return;
        }

        songBeingEdited =
            item;

        const modal =
            document.getElementById(
                "edit-memory-modal"
            );

        const origTitleEl =
            document.getElementById(
                "memory-modal-orig-title"
            );

        const origModeEl =
            document.getElementById(
                "memory-modal-orig-mode"
            );

        const imgEl =
            document.getElementById(
                "memory-modal-img"
            );

        const input =
            document.getElementById(
                "custom-title-input"
            );

        if (origTitleEl) {

            origTitleEl.textContent =
                item.originalTitle;
        }

        if (origModeEl) {

            origModeEl.textContent =
                `Era: ${
                    item.modeName ||
                    "Classic"
                }`;
        }

        if (imgEl) {

            imgEl.src =
                item.albumArt ||
                "/static/images/backgrounds/90s.jpeg";
        }

        if (input) {

            input.value =
                item.customTitle ||
                "";

            setTimeout(
                () =>
                    input.focus(),
                150
            );
        }

        if (modal) {

            modal.classList.add(
                "open"
            );

            modal.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    }

    function closeMemoryModal() {

        const modal =
            document.getElementById(
                "edit-memory-modal"
            );

        if (modal) {

            modal.classList.remove(
                "open"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        songBeingEdited =
            null;
    }

    /* =========================================================
       SAVE CUSTOM TITLE
       ========================================================= */

    async function saveCustomMemoryTitle() {

        if (!songBeingEdited) {
            return;
        }

        const input =
            document.getElementById(
                "custom-title-input"
            );

        const newTitle =
            input
                ? input.value.trim()
                : "";

        const videoId =
            songBeingEdited.videoId;

        try {

            /*
             * Update wishlist item.
             * Existing backend should accept POST
             * for the same video and update it.
             */

            const response =
                await apiRequest(
                    "/api/wishlist",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
                                video_id:
                                    videoId,

                                original_title:
                                    songBeingEdited.originalTitle,

                                custom_title:
                                    newTitle,

                                author:
                                    songBeingEdited.author,

                                mode_id:
                                    songBeingEdited.modeId,

                                mode_name:
                                    songBeingEdited.modeName,

                                album_art:
                                    songBeingEdited.albumArt
                            })
                    }
                );

            /*
             * Update local state only after
             * successful MongoDB request.
             */

            songBeingEdited.customTitle =
                newTitle;

            closeMemoryModal();

            renderWishlistItems();
            renderLikedPageView();

            if (
                currentTrack &&
                currentTrack.videoId ===
                    videoId
            ) {

                currentTrack.customTitle =
                    newTitle;

                const songTitleEl =
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

                if (newTitle) {

                    if (songTitleEl) {
                        songTitleEl.textContent =
                            newTitle;
                    }

                    if (
                        customTitleTag &&
                        customTitleText
                    ) {

                        customTitleTag.style.display =
                            "inline-flex";

                        customTitleText.textContent =
                            `Memory: ${newTitle}`;
                    }

                } else {

                    if (songTitleEl) {

                        songTitleEl.textContent =
                            songBeingEdited.originalTitle;
                    }

                    if (customTitleTag) {

                        customTitleTag.style.display =
                            "none";
                    }
                }
            }

            showToast(
                newTitle
                    ? `Memory title set: "${newTitle}" ✨`
                    : "Reset to original title."
            );

        } catch (error) {

            console.error(
                "Could not save custom title:",
                error
            );

            showToast(
                "Could not save memory title."
            );
        }
    }

    /* =========================================================
       LIKED PAGE
       ========================================================= */

    function bindLikedPageControls() {

        const backBtn =
            document.getElementById(
                "liked-page-back-btn"
            );

        if (backBtn) {

            backBtn.addEventListener(
                "click",
                () => {

                    if (
                        typeof window.switchAppSubview ===
                        "function"
                    ) {

                        window.switchAppSubview(
                            "home"
                        );
                    }
                }
            );
        }

        const searchBtn =
            document.getElementById(
                "liked-page-search-btn"
            );

        if (searchBtn) {

            searchBtn.addEventListener(
                "click",
                () => {

                    if (
                        typeof window.switchAppSubview ===
                        "function"
                    ) {

                        window.switchAppSubview(
                            "search"
                        );
                    }
                }
            );
        }

        const playAllBtn =
            document.getElementById(
                "liked-play-all-btn"
            );

        if (playAllBtn) {

            playAllBtn.addEventListener(
                "click",
                () => {

                    playWishlistAll();
                }
            );
        }
    }

    function renderLikedPageView() {

        const heroArtwork =
            document.getElementById(
                "liked-hero-artwork"
            );

        const metaStats =
            document.getElementById(
                "liked-meta-stats"
            );

        const aboutDesc =
            document.getElementById(
                "liked-about-desc"
            );

        const listContainer =
            document.getElementById(
                "liked-songs-list"
            );

        if (!listContainer) {
            return;
        }

        /*
         * Keep existing UI calculation.
         */

        const totalMinutes =
            Math.floor(
                wishlist.length * 4.4
            );

        const totalHours =
            Math.floor(
                totalMinutes / 60
            );

        const remainingMinutes =
            totalMinutes % 60;

        const durationFormatted =
            totalHours > 0
                ? `${totalHours} hr ${remainingMinutes} min`
                : `${totalMinutes}:00`;

        if (metaStats) {

            metaStats.textContent =
                `${wishlist.length} songs • ${
                    totalMinutes > 0
                        ? durationFormatted
                        : "0:00"
                }`;
        }

        if (aboutDesc) {

            aboutDesc.textContent =
                wishlist.length > 0
                    ? `Liked is a personalized collection featuring ${wishlist.length} songs. Total listening time is ${durationFormatted}. This playlist is automatically curated for your musical enjoyment.`
                    : `Liked is a personalized collection featuring your favorite songs. Tap the heart ❤️ icon while listening to save golden memories.`;
        }

        if (heroArtwork) {

            if (
                wishlist.length > 0 &&
                wishlist[0].albumArt
            ) {

                heroArtwork.src =
                    wishlist[0].albumArt;

            } else if (
                currentTrack &&
                currentTrack.albumArt
            ) {

                heroArtwork.src =
                    currentTrack.albumArt;

            } else {

                heroArtwork.src =
                    "/static/images/backgrounds/papa-era.jpeg";
            }
        }

        if (wishlist.length === 0) {

            listContainer.innerHTML = `
                <div
                    class="wishlist-empty-state"
                    style="padding:40px 16px;text-align:center;"
                >

                    <span style="font-size:42px;">
                        ❤️
                    </span>

                    <h4
                        style="color:#ffffff;margin:12px 0 6px;"
                    >
                        No Liked Songs Yet
                    </h4>

                    <p
                        style="
                            color:#aba296;
                            font-size:13px;
                            max-width:320px;
                            margin:0 auto;
                        "
                    >
                        Tap the heart button on the
                        music player while listening
                        to add songs to your favorites.
                    </p>

                </div>
            `;

            return;
        }

        listContainer.innerHTML = "";

        wishlist.forEach(
            (item, index) => {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "liked-song-row";

                if (
                    currentTrack &&
                    currentTrack.videoId ===
                        item.videoId
                ) {

                    row.classList.add(
                        "is-current"
                    );
                }

                const title =
                    item.customTitle ||
                    item.originalTitle;

                const fallbackArt =
                    "/static/images/backgrounds/papa-era.jpeg";

                row.innerHTML = `
                    <img
                        class="liked-song-thumb"
                        src="${
                            item.albumArt ||
                            fallbackArt
                        }"
                        alt="${title}"
                        onerror="this.src='${fallbackArt}'"
                    >

                    <div class="liked-song-info">

                        <span class="liked-song-title">
                            ${title}
                        </span>

                        <div class="liked-song-meta">

                            <span class="heart-liked-indicator">
                                ❤️
                            </span>

                            <span class="eq-icon">
                                📊
                            </span>

                            <span>
                                ${
                                    item.author ||
                                    item.modeName ||
                                    "Classic"
                                }
                                • 4:15
                            </span>

                        </div>

                    </div>

                    <button
                        class="liked-row-dots-btn"
                        type="button"
                        title="Song options"
                    >
                        ⋮
                    </button>
                `;

                row.addEventListener(
                    "click",
                    e => {

                        if (
                            e.target.closest(
                                ".liked-row-dots-btn"
                            )
                        ) {
                            return;
                        }

                        playWishlistSong(
                            item,
                            index
                        );

                        if (
                            typeof window.switchAppSubview ===
                            "function"
                        ) {

                            window.switchAppSubview(
                                "home"
                            );
                        }
                    }
                );

                const dotsBtn =
                    row.querySelector(
                        ".liked-row-dots-btn"
                    );

                if (dotsBtn) {

                    dotsBtn.addEventListener(
                        "click",
                        e => {

                            e.stopPropagation();

                            openMemoryTitleModal(
                                item.videoId
                            );
                        }
                    );
                }

                listContainer.appendChild(
                    row
                );
            }
        );
    }

    /* =========================================================
       MEMORIES PAGE
       ========================================================= */

    function bindMemoriesPageControls() {

        const backBtn =
            document.getElementById(
                "memories-page-back-btn"
            );

        if (backBtn) {

            backBtn.addEventListener(
                "click",
                () => {

                    if (
                        typeof window.switchAppSubview ===
                        "function"
                    ) {

                        window.switchAppSubview(
                            "home"
                        );
                    }
                }
            );
        }

        const clearBtn =
            document.getElementById(
                "clear-memories-btn"
            );

        if (clearBtn) {

            clearBtn.addEventListener(
                "click",
                async () => {

                    /*
                     * Don't clear MongoDB accidentally.
                     * This button will be connected
                     * to backend later.
                     */

                    showToast(
                        "Your listening history is stored securely."
                    );
                }
            );
        }
    }

    /* =========================================================
       WEEKLY MEMORIES
       ========================================================= */

    function renderMemoriesPageView() {

        const weekImg =
            document.getElementById(
                "week-hero-img"
            );

        const weekTitle =
            document.getElementById(
                "week-hero-title"
            );

        const weekArtist =
            document.getElementById(
                "week-hero-artist"
            );

        const weekPlays =
            document.getElementById(
                "week-hero-plays"
            );

        const weekEra =
            document.getElementById(
                "week-hero-era"
            );

        const weekPlayBtn =
            document.getElementById(
                "week-hero-play-btn"
            );

        const statMinutes =
            document.getElementById(
                "mem-stat-minutes"
            );

        const statSongs =
            document.getElementById(
                "mem-stat-songs"
            );

        const statEra =
            document.getElementById(
                "mem-stat-era"
            );

        const listContainer =
            document.getElementById(
                "memories-songs-list"
            );

        /*
         * ONLY LAST 7 DAYS
         */

        const now =
            Date.now();

        const sevenDays =
            7 * 24 * 60 * 60 * 1000;

        const weeklyHistory =
            memoriesHistory.filter(
                item => {

                    const time =
                        new Date(
                            item.playedAt
                        ).getTime();

                    return (
                        !Number.isNaN(time) &&
                        now - time <= sevenDays
                    );
                }
            );

        /*
         * Empty state.
         */

        if (
            weeklyHistory.length ===
            0
        ) {

            if (weekImg) {

                weekImg.src =
                    "/static/images/backgrounds/papa-era.jpeg";
            }

            if (weekTitle) {

                weekTitle.textContent =
                    "No listening data yet";
            }

            if (weekArtist) {

                weekArtist.textContent =
                    "Start listening to discover your week";
            }

            if (weekPlays) {

                weekPlays.textContent =
                    "0 plays this week";
            }

            if (weekEra) {

                weekEra.textContent =
                    "—";
            }

            if (weekPlayBtn) {

                weekPlayBtn.style.display =
                    "none";
            }

            if (statMinutes) {

                statMinutes.textContent =
                    "0";
            }

            if (statSongs) {

                statSongs.textContent =
                    "0";
            }

            if (statEra) {

                statEra.textContent =
                    "—";
            }

            if (listContainer) {

                listContainer.innerHTML = `
                    <div
                        class="wishlist-empty-state"
                        style="
                            padding:30px 16px;
                            text-align:center;
                        "
                    >

                        <span
                            style="font-size:36px;"
                        >
                            ⏳
                        </span>

                        <h4
                            style="
                                color:#ffffff;
                                margin:10px 0 4px;
                            "
                        >
                            No History Recorded Yet
                        </h4>

                        <p
                            style="
                                color:#aba296;
                                font-size:13px;
                            "
                        >
                            Play any music mode and
                            your retro memories will
                            appear here automatically.
                        </p>

                    </div>
                `;
            }

            return;
        }

        /*
         * COUNT PLAYS PER SONG
         */

        const playCounts = {};

        weeklyHistory.forEach(
            item => {

                if (!item.videoId) {
                    return;
                }

                playCounts[item.videoId] =
                    (
                        playCounts[item.videoId] ||
                        0
                    ) + 1;
            }
        );

        /*
         * TOP SONG
         */

        let topVideoId =
            null;

        let maxPlays =
            0;

        Object.entries(
            playCounts
        ).forEach(
            ([videoId, count]) => {

                if (
                    count >
                    maxPlays
                ) {

                    maxPlays =
                        count;

                    topVideoId =
                        videoId;
                }
            }
        );

        const topSong =
            weeklyHistory.find(
                item =>
                    item.videoId ===
                    topVideoId
            );

        /*
         * HERO
         */

        if (topSong) {

            if (weekImg) {

                weekImg.src =
                    topSong.albumArt ||
                    "/static/images/backgrounds/papa-era.jpeg";
            }

            if (weekTitle) {

                weekTitle.textContent =
                    topSong.title ||
                    "Nostalgic Classic";
            }

            if (weekArtist) {

                weekArtist.textContent =
                    topSong.author ||
                    "YouTube Music";
            }

            if (weekPlays) {

                weekPlays.textContent =
                    `Played ${maxPlays} ${
                        maxPlays === 1
                            ? "time"
                            : "times"
                    } this week`;
            }

            if (weekEra) {

                weekEra.textContent =
                    topSong.modeName ||
                    "Golden Era";
            }

            if (weekPlayBtn) {

                weekPlayBtn.style.display =
                    "";

                weekPlayBtn.onclick =
                    () => {

                        if (
                            window.playSpecificSong
                        ) {

                            window.playSpecificSong(
                                topSong.videoId,
                                topSong.title,
                                topSong.modeName,
                                topSong.author
                            );

                            if (
                                typeof window.switchAppSubview ===
                                "function"
                            ) {

                                window.switchAppSubview(
                                    "home"
                                );
                            }
                        }
                    };
            }
        }

        /*
         * STATS
         */

        const totalListenedSongs =
            weeklyHistory.length;

        /*
         * Approximate duration.
         * Existing UI has no actual duration
         * field in MongoDB yet.
         */

        const totalMinutes =
            Math.round(
                totalListenedSongs *
                3.6
            );

        if (statMinutes) {

            statMinutes.textContent =
                String(
                    totalMinutes
                );
        }

        if (statSongs) {

            statSongs.textContent =
                String(
                    totalListenedSongs
                );
        }

        if (statEra) {

            statEra.textContent =
                topSong
                    ? (
                        topSong.modeName ||
                        "—"
                    )
                    : "—";
        }

        /*
         * HISTORY LIST
         */

        if (!listContainer) {
            return;
        }

        listContainer.innerHTML =
            "";

        weeklyHistory
            .slice(0, 30)
            .forEach(
                item => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "liked-song-row";

                    if (
                        currentTrack &&
                        currentTrack.videoId ===
                            item.videoId
                    ) {

                        row.classList.add(
                            "is-current"
                        );
                    }

                    const fallbackArt =
                        "/static/images/backgrounds/papa-era.jpeg";

                    row.innerHTML = `
                        <img
                            class="liked-song-thumb"
                            src="${
                                item.albumArt ||
                                fallbackArt
                            }"
                            alt="${item.title}"
                            onerror="this.src='${fallbackArt}'"
                        >

                        <div class="liked-song-info">

                            <span class="liked-song-title">
                                ${item.title}
                            </span>

                            <div class="liked-song-meta">

                                <span>
                                    ${
                                        item.author ||
                                        "YouTube Music"
                                    }
                                </span>

                                <span>•</span>

                                <span>
                                    ${
                                        formatTimeAgo(
                                            item.playedAt
                                        )
                                    }
                                </span>

                            </div>

                        </div>

                        <button
                            class="liked-row-dots-btn"
                            type="button"
                            title="Play Memory"
                        >
                            ▶
                        </button>
                    `;

                    row.addEventListener(
                        "click",
                        () => {

                            if (
                                window.playSpecificSong
                            ) {

                                window.playSpecificSong(
                                    item.videoId,
                                    item.title,
                                    item.modeName,
                                    item.author
                                );

                                if (
                                    typeof window.switchAppSubview ===
                                    "function"
                                ) {

                                    window.switchAppSubview(
                                        "home"
                                    );
                                }
                            }
                        }
                    );

                    listContainer.appendChild(
                        row
                    );
                }
            );
    }

    /* =========================================================
       TIME AGO
       ========================================================= */

    function formatTimeAgo(
        timestamp
    ) {

        const time =
            new Date(
                timestamp
            ).getTime();

        if (
            Number.isNaN(time)
        ) {
            return "Recently";
        }

        const diff =
            Math.floor(
                (
                    Date.now() -
                    time
                ) / 1000
            );

        if (
            diff < 60
        ) {
            return "Just now";
        }

        if (
            diff < 3600
        ) {
            return `${
                Math.floor(
                    diff / 60
                )
            }m ago`;
        }

        if (
            diff < 86400
        ) {
            return `${
                Math.floor(
                    diff / 3600
                )
            }h ago`;
        }

        return `${
            Math.floor(
                diff / 86400
            )
        }d ago`;
    }

    /* =========================================================
       SORTING
       ========================================================= */

    function setupLikedSort() {

        const sortPill =
            document.getElementById(
                "liked-sort-pill"
            );

        const sortDropdown =
            document.getElementById(
                "liked-sort-dropdown"
            );

        if (
            !sortPill ||
            !sortDropdown
        ) {
            return;
        }

        sortPill.addEventListener(
            "click",
            e => {

                e.stopPropagation();

                const open =
                    sortDropdown.style.display ===
                    "flex";

                sortDropdown.style.display =
                    open
                        ? "none"
                        : "flex";
            }
        );

        sortDropdown
            .querySelectorAll(
                ".sort-dropdown-option"
            )
            .forEach(
                option => {

                    option.addEventListener(
                        "click",
                        e => {

                            e.stopPropagation();

                            const sortKey =
                                option.getAttribute(
                                    "data-sort"
                                );

                            applyLikedSort(
                                sortKey
                            );

                            sortDropdown.style.display =
                                "none";
                        }
                    );
                }
            );

        document.addEventListener(
            "click",
            () => {

                sortDropdown.style.display =
                    "none";
            }
        );
    }

    function applyLikedSort(
        sortKey
    ) {

        currentLikedSort =
            sortKey;

        if (
            sortKey ===
            "date-desc"
        ) {

            wishlist.sort(
                (a, b) =>
                    new Date(
                        b.likedAt || 0
                    ) -
                    new Date(
                        a.likedAt || 0
                    )
            );

        } else if (
            sortKey ===
            "date-asc"
        ) {

            wishlist.sort(
                (a, b) =>
                    new Date(
                        a.likedAt || 0
                    ) -
                    new Date(
                        b.likedAt || 0
                    )
            );

        } else if (
            sortKey ===
            "title-asc"
        ) {

            wishlist.sort(
                (a, b) =>
                    (
                        a.customTitle ||
                        a.originalTitle ||
                        ""
                    ).localeCompare(
                        b.customTitle ||
                        b.originalTitle ||
                        ""
                    )
            );

        } else if (
            sortKey ===
            "artist-asc"
        ) {

            wishlist.sort(
                (a, b) =>
                    (
                        a.author ||
                        ""
                    ).localeCompare(
                        b.author ||
                        ""
                    )
            );
        }

        renderLikedPageView();

        showToast(
            "Liked songs sorted."
        );
    }

    /* =========================================================
       TOAST
       ========================================================= */

    function showToast(
        message,
        duration = 3000
    ) {

        /*
         * Use existing global toast if available.
         */

        if (
            typeof window.showToast ===
            "function" &&
            window.showToast !== showToast
        ) {

            window.showToast(
                message,
                duration
            );

            return;
        }

        let container =
            document.getElementById(
                "toast-container"
            );

        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.id =
                "toast-container";

            container.className =
                "toast-container";

            document.body.appendChild(
                container
            );
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            "toast";

        toast.innerHTML =
            message;

        container.appendChild(
            toast
        );

        setTimeout(
            () => {

                toast.classList.add(
                    "hide"
                );

                setTimeout(
                    () => {
                        toast.remove();
                    },
                    300
                );

            },
            duration
        );
    }

    /* =========================================================
       AUTH CHANGE
       ========================================================= */

    window.refreshUserMusicData =
        async function () {

            await loadWishlist();
            await loadMemories();

            updateWishlistCounters();
            renderWishlistItems();
            renderLikedPageView();
            renderMemoriesPageView();
            updateLikeButtonState();
        };

    /*
     * If auth script dispatches this event
     * after login, reload user's private data.
     */

    window.addEventListener(
        "userLoggedIn",
        async () => {

            await window.refreshUserMusicData();
        }
    );

    window.addEventListener(
        "userLoggedOut",
        () => {

            wishlist = [];
            memoriesHistory = [];
            currentTrack = null;

            updateWishlistCounters();
            renderWishlistItems();
            renderLikedPageView();
            renderMemoriesPageView();
            updateLikeButtonState();
        }
    );

    /* =========================================================
       GLOBALS
       ========================================================= */

    window.openMemoryTitleModal =
        openMemoryTitleModal;

    window.toggleWishlistCurrentSong =
        toggleCurrentTrackLike;

    window.renderLikedPageView =
        renderLikedPageView;

    window.renderMemoriesPageView =
        renderMemoriesPageView;

    window.getWishlistCount =
        () => wishlist.length;

    window.getCustomTitleForSong =
        getCustomTitleForSong;

    window.openSettingsWishlist =
        openSettingsWishlist;

    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            async () => {

                await initWishlist();

                setupLikedSort();
            }
        );

    } else {

        initWishlist().then(
            () => setupLikedSort()
        );
    }


    /* =========================================================
       GLOBAL SYNC & AUTH LISTENERS
       ========================================================= */

    window.syncLocalWishlistWithDatabase = async function () {
        if (!isLoggedIn()) return;
        const local = getLocalWishlist();
        if (local.length > 0) {
            try {
                await apiRequest("/api/wishlist/sync", {
                    method: "POST",
                    body: JSON.stringify({ songs: local })
                });
            } catch (e) {
                console.warn("Wishlist sync error:", e);
            }
        }
        await loadWishlist();
        await loadMemories();
        updateWishlistCounters();
        renderLikedPageView();
        renderMemoriesPageView();
        updateLikeButtonState();
    };

    window.addEventListener("auth-state-changed", function () {
        if (typeof window.syncLocalWishlistWithDatabase === "function") {
            window.syncLocalWishlistWithDatabase();
        }
    });

    // Re-bind like buttons periodically as modals open
    setInterval(bindLikeButton, 1500);

})();