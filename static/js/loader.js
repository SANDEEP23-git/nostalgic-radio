/* =========================================================
   NOSTALGIC RADIO — VINTAGE PRELOADER & INTRO SCREEN
   ========================================================= */

(function () {
    const quotes = [
        "Warming up the vacuum tubes...",
        "Tuning into golden memories & forgotten melodies...",
        "Searching through the analog frequencies...",
        "Dusting off the vintage vinyl records...",
        "Echoes of the past are ready to play."
    ];

    let currentQuoteIndex = 0;
    let quoteInterval = null;
    let freqInterval = null;

    function initLoader() {
        const loader = document.getElementById("intro-loader");
        if (!loader) return;

        const progressFill = document.getElementById("loader-progress-fill");
        const quoteText = document.getElementById("loader-quote-text");
        const freqDisplay = document.getElementById("loader-freq-display");
        const needle = document.getElementById("tuning-needle");
        const enterBtn = document.getElementById("loader-enter-button");

        // Rotate quotes
        if (quoteText) {
            quoteInterval = setInterval(() => {
                currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
                quoteText.style.opacity = "0";
                setTimeout(() => {
                    quoteText.textContent = quotes[currentQuoteIndex];
                    quoteText.style.opacity = "1";
                }, 300);
            }, 1800);
        }

        // Animate frequency needle
        let freq = 88.5;
        if (freqDisplay && needle) {
            freqInterval = setInterval(() => {
                freq = +(88 + Math.random() * 20).toFixed(1);
                freqDisplay.textContent = `${freq} MHz`;
                const percent = Math.min(100, Math.max(0, ((freq - 88) / 20) * 100));
                needle.style.left = `${percent}%`;
            }, 350);
        }

        // Progress animation
        let progress = 10;
        const progressTimer = setInterval(() => {
            progress += Math.floor(Math.random() * 18) + 12;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressTimer);
                if (progressFill) progressFill.style.width = "100%";
                
                // Show enter button prominently
                if (enterBtn) {
                    enterBtn.classList.add("ready");
                    enterBtn.textContent = "▶ ENTER RADIO";
                }

                // Auto dismiss after brief moment unless clicked earlier
                setTimeout(() => {
                    dismissLoader();
                }, 1600);
            } else {
                if (progressFill) progressFill.style.width = `${progress}%`;
            }
        }, 180);

        // Click to enter
        if (enterBtn) {
            enterBtn.addEventListener("click", () => {
                dismissLoader();
            });
        }

        // Clicking anywhere on loader after progress >= 70% also dismisses
        loader.addEventListener("click", (e) => {
            if (progress >= 70 && !e.target.closest("a")) {
                dismissLoader();
            }
        });
    }

    function dismissLoader() {
        const loader = document.getElementById("intro-loader");
        if (!loader || loader.classList.contains("dismissed")) return;

        loader.classList.add("dismissed");

        if (quoteInterval) clearInterval(quoteInterval);
        if (freqInterval) clearInterval(freqInterval);

        // Remove from view after transition
        setTimeout(() => {
            loader.style.display = "none";
        }, 850);

        // Stage transition: If user is verified and logged in, go to Music Home, else to Login!
        setTimeout(() => {
            if (typeof window.showAppStage === "function") {
                const user = typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
                if (user && user.name && (user.id || user._id)) {
                    window.showAppStage("music-home");
                } else {
                    window.showAppStage("login-reviews");
                }
            }
        }, 350);
    }

    // Auto initialize when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLoader);
    } else {
        initLoader();
    }

    window.dismissIntroLoader = dismissLoader;
})();
