let radioState = {
    currentMode: null,
    playerStyle: "glass"
};

let musicModes = [];


/* =========================================
   CLOCK
   ========================================= */

function updateClock() {

    const clockElement =
        document.getElementById("clock");

    if (!clockElement) {
        return;
    }

    const now = new Date();

    const hours =
        String(now.getHours()).padStart(2, "0");

    const minutes =
        String(now.getMinutes()).padStart(2, "0");

    clockElement.textContent =
        `${hours}:${minutes}`;
}

updateClock();

setInterval(updateClock, 1000);


/* =========================================
   LOAD MUSIC MODES
   ========================================= */
/* =========================================
   LOAD MUSIC MODES
   ========================================= */

async function loadMusicModes() {

    try {

        const response =
            await fetch("/api/playlists");


        if (!response.ok) {

            throw new Error(
                "Could not load music modes"
            );

        }


        musicModes =
            await response.json();

        window.musicModes = musicModes;

        console.log(
            "Music modes loaded:",
            musicModes
        );


        createModeButtons();

        if (typeof window.setupMusicModeStack === "function") {
            window.setupMusicModeStack(musicModes, musicModes[0]);
        }

        /* =====================================
           SELECT FIRST OR RESTORED MODE
           ===================================== */

        if (musicModes.length > 0) {
            let targetMode = musicModes[0];
            const urlParams = new URLSearchParams(window.location.search);
            const queryVideoId = urlParams.get("v") || localStorage.getItem("nostalgic_radio_current_video_id");

            // 1. If we have a videoId, find which mode contains this track
            if (queryVideoId && window.ERA_TRACKS_DB) {
                for (const modeKey of Object.keys(window.ERA_TRACKS_DB)) {
                    if (window.ERA_TRACKS_DB[modeKey].some(t => t.videoId === queryVideoId)) {
                        const found = musicModes.find(m => m.id === modeKey);
                        if (found) {
                            targetMode = found;
                            break;
                        }
                    }
                }
            } else {
                // 2. Otherwise restore saved mode
                const savedModeId = localStorage.getItem("nostalgic_radio_current_mode");
                if (savedModeId) {
                    const found = musicModes.find(m => m.id === savedModeId);
                    if (found) targetMode = found;
                }
            }

            radioState.currentMode = targetMode;

            updateModeUI(targetMode);
            updateSelectedModeButton(targetMode);

            /* Set and preload background */
            setInitialBackground(targetMode);
            preloadBackground(targetMode);

            console.log(
                "Active mode on load:",
                targetMode.name
            );

            /* Initialize YouTube player with restored mode and song */
            if (typeof changeMusicMode === "function") {
                changeMusicMode(targetMode, queryVideoId);
            }

            /* Restore the exact active app view on refresh (mobile and desktop) */
            if (typeof window.restoreAppView === "function") {
                window.restoreAppView();
            }
        }


    } catch (error) {

        console.error(
            "Error loading music modes:",
            error
        );

    }

}


/* =========================================
   INITIAL BACKGROUND
   ========================================= */

function setInitialBackground(mode) {

    if (!mode) {
        return;
    }

    const backgroundLayer =
        document.querySelector(
            ".background-layer-one"
        );

    if (!backgroundLayer) {

        console.warn(
            "Initial background layer not found."
        );

        return;
    }


    if (!mode.background) {

        console.warn(
            "No background configured for:",
            mode.name
        );

        return;
    }


    const backgroundPath =
        `/static/images/backgrounds/${mode.background}`;


    /*
     * Set image immediately
     */

    backgroundLayer.style.backgroundImage =
        `url("${backgroundPath}")`;

    backgroundLayer.style.opacity = "1";


    console.log(
        "Initial background set:",
        backgroundPath
    );


    /*
     * Check whether browser can actually
     * load the image.
     */

    const image =
        new Image();

    image.onload = function () {

        console.log(
            "Initial background loaded successfully:",
            backgroundPath
        );

    };

    image.onerror = function () {

        console.error(
            "Could not load initial background:",
            backgroundPath
        );

    };

    image.src =
        backgroundPath;
}


/* =========================================
   PRELOAD BACKGROUND
   ========================================= */

function preloadBackground(mode) {

    if (!mode || !mode.background) {
        return;
    }

    const image =
        new Image();

    image.src =
        `/static/images/backgrounds/${mode.background}`;

    image.onload = function () {

        console.log(
            "Background preloaded:",
            mode.background
        );

    };

    image.onerror = function () {

        console.error(
            "Background preload failed:",
            mode.background
        );

    };
}


/* =========================================
   CREATE MODE BUTTONS (GRID VIEW WITH PER-MODE COLORS)
   ========================================= */

