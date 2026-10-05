/* =========================================================
   NOSTALGIC RADIO — SOFT GLOW CURSOR (PERFORMANCE OPTIMIZED)
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
    let isRendering = false;

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
        // DESKTOP: Mouse movement & Hover (Throttled)
        // ===================================
        let lastMove = 0;
        window.addEventListener("mousemove", (e) => {
            if (isTouch || !glowEnabled) return;
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (cursorGlow) {
                cursorGlow.style.opacity = "1";
            }

            const now = performance.now();
            if (now - lastMove > 120) {
                lastMove = now;
                spawnMusicNote(e.clientX, e.clientY);
            }

            if (!isRendering) {
                isRendering = true;
                requestAnimationFrame(renderLoop);
            }
        }, { passive: true });

        window.addEventListener("mouseout", (e) => {
            if (!e.relatedTarget && cursorGlow) {
                cursorGlow.style.opacity = "0";
            }
        });

        // Hover effect on interactive elements
        const interactiveSelector = "button, a, input, select, .mode-option, .mode-stack-card, .glass-button, .player-button, .play-button";
        
        let hoverTimer = null;
        document.addEventListener("mouseover", (e) => {
            if (!cursorGlow || isTouch || !glowEnabled) return;
            if (hoverTimer) return;
            hoverTimer = setTimeout(() => {
                hoverTimer = null;
                if (e.target && e.target.closest && e.target.closest(interactiveSelector)) {
                    cursorGlow.classList.add("hovering");
                }
            }, 30);
        }, { passive: true });

        document.addEventListener("mouseout", (e) => {
            if (!cursorGlow || isTouch) return;
            if (e.target && e.target.closest && e.target.closest(interactiveSelector)) {
                cursorGlow.classList.remove("hovering");
            }
        }, { passive: true });

        // Smooth Lerp loop for desktop cursor glow
        function renderLoop() {
            if (!isTouch && glowEnabled && cursorGlow) {
                const dx = mouseX - currentX;
                const dy = mouseY - currentY;
                
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    currentX += dx * 0.2;
                    currentY += dy * 0.2;
                    cursorGlow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                    requestAnimationFrame(renderLoop);
                    return;
                }
            }
            isRendering = false;
        }

        // ===================================
        // MOBILE & TOUCH
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
            }
        }, { passive: true });

        window.addEventListener("touchend", () => {
            if (!touchGlow) return;
            touchGlow.classList.remove("active");
        }, { passive: true });
    }

    // ==============================================
    // MUSICAL NOTES CURSOR TRAIL (LIGHTWEIGHT)
    // ==============================================
    const MUSIC_NOTES = ['♪', '♫', '♬', '♩', '♯', '♭', '𝄞'];
    const NOTE_COLORS = [
        '#ffaa33', '#ffd166', '#00d9ff', '#ff3399', '#a6ff00'
    ];
    let lastNoteX = -100;
    let lastNoteY = -100;
    let lastNoteTime = 0;

    function spawnMusicNote(x, y) {
        if (!glowEnabled || isTouch) return;
        const now = performance.now();
        if (now - lastNoteTime < 160) return;
        
        const dist = Math.hypot(x - lastNoteX, y - lastNoteY);
        if (dist < 40) return;

        // Limit maximum simultaneous notes in DOM to 5
        const currentNotes = document.getElementsByClassName("cursor-music-note");
        if (currentNotes.length >= 5) {
            currentNotes[0].remove();
        }

        lastNoteTime = now;
        lastNoteX = x;
        lastNoteY = y;

        const note = document.createElement("span");
        note.className = "cursor-music-note";
        const symbol = MUSIC_NOTES[Math.floor(Math.random() * MUSIC_NOTES.length)];
        const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
        const driftX = (Math.random() - 0.5) * 40;
        const rot = (Math.random() - 0.5) * 35;
        const size = 16 + Math.random() * 8;

        note.textContent = symbol;
        note.style.left = `${x}px`;
        note.style.top = `${y}px`;
        note.style.color = color;
        note.style.fontSize = `${size}px`;
        note.style.textShadow = `0 0 8px ${color}`;
        note.style.setProperty("--drift-x", `${driftX}px`);
        note.style.setProperty("--drift-x-end", `${driftX * 1.5}px`);
        note.style.setProperty("--rot", `${rot}deg`);
        note.style.setProperty("--rot-end", `${rot * 1.5}deg`);

        document.body.appendChild(note);

        setTimeout(() => {
            if (note.parentNode) note.remove();
        }, 900);
    }

    function createTouchRipple(x, y) {
        if (!glowEnabled) return;
        const ripple = document.createElement("div");
        ripple.className = "touch-ripple-orb";
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => {
            if (ripple.parentNode) ripple.remove();
        }, 600);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGlow);
    } else {
        initGlow();
    }
})();
