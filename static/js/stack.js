/* =========================================================
   NOSTALGIC RADIO — 3D MUSIC MODES STACK DECK
   ========================================================= */

(function () {
    let modes = [];
    let activeIndex = 0;
    let isStackView = true;

    async function initStack() {
        bindViewToggle();
        bindStackControls();
        bindKeyboardNav();
        bindTouchSwipe();

        // 1. Try to load modes immediately
        await ensureModesLoaded();

        // 2. Setup global hook
        window.setupMusicModeStack = function (loadedModes, currentSelectedMode) {
            if (loadedModes && loadedModes.length) {
                modes = loadedModes;
            }
            if (currentSelectedMode) {
                const foundIndex = modes.findIndex(m => m.id === currentSelectedMode.id);
                if (foundIndex >= 0) activeIndex = foundIndex;
            }
            renderStackDeck();
            renderIndicators();
        };

        window.updateSelectedStackMode = function (selectedMode) {
            if (!modes.length || !selectedMode) return;
            const index = modes.findIndex(m => m.id === selectedMode.id);
            if (index >= 0) {
                activeIndex = index;
                updateStackTransforms();
                updateIndicators();
            }
        };

        // If modes are ready, render immediately
        if (modes.length > 0) {
            renderStackDeck();
            renderIndicators();
        }
    }

    async function ensureModesLoaded() {
        if (window.musicModes && window.musicModes.length > 0) {
            modes = window.musicModes;
            return;
        }

        try {
            const res = await fetch("/api/playlists");
            if (res.ok) {
                modes = await res.json();
                window.musicModes = modes;
            }
        } catch (err) {
            console.error("stack.js could not load playlists:", err);
        }
    }

    function bindViewToggle() {
        const stackBtn = document.getElementById("view-stack-btn");
        const gridBtn = document.getElementById("view-grid-btn");
        const stackContainer = document.getElementById("mode-stack-container");
        const gridContainer = document.getElementById("mode-list");

        if (stackBtn && gridBtn) {
            stackBtn.addEventListener("click", () => {
                isStackView = true;
                stackBtn.classList.add("active");
                gridBtn.classList.remove("active");
                if (stackContainer) stackContainer.style.display = "block";
                if (gridContainer) gridContainer.style.display = "none";
                renderStackDeck();
            });

            gridBtn.addEventListener("click", () => {
                isStackView = false;
                gridBtn.classList.add("active");
                stackBtn.classList.remove("active");
                if (stackContainer) stackContainer.style.display = "none";
                if (gridContainer) gridContainer.style.display = "grid";
            });
        }
    }

    function bindStackControls() {
        const prevBtn = document.getElementById("stack-prev-btn");
        const nextBtn = document.getElementById("stack-next-btn");

        if (prevBtn) {
            prevBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                navigateStack(-1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                navigateStack(1);
            });
        }
    }

    function navigateStack(direction) {
        if (!modes.length) return;
        activeIndex = (activeIndex + direction + modes.length) % modes.length;
        updateStackTransforms();
        updateIndicators();
    }

    function renderStackDeck() {
        const deck = document.getElementById("mode-stack-deck");
        if (!deck) return;

        if (!modes.length) {
            ensureModesLoaded().then(() => {
                if (modes.length) {
                    renderStackDeck();
                    renderIndicators();
                }
            });
            return;
        }

        deck.innerHTML = "";

        modes.forEach((mode, index) => {
            const card = document.createElement("div");
            card.className = "mode-stack-card";
            card.dataset.index = index;
            card.dataset.modeId = mode.id;

            const cardColor = mode.color || "#ffaa33";
            const cardGlow = mode.glow || "rgba(255, 170, 51, 0.45)";
            card.style.setProperty("--card-color", cardColor);
            card.style.setProperty("--card-glow", cardGlow);

            const bgPath = mode.background ? `/static/images/backgrounds/${mode.background}` : "";

            card.innerHTML = `
                <div class="card-bg-layer" style="background-image: url('${bgPath}')"></div>
                <div class="card-glass-overlay"></div>
                
                <div class="card-top-row">
                    <span class="card-badge">ERA ${index + 1} OF ${modes.length}</span>
                    <span class="card-icon">${mode.icon || '📻'}</span>
                </div>

                <div class="card-center-art">
                    <div class="card-vinyl-mock">
                        <div class="mock-vinyl-grooves"></div>
                        <div class="mock-vinyl-label">${mode.icon || '🎵'}</div>
                    </div>
                </div>

                <div class="card-bottom-info">
                    <h3 class="card-title">${mode.name}</h3>
                    <p class="card-desc">${mode.description}</p>
                    
                    <button class="card-tune-btn" type="button" data-mode-id="${mode.id}">
                        <span>TUNE IN NOW</span>
                        <span class="tune-btn-arrow">→</span>
                    </button>
                </div>
            `;

            // Clicking on tune button
            const tuneBtn = card.querySelector(".card-tune-btn");
            if (tuneBtn) {
                tuneBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (window.selectMode) {
                        window.selectMode(mode);
                    }
                });
            }

            // Clicking anywhere on this card
            card.addEventListener("click", () => {
                if (index === activeIndex) {
                    // Already in front, tune into it!
                    if (window.selectMode) {
                        window.selectMode(mode);
                    }
                } else {
                    // Bring to front
                    activeIndex = index;
                    updateStackTransforms();
                    updateIndicators();
                }
            });

            deck.appendChild(card);
        });

        updateStackTransforms();
    }

    function updateStackTransforms() {
        const cards = document.querySelectorAll(".mode-stack-card");
        if (!cards.length) return;

        const total = cards.length;

        const isMobile = window.innerWidth <= 600;
        const y1 = isMobile ? -10 : -18;
        const y2 = isMobile ? -20 : -36;
        const y3 = isMobile ? -30 : -52;
        const y4 = isMobile ? -40 : -68;

        cards.forEach((card, i) => {
            let offset = i - activeIndex;
            if (offset < 0) offset += total;

            card.classList.remove("active-card", "next-1", "next-2", "next-3", "hidden-card");

            if (offset === 0) {
                // Front active card
                card.classList.add("active-card");
                card.style.transform = "translate3d(0, 0, 0) scale(1) rotate(0deg)";
                card.style.opacity = "1";
                card.style.zIndex = "10";
                card.style.pointerEvents = "auto";
                card.setAttribute("aria-hidden", "false");
            } else if (offset === 1) {
                // 1 card behind
                card.classList.add("next-1");
                card.style.transform = `translate3d(0, ${y1}px, -40px) scale(0.94) rotate(-2deg)`;
                card.style.opacity = "0.85";
                card.style.zIndex = "9";
                card.style.pointerEvents = "auto";
                card.setAttribute("aria-hidden", "true");
            } else if (offset === 2) {
                // 2 cards behind
                card.classList.add("next-2");
                card.style.transform = `translate3d(0, ${y2}px, -80px) scale(0.88) rotate(2deg)`;
                card.style.opacity = "0.68";
                card.style.zIndex = "8";
                card.style.pointerEvents = "auto";
                card.setAttribute("aria-hidden", "true");
            } else if (offset === 3) {
                // 3 cards behind
                card.classList.add("next-3");
                card.style.transform = `translate3d(0, ${y3}px, -120px) scale(0.82) rotate(-3.5deg)`;
                card.style.opacity = "0.45";
                card.style.zIndex = "7";
                card.style.pointerEvents = "auto";
                card.setAttribute("aria-hidden", "true");
            } else {
                // Hidden deep in stack
                card.classList.add("hidden-card");
                card.style.transform = `translate3d(0, ${y4}px, -160px) scale(0.76) rotate(0deg)`;
                card.style.opacity = "0";
                card.style.zIndex = "1";
                card.style.pointerEvents = "none";
                card.setAttribute("aria-hidden", "true");
            }
        });
    }

    function renderIndicators() {
        const container = document.getElementById("stack-indicators");
        if (!container || !modes.length) return;

        container.innerHTML = "";

        modes.forEach((mode, index) => {
            const dot = document.createElement("button");
            dot.className = `stack-dot ${index === activeIndex ? 'active' : ''}`;
            dot.type = "button";
            dot.title = mode.name;
            dot.addEventListener("click", () => {
                activeIndex = index;
                updateStackTransforms();
                updateIndicators();
            });
            container.appendChild(dot);
        });
    }

    function updateIndicators() {
        const dots = document.querySelectorAll(".stack-dot");
        const activeMode = modes[activeIndex];
        const activeColor = activeMode ? (activeMode.color || "#ffaa33") : "#ffaa33";

        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.classList.add("active");
                dot.style.background = activeColor;
                dot.style.boxShadow = `0 0 10px ${activeColor}`;
            } else {
                dot.classList.remove("active");
                dot.style.background = "";
                dot.style.boxShadow = "";
            }
        });
    }

    function bindKeyboardNav() {
        window.addEventListener("keydown", (e) => {
            const modePanel = document.getElementById("mode-panel");
            if (!modePanel || !modePanel.classList.contains("open") || !isStackView) return;

            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                navigateStack(-1);
            } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                navigateStack(1);
            } else if (e.key === "Enter") {
                if (modes[activeIndex] && window.selectMode) {
                    window.selectMode(modes[activeIndex]);
                }
            }
        });
    }

    function bindTouchSwipe() {
        const stage = document.querySelector(".stack-stage");
        if (!stage) return;

        let startX = 0;
        let startY = 0;

        stage.addEventListener("touchstart", (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: true });

        stage.addEventListener("touchend", (e) => {
            const touch = e.changedTouches[0];
            const diffX = touch.clientX - startX;
            const diffY = touch.clientY - startY;

            if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX < 0) {
                    navigateStack(1);
                } else {
                    navigateStack(-1);
                }
            }
        }, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initStack);
    } else {
        initStack();
    }
})();