function createModeButtons() {
    const modeList = document.getElementById("mode-list");
    if (!modeList) return;

    modeList.innerHTML = "";

    musicModes.forEach(function (mode, index) {
        const card = document.createElement("div");
        card.className = "mode-grid-card";
        card.dataset.mode = mode.id;

        const modeColor = mode.color || "#ffaa33";
        const modeGlow = mode.glow || "rgba(255, 170, 51, 0.45)";
        card.style.setProperty("--mode-color", modeColor);
        card.style.setProperty("--mode-glow", modeGlow);

        const bgPath = mode.background ? `/static/images/backgrounds/${mode.background}` : "";

        card.innerHTML = `
            <div class="grid-card-bg" style="background-image: url('${bgPath}')"></div>
            <div class="grid-card-overlay"></div>
            
            <div class="grid-card-top">
                <span class="grid-card-badge">ERA 0${index + 1}</span>
                <span class="grid-card-icon">${mode.icon || '📻'}</span>
            </div>

            <div class="grid-card-content">
                <h3 class="grid-card-title">${mode.name}</h3>
                <p class="grid-card-desc">${mode.description}</p>
            </div>

            <div class="grid-card-footer">
                <span class="grid-tune-tag">▶ TUNE IN</span>
            </div>
        `;

        if (radioState.currentMode && radioState.currentMode.id === mode.id) {
            card.classList.add("selected");
        }

        card.addEventListener("click", function () {
            selectMode(mode);
        });

        modeList.appendChild(card);
    });
}

/* =========================================
   WELCOME USERNAME TYPING ANIMATION (TEXT ONLY)
   ========================================= */
let welcomeTypingTimer = null;
let currentWelcomeName = "";

function typeWelcomeUsername(name) {
    const targetName = name || "Sumera";
    const nameEl = document.getElementById("welcome-username-text");
    if (!nameEl) return;

    if (welcomeTypingTimer) {
        clearInterval(welcomeTypingTimer);
        welcomeTypingTimer = null;
    }

    const currentText = nameEl.textContent;
    if (currentText && currentText !== targetName) {
        // Smooth backspace effect when switching names
        let len = currentText.length;
        const backspaceTimer = setInterval(() => {
            if (len > 0) {
                len--;
                nameEl.textContent = currentText.substring(0, len);
            } else {
                clearInterval(backspaceTimer);
                startTypingLetters();
            }
        }, 30);
    } else {
        startTypingLetters();
    }

    function startTypingLetters() {
        nameEl.textContent = "";
        let i = 0;
        welcomeTypingTimer = setInterval(() => {
            if (i < targetName.length) {
                nameEl.textContent += targetName.charAt(i);
                i++;
            } else {
                clearInterval(welcomeTypingTimer);
                welcomeTypingTimer = null;
                currentWelcomeName = targetName;
            }
        }, 85);
    }
}

window.typeWelcomeUsername = typeWelcomeUsername;

/* =========================================
   APP VIEW ROUTER & REFRESH STATE PRESERVATION
   Supports: home, player, eras, wishlist, settings, reviews, about, faq
   Both Mobile & Desktop
   ========================================= */

let currentAppView = "home";

function getActiveAppView() {
    return currentAppView;
}

function switchAppSubview(viewName) {
    if (!viewName) viewName = "home";
    currentAppView = viewName;

    // Subviews mapping
    const subviews = {
        home: document.getElementById("subview-home"),
        liked: document.getElementById("subview-liked"),
        search: document.getElementById("subview-search"),
        memories: document.getElementById("subview-memories")
    };

    // Close overlays if navigating to a main subview
    if (["home", "liked", "search", "memories"].includes(viewName)) {
        if (typeof closeModePanel === "function") closeModePanel();
        if (typeof closeSettingsPanel === "function") closeSettingsPanel();
        if (typeof closeReviewsModal === "function") closeReviewsModal();
        if (typeof window.closeEchoQuickSheet === "function") window.closeEchoQuickSheet();
    }

    // Toggle subview visibility
    Object.keys(subviews).forEach(key => {
        const el = subviews[key];
        if (el) {
            if (key === viewName) {
                el.style.display = "block";
                el.classList.add("active");
            } else {
                el.style.display = "none";
                el.classList.remove("active");
            }
        }
    });

    // Special view triggers
    if (viewName === "liked" && typeof window.renderLikedPageView === "function") {
        window.renderLikedPageView();
    } else if (viewName === "memories" && typeof window.renderMemoriesPageView === "function") {
        window.renderMemoriesPageView();
    }

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Sync Echo Pill Navbar and Glass Bar
    syncEchoPillNav(viewName);

    // Persist to history and localStorage
    try {
        localStorage.setItem("nostalgic_active_view", viewName);
        sessionStorage.setItem("nostalgic_active_view", viewName);
        const currentSearch = window.location.search || "";
        const hash = (viewName === "home") ? "" : `#${viewName}`;
        window.history.replaceState(null, "", `${window.location.pathname}${currentSearch}${hash}`);
    } catch (e) {}
}

