/* =========================================================
   NOSTALGIC RADIO — SOFT GLOW CURSOR (DESKTOP & MOBILE)
   ========================================================= */

(function () {
    let cursorGlow = null;
    let touchGlow = null;
    let mouseX = -500;
    let mouseY = -500;
    let currentX = -500;
    let currentY = -500;
    let isTouch = false;
    let glowEnabled = true;

    function initGlow() {
        cursorGlow = document.getElementById("ambient-cursor-glow");
        touchGlow = document.getElementById("touch-glow");

        // Check if glow is disabled in preferences
        const savedGlow = localStorage.getItem("nostalgic_glow_enabled");
        if (savedGlow !== null) {
            glowEnabled = savedGlow === "true";
        }

        const glowToggle = document.getElementById("pref-glow-toggle");
        if (glowToggle) {
            glowToggle.checked = glowEnabled;
            glowToggle.addEventListener("change", (e) => {
                glowEnabled = e.target.checked;
                localStorage.setItem("nostalgic_glow_enabled", glowEnabled);
                if (cursorGlow) {
                    cursorGlow.style.display = glowEnabled ? "block" : "none";
                }
                if (touchGlow) {
                    touchGlow.style.display = glowEnabled ? "block" : "none";
                }
            });
        }

        if (!glowEnabled) {
            if (cursorGlow) cursorGlow.style.display = "none";
            if (touchGlow) touchGlow.style.display = "none";
        }

        // ===================================
        // DESKTOP: Mouse movement & Hover
        // ===================================
        window.addEventListener("mousemove", (e) => {
            if (isTouch || !glowEnabled) return;
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (cursorGlow) {
                cursorGlow.style.opacity = "1";
            }
            spawnMusicNote(e.clientX, e.clientY);
        });

        window.addEventListener("mouseout", (e) => {
            if (!e.relatedTarget && cursorGlow) {
                cursorGlow.style.opacity = "0";
            }
        });

        // Hover effect on interactive elements
        const interactiveSelector = "button, a, input, select, .mode-option, .mode-stack-card, .glass-button, .player-button, .play-button, .setting-option, .faq-list details, .preset-chip";
        
        document.addEventListener("mouseover", (e) => {
            if (!cursorGlow || isTouch) return;
            if (e.target.closest(interactiveSelector)) {
                cursorGlow.classList.add("hovering");
            }
        });

        document.addEventListener("mouseout", (e) => {
            if (!cursorGlow || isTouch) return;
            if (e.target.closest(interactiveSelector)) {
                cursorGlow.classList.remove("hovering");
            }
        });

        // Smooth Lerp loop for desktop cursor glow
        function renderLoop() {
            if (!isTouch && glowEnabled && cursorGlow) {
                // Linear interpolation (lerp) for buttery physics
                currentX += (mouseX - currentX) * 0.15;
                currentY += (mouseY - currentY) * 0.15;
                cursorGlow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
            requestAnimationFrame(renderLoop);
        }
        renderLoop();

        // ===================================
        // MOBILE & TOUCH: Touch glow
        // ===================================
        window.addEventListener("touchstart", (e) => {
            isTouch = true;
            if (!glowEnabled || !touchGlow) return;
            const touch = e.touches[0];
            if (touch) {
                touchGlow.style.transform = `translate3d(${touch.clientX}px, ${touch.clientY}px, 0)`;
                touchGlow.classList.add("active");
                createTouchRipple(touch.clientX, touch.clientY);
            }
        }, { passive: true });

        window.addEventListener("touchmove", (e) => {
            if (!glowEnabled || !touchGlow) return;
            const touch = e.touches[0];
            if (touch) {
                touchGlow.style.transform = `translate3d(${touch.clientX}px, ${touch.clientY}px, 0)`;
                spawnMusicNote(touch.clientX, touch.clientY);
            }
        }, { passive: true });

        window.addEventListener("touchend", () => {
            if (!touchGlow) return;
            touchGlow.classList.remove("active");
        }, { passive: true });
    }

    // ==============================================
    // MUSICAL NOTES CURSOR TRAIL (USER REQUEST)
    // ==============================================
    const MUSIC_NOTES = ['♪', '♫', '♬', '♩', '♯', '♭', '𝄞'];
    const NOTE_COLORS = [
        '#ff5964', '#fec601', '#35ff69', '#00f0ff', 
        '#bd00ff', '#ff8400', '#ff0077', '#a6ff00', '#ffd700'
    ];
    let lastNoteX = -100;
    let lastNoteY = -100;

    function spawnMusicNote(x, y) {
        if (!glowEnabled) return;
        const dist = Math.hypot(x - lastNoteX, y - lastNoteY);
        if (dist < 22) return; // Spawn note every ~22px
        lastNoteX = x;
        lastNoteY = y;

        const note = document.createElement("span");
        note.className = "cursor-music-note";
        const symbol = MUSIC_NOTES[Math.floor(Math.random() * MUSIC_NOTES.length)];
        const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
        const driftX = (Math.random() - 0.5) * 50;
        const driftXEnd = driftX * 1.8;
        const rot = (Math.random() - 0.5) * 40;
        const rotEnd = (Math.random() - 0.5) * 75;
        const size = 16 + Math.random() * 12;

        note.textContent = symbol;
        note.style.left = `${x}px`;
        note.style.top = `${y}px`;
        note.style.color = color;
        note.style.fontSize = `${size}px`;
        note.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
        note.style.setProperty("--drift-x", `${driftX}px`);
        note.style.setProperty("--drift-x-end", `${driftXEnd}px`);
        note.style.setProperty("--rot", `${rot}deg`);
        note.style.setProperty("--rot-end", `${rotEnd}deg`);

        document.body.appendChild(note);

        note.addEventListener("animationend", () => {
            note.remove();
        });

        setTimeout(() => {
            if (note.parentNode) note.remove();
        }, 1300);
    }

    function createTouchRipple(x, y) {
        if (!glowEnabled) return;
        const ripple = document.createElement("div");
        ripple.className = "touch-ripple-orb";
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => {
            ripple.remove();
        }, 800);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGlow);
    } else {
        initGlow();
    }
})();
