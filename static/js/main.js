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


        console.log(
            "Music modes loaded:",
            musicModes
        );


        createModeButtons();


        /* =====================================
           SELECT FIRST MODE
           ===================================== */

        if (musicModes.length > 0) {

            const firstMode =
                musicModes[0];


            radioState.currentMode =
                firstMode;


            updateModeUI(
                firstMode
            );


            updateSelectedModeButton(
                firstMode
            );


            /*
             * Set the first background directly.
             * This prevents the initial black
             * background before changing modes.
             */

            setInitialBackground(
                firstMode
            );


            console.log(
                "Initial mode:",
                firstMode.name
            );


            console.log(
                "Initial background:",
                firstMode.background
            );


            /*
             * Preload the first background.
             */

            preloadBackground(
                firstMode
            );


            /*
             * IMPORTANT:
             * Initialize the YouTube player for the
             * first mode immediately on page load.
             *
             * Previously the player was initialized
             * only after manually changing the mode.
             */

            if (
                typeof changeMusicMode ===
                "function"
            ) {

                changeMusicMode(
                    firstMode
                );

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
   CREATE MODE BUTTONS
   ========================================= */

function createModeButtons() {

    const modeList =
        document.getElementById(
            "mode-list"
        );

    if (!modeList) {
        return;
    }


    modeList.innerHTML = "";


    musicModes.forEach(function (mode) {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "mode-option";

        button.type =
            "button";

        button.dataset.mode =
            mode.id;


        button.innerHTML = `
            <strong>
                ${mode.icon} ${mode.name}
            </strong>

            <span>
                ${mode.description}
            </span>
        `;


        button.addEventListener(
            "click",
            function () {

                selectMode(mode);

            }
        );


        modeList.appendChild(
            button
        );

    });
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

    if (!mode) {
        return;
    }


    document
        .querySelectorAll(".mode-option")
        .forEach(function (button) {

            button.classList.remove(
                "selected"
            );


            if (
                button.dataset.mode ===
                mode.id
            ) {

                button.classList.add(
                    "selected"
                );

            }

        });

}


/* =========================================
   MODE PANEL
   ========================================= */

function openModePanel() {

    const panel =
        document.getElementById(
            "mode-panel"
        );

    if (!panel) {
        return;
    }


    panel.classList.add(
        "open"
    );

    panel.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeModePanel() {

    const panel =
        document.getElementById(
            "mode-panel"
        );

    if (!panel) {
        return;
    }


    panel.classList.remove(
        "open"
    );

    panel.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================
   SETTINGS PANEL
   ========================================= */

function openSettingsPanel() {

    const panel =
        document.getElementById(
            "settings-panel"
        );

    if (!panel) {
        return;
    }


    panel.classList.add(
        "open"
    );

    panel.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeSettingsPanel() {

    const panel =
        document.getElementById(
            "settings-panel"
        );

    if (!panel) {
        return;
    }


    panel.classList.remove(
        "open"
    );

    panel.setAttribute(
        "aria-hidden",
        "true"
    );

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

        faqPanel.classList.remove(
            "open"
        );

        faqPanel.setAttribute(
            "aria-hidden",
            "true"
        );


        aboutPanel.classList.add(
            "open"
        );

        aboutPanel.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    /*
     * Open FAQ
     */

    function openFAQ() {

        aboutPanel.classList.remove(
            "open"
        );

        aboutPanel.setAttribute(
            "aria-hidden",
            "true"
        );


        faqPanel.classList.add(
            "open"
        );

        faqPanel.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    /*
     * Close About
     */

    function closeAbout() {

        aboutPanel.classList.remove(
            "open"
        );

        aboutPanel.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    /*
     * Close FAQ
     */

    function closeFAQ() {

        faqPanel.classList.remove(
            "open"
        );

        faqPanel.setAttribute(
            "aria-hidden",
            "true"
        );
    }


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