function syncEchoPillNav(viewName) {
    const echoPills = document.querySelectorAll(".echo-nav-pill");
    echoPills.forEach(pill => {
        if (pill.getAttribute("data-view") === viewName) {
            pill.classList.add("active");
        } else {
            pill.classList.remove("active");
        }
    });

    // Also support classic bottom items
    const navHome = document.getElementById("mob-nav-home");
    const navEras = document.getElementById("mob-nav-eras");
    const navWishlist = document.getElementById("mob-nav-wishlist");
    const navSettings = document.getElementById("mob-nav-settings");
    const allItems = [navHome, navEras, navWishlist, navSettings].filter(Boolean);
    allItems.forEach(btn => btn.classList.remove("active"));

    if (viewName === "eras" && navEras) navEras.classList.add("active");
    else if ((viewName === "wishlist" || viewName === "liked") && navWishlist) navWishlist.classList.add("active");
    else if (viewName === "settings" && navSettings) navSettings.classList.add("active");
    else if (navHome && viewName === "home") navHome.classList.add("active");

    // Sync desktop top glass buttons
    const topSearch = document.getElementById("top-search-btn");
    const topLiked = document.getElementById("top-liked-btn");
    const topMemories = document.getElementById("top-memories-btn");
    [topSearch, topLiked, topMemories].forEach(btn => btn && btn.classList.remove("active"));
    if (viewName === "search" && topSearch) topSearch.classList.add("active");
    if (viewName === "liked" && topLiked) topLiked.classList.add("active");
    if (viewName === "memories" && topMemories) topMemories.classList.add("active");
}

function setActiveAppView(viewName) {
    if (!viewName) viewName = "home";

    if (["home", "liked", "search", "memories"].includes(viewName)) {
        switchAppSubview(viewName);
        return;
    }

    currentAppView = viewName;
    try {
        localStorage.setItem("nostalgic_active_view", viewName);
        sessionStorage.setItem("nostalgic_active_view", viewName);
        const currentSearch = window.location.search || "";
        const hash = (viewName === "home") ? "" : `#${viewName}`;
        window.history.replaceState(null, "", `${window.location.pathname}${currentSearch}${hash}`);
    } catch (e) {}

    syncEchoPillNav(viewName);
}

function restoreAppView() {
    let view = "";
    if (window.location.hash) {
        view = window.location.hash.replace("#", "").trim();
    }
    if (!view) {
        view = sessionStorage.getItem("nostalgic_active_view") || localStorage.getItem("nostalgic_active_view") || "home";
    }

    if (window.location.pathname.includes("/wishlist")) view = "liked";

    console.log("Restoring active view on refresh:", view);

    setTimeout(() => {
        if (view === "player") {
            if (typeof window.openSpotifyPlayerModal === "function") {
                window.openSpotifyPlayerModal();
            }
        } else if (view === "liked" || view === "wishlist") {
            switchAppSubview("liked");
        } else if (view === "search") {
            switchAppSubview("search");
        } else if (view === "memories") {
            switchAppSubview("memories");
        } else if (view === "eras") {
            switchAppSubview("home");
            openModePanel();
        } else if (view === "settings") {
            switchAppSubview("home");
            openSettingsPanel();
        } else if (view === "reviews") {
            switchAppSubview("home");
            openReviewsModal();
        } else if (view === "about") {
            switchAppSubview("home");
            if (typeof window.openAboutPanel === "function") {
                window.openAboutPanel();
            }
        } else if (view === "faq") {
            switchAppSubview("home");
            if (typeof window.openFaqPanel === "function") {
                window.openFaqPanel();
            }
        } else {
            switchAppSubview("home");
        }
    }, 180);
}

window.getActiveAppView = getActiveAppView;
window.setActiveAppView = setActiveAppView;
window.switchAppSubview = switchAppSubview;
window.restoreAppView = restoreAppView;

/* =========================================
   COMMUNITY REVIEWS & MEMORIES MODAL
   ========================================= */
function openReviewsModal() {
    const modal = document.getElementById("reviews-modal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setActiveAppView("reviews");
}

function closeReviewsModal() {
    const modal = document.getElementById("reviews-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");

    if (getActiveAppView() === "reviews") {
        setActiveAppView("home");
    }
}

window.openReviewsModal = openReviewsModal;
window.closeReviewsModal = closeReviewsModal;

function initReviewsModalEvents() {
    const navReviewsBtn = document.getElementById("nav-reviews-btn");
    const settingsReviewsBtn = document.getElementById("settings-open-reviews-btn");
    const closeReviewsBtn = document.getElementById("close-reviews-modal");
    const reviewsModal = document.getElementById("reviews-modal");

    if (navReviewsBtn) {
        navReviewsBtn.addEventListener("click", () => openReviewsModal());
    }

    if (settingsReviewsBtn) {
        settingsReviewsBtn.addEventListener("click", () => {
            closeSettingsPanel();
            openReviewsModal();
        });
    }

    if (closeReviewsBtn) {
        closeReviewsBtn.addEventListener("click", () => closeReviewsModal());
    }

    if (reviewsModal) {
        reviewsModal.addEventListener("click", (e) => {
            if (e.target === reviewsModal || e.target.classList.contains("reviews-modal-backdrop")) {
                closeReviewsModal();
            }
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReviewsModalEvents);
} else {
    initReviewsModalEvents();
}



/* =========================================
   SELECT MODE
   ========================================= */

function selectMode(mode) {

    if (!mode) {
        return;
    }


    const previousMode =
        radioState.currentMode;


    radioState.currentMode =
        mode;


    console.log(
        "Selected mode:",
        mode.name
    );


    updateModeUI(mode);

    updateSelectedModeButton(
        mode
    );

    if (typeof window.updateSelectedStackMode === "function") {
        window.updateSelectedStackMode(mode);
    }

    /*
     * Change background only when
     * the mode actually changes.
     */

    if (
        !previousMode ||
        previousMode.id !== mode.id
    ) {

        applyModeTheme(mode);

    }


    closeModePanel();


    /*
     * Change YouTube music mode
     */

    if (
        typeof changeMusicMode ===
        "function"
    ) {

        changeMusicMode(mode);

    }

}

window.selectMode = selectMode;


/* =========================================
   UPDATE MODE UI
   ========================================= */

function updateModeUI(mode) {

    if (!mode) {
        return;
    }


    const modeLabel =
        document.getElementById(
            "mode-label"
        );

    const modeTitle =
        document.getElementById(
            "mode-title"
        );

    const modeDescription =
        document.getElementById(
            "mode-description"
        );


    if (modeLabel) {

        modeLabel.textContent =
            "NOSTALGIC RADIO";

    }


    if (modeTitle) {

        modeTitle.textContent =
            mode.name;

    }


    if (modeDescription) {

        modeDescription.textContent =
            mode.description;

    }

}


/* =========================================
   UPDATE SELECTED MODE BUTTON
   ========================================= */

function updateSelectedModeButton(mode) {
    if (!mode) return;

    document.querySelectorAll(".mode-grid-card, .mode-option").forEach(function (button) {
        button.classList.remove("selected");
        if (button.dataset.mode === mode.id) {
            button.classList.add("selected");
        }
    });
}


/* =========================================
   MODE PANEL
   ========================================= */

function openModePanel() {
    const panel = document.getElementById("mode-panel");
    if (!panel) return;

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");

    if (typeof window.setupMusicModeStack === "function") {
        window.setupMusicModeStack(musicModes, radioState.currentMode);
    }

    setActiveAppView("eras");
}

function closeModePanel() {
    const panel = document.getElementById("mode-panel");
    if (!panel) return;

    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");

    if (getActiveAppView() === "eras") {
        setActiveAppView("home");
    }
}

function openSettingsPanel() {
    const panel = document.getElementById("settings-panel");
    if (!panel) return;

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");

    setActiveAppView("settings");
}

function closeSettingsPanel() {
    const panel = document.getElementById("settings-panel");
    if (!panel) return;

    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");

    if (getActiveAppView() === "settings" || getActiveAppView() === "wishlist") {
        setActiveAppView("home");
    }
}


/* =========================================
   PLAYER STYLE
   ========================================= */

function setPlayerStyle(style) {

    radioState.playerStyle =
        style;


    document.body.dataset.playerStyle =
        style;


    document
        .querySelectorAll(".setting-option")
        .forEach(function (button) {

            button.classList.remove(
                "selected"
            );


            if (
                button.dataset.playerStyle ===
                style
            ) {

                button.classList.add(
                    "selected"
                );

            }

        });


    localStorage.setItem(
        "playerStyle",
        style
    );


    console.log(
        "Player style:",
        style
    );

}


/* =========================================
   LOAD SAVED SETTINGS
   ========================================= */

function loadSavedSettings() {

    const savedStyle =
        localStorage.getItem(
            "playerStyle"
        );


    if (savedStyle) {

        setPlayerStyle(
            savedStyle
        );

    }

}


/* =========================================
   MODE BUTTON
   ========================================= */

const modeButton =
    document.getElementById(
        "mode-button"
    );

if (modeButton) {

    modeButton.addEventListener(
        "click",
        function () {

            openModePanel();

        }
    );

}


/* =========================================
   CLOSE MODE BUTTON
   ========================================= */

const closeModeButton =
    document.getElementById(
        "close-mode-button"
    );

if (closeModeButton) {

    closeModeButton.addEventListener(
        "click",
        function () {

            closeModePanel();

        }
    );

}


/* =========================================
   SETTINGS BUTTON
   ========================================= */

const settingsButton =
    document.getElementById(
        "settings-button"
    );

if (settingsButton) {

    settingsButton.addEventListener(
        "click",
        function () {

            openSettingsPanel();

        }
    );

}


/* =========================================
   CLOSE SETTINGS BUTTON
   ========================================= */

const closeSettingsButton =
    document.getElementById(
        "close-settings-button"
    );

if (closeSettingsButton) {

    closeSettingsButton.addEventListener(
        "click",
        function () {

            closeSettingsPanel();

        }
    );

}


/* =========================================
   PLAYER STYLE BUTTONS
   ========================================= */

document
    .querySelectorAll(".setting-option")
    .forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const style =
                    button.dataset.playerStyle;

                setPlayerStyle(
                    style
                );

            }
        );

    });


/* =========================================
   OUTSIDE CLICK — MODE PANEL
   ========================================= */

const modePanel =
    document.getElementById(
        "mode-panel"
    );

if (modePanel) {

    modePanel.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                modePanel
            ) {

                closeModePanel();

            }

        }
    );

}


/* =========================================
   OUTSIDE CLICK — SETTINGS
   ========================================= */

const settingsPanel =
    document.getElementById(
        "settings-panel"
    );

if (settingsPanel) {

    settingsPanel.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                settingsPanel
            ) {

                closeSettingsPanel();

            }

        }
    );

}


/* =========================================
   ESCAPE KEY
   ========================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeModePanel();

            closeSettingsPanel();

        }

    }
);


/* =========================================
   START APPLICATION
   ========================================= */

loadSavedSettings();

loadMusicModes();
/* =========================================
   ABOUT & FAQ PANELS
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const aboutButton =
        document.getElementById("about-button");

    const faqButton =
        document.getElementById("faq-button");

    const aboutPanel =
        document.getElementById("about-panel");

    const faqPanel =
        document.getElementById("faq-panel");

    const closeAboutButton =
        document.getElementById(
            "close-about-button"
        );

    const closeFaqButton =
        document.getElementById(
            "close-faq-button"
        );


    /*
     * Check elements
     */

    if (
        !aboutButton ||
        !faqButton ||
        !aboutPanel ||
        !faqPanel
    ) {

        console.warn(
            "About / FAQ elements not found."
        );

        return;
    }


    /*
     * Open About
     */
    function openAbout() {
        faqPanel.classList.remove("open");
        faqPanel.setAttribute("aria-hidden", "true");

        aboutPanel.classList.add("open");
        aboutPanel.setAttribute("aria-hidden", "false");

        setActiveAppView("about");
    }

    /*
     * Open FAQ
     */
    function openFAQ() {
        aboutPanel.classList.remove("open");
        aboutPanel.setAttribute("aria-hidden", "true");

        faqPanel.classList.add("open");
        faqPanel.setAttribute("aria-hidden", "false");

        setActiveAppView("faq");
    }

    /*
     * Close About
     */
    function closeAbout() {
        aboutPanel.classList.remove("open");
        aboutPanel.setAttribute("aria-hidden", "true");

        if (getActiveAppView() === "about") {
            setActiveAppView("home");
        }
    }

    /*
     * Close FAQ
     */
    function closeFAQ() {
        faqPanel.classList.remove("open");
        faqPanel.setAttribute("aria-hidden", "true");

        if (getActiveAppView() === "faq") {
            setActiveAppView("home");
        }
    }

    window.openAboutPanel = openAbout;
    window.closeAboutPanel = closeAbout;
    window.openFaqPanel = openFAQ;
    window.closeFaqPanel = closeFAQ;


    /*
     * Button events
     */

    aboutButton.addEventListener(
        "click",
        openAbout
    );


    faqButton.addEventListener(
        "click",
        openFAQ
    );


    /*
     * Close buttons
     */

    if (closeAboutButton) {

        closeAboutButton.addEventListener(
            "click",
            closeAbout
        );
    }


    if (closeFaqButton) {

        closeFaqButton.addEventListener(
            "click",
            closeFAQ
        );
    }


    /*
     * Close when clicking outside
     */

    aboutPanel.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                aboutPanel
            ) {

                closeAbout();
            }
        }
    );


    faqPanel.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                faqPanel
            ) {

                closeFAQ();
            }
        }
    );


    /*
     * ESC key
     */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key ===
                "Escape"
            ) {

                closeAbout();

                closeFAQ();
            }
        }
    );

});
/* =========================================
   EXPLORE TEXT ANIMATION
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const exploreText =
        document.getElementById(
            "explore-changing-text"
        );

    if (!exploreText) {

        console.warn(
            "Explore changing text not found."
        );

        return;
    }


    const exploreWords = [
        "Movies",
        "Animated",
        "Memories",
        "Music"
    ];


    let currentWord = 0;


    function changeExploreWord() {

        /*
         * Fade out
         */

        exploreText.style.opacity = "0";

        exploreText.style.transform =
            "translateY(8px)";


        setTimeout(function () {

            /*
             * Next word
             */

            currentWord =
                (currentWord + 1) %
                exploreWords.length;


            exploreText.textContent =
                exploreWords[currentWord];


            /*
             * Fade in
             */

            exploreText.style.opacity = "1";

            exploreText.style.transform =
                "translateY(0)";

        }, 450);
    }


    /*
     * Start changing every 3 seconds
     */

    setInterval(
        changeExploreWord,
        3000
    );

});

/* =========================================
   TOAST NOTIFICATION SYSTEM
   ========================================= */

window.showToast = function (message, duration = 3200) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.innerHTML = `
        <div class="toast-body">${message}</div>
        <button class="toast-close-btn" type="button" aria-label="Close notification">×</button>
    `;

    const closeBtn = toast.querySelector(".toast-close-btn");
    closeBtn.addEventListener("click", () => {
        toast.classList.add("closing");
        setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add("closing");
            setTimeout(() => toast.remove(), 250);
        }
    }, duration);
};

/* =========================================
   SCREENSAVER CINEMATIC MODE
   ========================================= */

function toggleScreensaver() {
    const isActive = document.body.classList.toggle("screensaver-active");
    if (isActive) {
        closeSettingsPanel();
        if (window.showToast) {
            window.showToast("Screensaver Mode active ◐ Press Esc or tap Exit to return.", 3500);
        }
    }
}

const screensaverBtn = document.getElementById("screensaver-button");
if (screensaverBtn) {
    screensaverBtn.addEventListener("click", toggleScreensaver);
}

const exitScreensaverBtn = document.getElementById("exit-screensaver-btn");
if (exitScreensaverBtn) {
    exitScreensaverBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        document.body.classList.remove("screensaver-active");
    });
}

window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("screensaver-active")) {
        document.body.classList.remove("screensaver-active");
    }
});

// Background & Screen-Off Audio Setting Toggle
document.addEventListener("DOMContentLoaded", function () {
    const bgPlaybackToggle = document.getElementById("pref-bg-playback-toggle");
    if (bgPlaybackToggle) {
        const isEnabled = localStorage.getItem("nostalgic_background_playback") !== "false";
        bgPlaybackToggle.checked = isEnabled;
        bgPlaybackToggle.addEventListener("change", function () {
            const val = bgPlaybackToggle.checked;
            localStorage.setItem("nostalgic_background_playback", val ? "true" : "false");
            window.isBackgroundAudioEnabled = val;
            if (typeof window.showToast === "function") {
                window.showToast(val ? "📻 Background & Screen-off audio enabled" : "⚠️ Background audio disabled");
            }
        });
    }
});

/* =========================================
   ECHO MUSIC ANIMATED NAVBAR, MINI PLAYER & SEARCH
   ========================================= */

function initEchoNavigation() {
    // 1. Echo Pill Buttons
    const echoPills = document.querySelectorAll(".echo-nav-pill");
    echoPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const targetView = pill.getAttribute("data-view") || "home";
            switchAppSubview(targetView);
        });
    });

    // 2. Floating Action Button & Quick Sheet (•••)
    const echoMoreBtn = document.getElementById("echo-more-btn");
    const echoQuickSheet = document.getElementById("echo-quick-sheet");
    const closeEchoSheetBtn = document.getElementById("close-echo-sheet");
    const echoSheetBackdrop = document.getElementById("echo-sheet-backdrop");

    function openEchoQuickSheet() {
        if (echoQuickSheet) {
            echoQuickSheet.classList.add("open");
            echoQuickSheet.setAttribute("aria-hidden", "false");
        }
    }

    function closeEchoQuickSheet() {
        if (echoQuickSheet) {
            echoQuickSheet.classList.remove("open");
            echoQuickSheet.setAttribute("aria-hidden", "true");
        }
    }

    window.openEchoQuickSheet = openEchoQuickSheet;
    window.closeEchoQuickSheet = closeEchoQuickSheet;

    if (echoMoreBtn) echoMoreBtn.addEventListener("click", openEchoQuickSheet);
    if (closeEchoSheetBtn) closeEchoSheetBtn.addEventListener("click", closeEchoQuickSheet);
    if (echoSheetBackdrop) echoSheetBackdrop.addEventListener("click", closeEchoQuickSheet);

    // Quick Sheet items
    const qsEras = document.getElementById("qs-eras-btn");
    if (qsEras) {
        qsEras.addEventListener("click", () => {
            closeEchoQuickSheet();
            openModePanel();
        });
    }

    const qsRain = document.getElementById("qs-rain-btn");
    if (qsRain) {
        qsRain.addEventListener("click", () => {
            closeEchoQuickSheet();
            const rainBtn = document.getElementById("rain-button");
            if (rainBtn) rainBtn.click();
        });
    }

    const qsSettings = document.getElementById("qs-settings-btn");
    if (qsSettings) {
        qsSettings.addEventListener("click", () => {
            closeEchoQuickSheet();
            openSettingsPanel();
        });
    }

    const qsAbout = document.getElementById("qs-about-btn");
    if (qsAbout) {
        qsAbout.addEventListener("click", () => {
            closeEchoQuickSheet();
            if (typeof window.openAboutPanel === "function") window.openAboutPanel();
        });
    }

    const qsFaq = document.getElementById("qs-faq-btn");
    if (qsFaq) {
        qsFaq.addEventListener("click", () => {
            closeEchoQuickSheet();
            if (typeof window.openFaqPanel === "function") window.openFaqPanel();
        });
    }

    // 3. Desktop Navigation Glass Icon Buttons
    const deskSearch = document.getElementById("top-search-btn") || document.getElementById("desktop-nav-search");
    const deskLiked = document.getElementById("top-liked-btn") || document.getElementById("desktop-nav-liked");
    const deskMemories = document.getElementById("top-memories-btn") || document.getElementById("desktop-nav-memories");

    if (deskSearch) deskSearch.addEventListener("click", () => switchAppSubview("search"));
    if (deskLiked) deskLiked.addEventListener("click", () => switchAppSubview("liked"));
    if (deskMemories) deskMemories.addEventListener("click", () => switchAppSubview("memories"));

    // Subview Back Buttons
    const searchBackBtn = document.getElementById("search-page-back-btn");
    const memoriesBackBtn = document.getElementById("memories-page-back-btn");
    if (searchBackBtn) searchBackBtn.addEventListener("click", () => switchAppSubview("home"));
    if (memoriesBackBtn) memoriesBackBtn.addEventListener("click", () => switchAppSubview("home"));

    // 4. Search & Explore Page Setup
    initSearchAndExplore();

    // 5. Classic Glass Bar Compatibility
    const navHome = document.getElementById("mob-nav-home");
    const navEras = document.getElementById("mob-nav-eras");
    const navWishlist = document.getElementById("mob-nav-wishlist");
    const navSettings = document.getElementById("mob-nav-settings");

    if (navHome) navHome.addEventListener("click", () => switchAppSubview("home"));
    if (navEras) navEras.addEventListener("click", () => openModePanel());
    if (navWishlist) navWishlist.addEventListener("click", () => switchAppSubview("liked"));
    if (navSettings) navSettings.addEventListener("click", () => openSettingsPanel());

    window.addEventListener("hashchange", () => {
        restoreAppView();
    });
}

/* =========================================
   SEARCH & EXPLORE PAGE LOGIC
   ========================================= */

function initSearchAndExplore() {
    const searchInput = document.getElementById("retro-search-input");
    const clearBtn = document.getElementById("search-clear-btn");
    const exploreContent = document.getElementById("search-explore-content");
    const liveResults = document.getElementById("search-live-results");
    const resultsList = document.getElementById("search-results-list");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length > 0) {
            if (clearBtn) clearBtn.style.display = "block";
            if (exploreContent) exploreContent.style.display = "none";
            if (liveResults) liveResults.style.display = "block";
            performSearch(query, resultsList);
        } else {
            if (clearBtn) clearBtn.style.display = "none";
            if (exploreContent) exploreContent.style.display = "block";
            if (liveResults) liveResults.style.display = "none";
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearBtn.style.display = "none";
            if (exploreContent) exploreContent.style.display = "block";
            if (liveResults) liveResults.style.display = "none";
            searchInput.focus();
        });
    }

    // Sub-tabs (Explore, Suggestions, Album)
    const subTabs = document.querySelectorAll(".search-sub-tab");
    subTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const tabName = tab.getAttribute("data-tab");
            if (tabName === "suggestions") {
                searchInput.value = "Romantic";
                searchInput.dispatchEvent(new Event("input"));
            } else if (tabName === "eras") {
                openModePanel();
            }
        });
    });

    // Moods mapping to eras
    const moodMap = {
        "chill": "lofi",
        "commute": "night-drive",
        "energize": "bihar-bangers",
        "feel-good": "90s-era",
        "focus": "lofi",
        "gaming": "night-drive",
        "party": "punjabi-bangers",
        "romance": "romantic",
        "sad": "sad",
        "sleep": "lofi",
        "workout": "punjabi-bangers"
    };

    document.querySelectorAll(".mood-pill-card").forEach(pill => {
        pill.addEventListener("click", () => {
            const mood = pill.getAttribute("data-mood");
            const targetEraId = moodMap[mood] || "90s-era";
            playEraById(targetEraId, `Mood: ${pill.textContent.trim()} 🎶`);
        });
    });

    // Genre & Eras pill cards
    document.querySelectorAll(".genre-pill-card").forEach(pill => {
        pill.addEventListener("click", () => {
            const eraId = pill.getAttribute("data-era");
            playEraById(eraId, `Playing ${pill.textContent.trim()} 📻`);
        });
    });
}

function playEraById(eraId, toastMsg) {
    if (window.musicModes) {
        const found = window.musicModes.find(m => m.id === eraId);
        if (found && typeof changeMusicMode === "function") {
            changeMusicMode(found);
            switchAppSubview("home");
            if (typeof showToast === "function") {
                showToast(toastMsg || `Switched to ${found.name}`);
            }
            return;
        }
    }

    if (window.ERA_TRACKS_DB && window.ERA_TRACKS_DB[eraId]) {
        const firstTrack = window.ERA_TRACKS_DB[eraId][0];
        if (firstTrack && typeof window.playSpecificSong === "function") {
            window.playSpecificSong(firstTrack.videoId, firstTrack.title, eraId);
            switchAppSubview("home");
            if (typeof showToast === "function") {
                showToast(toastMsg || `Playing ${firstTrack.title}`);
            }
        }
    }
}

function performSearch(query, resultsList) {
    if (!resultsList || !window.ERA_TRACKS_DB) return;

    const matches = [];
    Object.keys(window.ERA_TRACKS_DB).forEach(eraKey => {
        const trackList = window.ERA_TRACKS_DB[eraKey];
        trackList.forEach(track => {
            const titleMatch = track.title && track.title.toLowerCase().includes(query);
            const artistMatch = track.artist && track.artist.toLowerCase().includes(query);
            const eraMatch = eraKey.toLowerCase().includes(query);

            if (titleMatch || artistMatch || eraMatch) {
                if (!matches.some(m => m.videoId === track.videoId)) {
                    matches.push({ ...track, eraKey });
                }
            }
        });
    });

    if (matches.length === 0) {
        resultsList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: #8c8376;">
                <p>No retro songs found for "${query}".</p>
                <p style="font-size: 12px;">Try searching for "Kumar Sanu", "Lata", "90s", "Romantic" or "Kahin Pyaar".</p>
            </div>
        `;
        return;
    }

    resultsList.innerHTML = "";
    matches.slice(0, 20).forEach(track => {
        const row = document.createElement("div");
        row.className = "liked-song-row";
        const fallbackArt = "/static/images/backgrounds/papa-era.jpeg";
        const thumbUrl = `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`;

        row.innerHTML = `
            <img class="liked-song-thumb" src="${thumbUrl}" alt="${track.title}" onerror="this.src='${fallbackArt}'">
            <div class="liked-song-info">
                <span class="liked-song-title">${track.title}</span>
                <div class="liked-song-meta">
                    <span>${track.artist || 'Classic Artist'}</span>
                    <span>•</span>
                    <span>${track.duration || '4:00'}</span>
                </div>
            </div>
            <button class="liked-row-dots-btn" type="button" title="Play">
                ▶
            </button>
        `;

        row.addEventListener("click", () => {
            if (typeof window.playSpecificSong === "function") {
                window.playSpecificSong(track.videoId, track.title, track.eraKey);
                switchAppSubview("home");
            }
        });

        resultsList.appendChild(row);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEchoNavigation);
} else {
    initEchoNavigation();
}
