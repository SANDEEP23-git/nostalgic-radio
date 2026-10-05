

(function () {
    const STORAGE_KEY_USER = "nostalgic_radio_user";

    let currentUser = null;
    let currentStage = "loader";

    function setCurrentUser(user) {
        currentUser = user;
        window.currentUser = user;
        if (user) {
            try {
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
            } catch (e) {}
            if (typeof window.syncLocalWishlistWithDatabase === "function") {
                window.syncLocalWishlistWithDatabase();
            }
        } else {
            try {
                localStorage.removeItem(STORAGE_KEY_USER);
            } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: user }));
    }


    async function initAuth() {
        
        syncServerAuth();

    
        bindStageEvents();
        bindAuthFormEvents();
        bindSettingsEvents();
        startGateClock();

        
        window.showAppStage = showAppStage;
        window.handleUserLogout = handleUserLogout;
        window.getCurrentUser = () => currentUser;
        window.currentUser = currentUser;
        window.updateAuthUI = updateUI;

        
        checkInitialModalTab();

        
        await verifyBackendSession();

        
        updateUI();

        
        if (currentUser && currentUser.name) {
            showAppStage("music-home");
        } else {
            
            if (currentStage !== "loader") {
                showAppStage("login-reviews");
            }
        }
    }


    function syncServerAuth() {
        if (window.SERVER_AUTH) {
            if (window.SERVER_AUTH.isAuthenticated && window.SERVER_AUTH.user) {
                setCurrentUser(window.SERVER_AUTH.user);
                try {
                    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
                } catch (e) {}
            } else {
                currentUser = null;
                try {
                    localStorage.removeItem(STORAGE_KEY_USER);
                } catch (e) {}
            }
            return;
        }

        try {
            const saved = localStorage.getItem(STORAGE_KEY_USER);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && (parsed.id || parsed._id) && !parsed.isGuest) {
                    setCurrentUser(parsed);
                } else {
                    currentUser = null;
                    localStorage.removeItem(STORAGE_KEY_USER);
                }
            }
        } catch (e) {
            currentUser = null;
        }
    }


    async function verifyBackendSession() {
        try {
            const res = await fetch("/api/auth/me", {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store"
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.logged_in && data.user) {
                    setCurrentUser(data.user);
                    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
                } else {
                    currentUser = null;
                    localStorage.removeItem(STORAGE_KEY_USER);
                }
            } else {
                currentUser = null;
                localStorage.removeItem(STORAGE_KEY_USER);
            }
        } catch (e) {
            console.warn("Could not verify session with server:", e);
        }
    }


    function checkInitialModalTab() {
        const bodyModal = document.body.getAttribute("data-open-modal");
        const path = window.location.pathname;

        if (bodyModal === "signup" || path.includes("/signup")) {
            switchAuthTab("signup");
        } else if (bodyModal === "login" || path.includes("/login")) {
            switchAuthTab("login");
        }
    }


    function showAppStage(stageName) {
        const loader = document.getElementById("intro-loader");
        const pageLoginReviews = document.getElementById("page-login-reviews");
        const pageMusicHome = document.getElementById("page-music-home");

        // STRICT ACCESS CHECK: Without logging in, CANNOT go to music-home!
        if (stageName === "music-home") {
            if (!currentUser || !currentUser.name) {
                console.warn("Access denied to music home: Authentication required.");
                showAuthAlert("🔒 Please create an account and sign in to enter Nostalgic Radio.", "error");
                showToast("🔒 Please log in or create an account first!", 4000);
                shakeAuthCard();
                stageName = "login-reviews";
            }
        }

        currentStage = stageName;

        if (stageName === "music-home") {
            
            if (loader && !loader.classList.contains("dismissed")) {
                loader.classList.add("dismissed");
                setTimeout(() => { loader.style.display = "none"; }, 500);
            } else if (loader) {
                loader.style.display = "none";
            }

            
            if (pageLoginReviews) pageLoginReviews.style.display = "none";
            if (pageMusicHome) pageMusicHome.style.display = "flex";

            window.scrollTo({ top: 0, behavior: "smooth" });
            updateUI();

        } else if (stageName === "login-reviews") {
            
            if (loader && !loader.classList.contains("dismissed")) {
                loader.classList.add("dismissed");
                setTimeout(() => { loader.style.display = "none"; }, 500);
            } else if (loader) {
                loader.style.display = "none";
            }

            
            if (pageMusicHome) pageMusicHome.style.display = "none";
            if (pageLoginReviews) pageLoginReviews.style.display = "block";

            
            const authCard = document.getElementById("auth-landing-card");
            if (authCard) {
                authCard.style.display = "block";
                triggerCardBorderGlow(document.getElementById("gate-tab-signup")?.classList.contains("active") ? "signup" : "login");
            }

            const gateNavLoginBtn = document.getElementById("gate-nav-login-btn");
            const gateNavReviewsBtn = document.getElementById("gate-nav-reviews-btn");
            if (gateNavLoginBtn) gateNavLoginBtn.classList.add("active");
            if (gateNavReviewsBtn) gateNavReviewsBtn.classList.remove("active");


            pauseMusicPlayer();


            closeAllPanels();


            prefillLoginForm();

            window.scrollTo({ top: 0, behavior: "smooth" });
            updateGateClock();

        } else if (stageName === "loader") {
            if (loader) {
                loader.classList.remove("dismissed");
                loader.style.display = "flex";
            }
            if (pageLoginReviews) pageLoginReviews.style.display = "none";
            if (pageMusicHome) pageMusicHome.style.display = "none";
        }
    }


    function prefillLoginForm(identifier) {
        const loginInput = document.getElementById("gate-login-email");
        if (loginInput) {
            if (identifier) {
                loginInput.value = identifier;
            } else if (!loginInput.value && currentUser && currentUser.email) {
                loginInput.value = currentUser.email;
            }
        }
    }

    function showAuthAlert(message, type = "error") {
        const alertBox = document.getElementById("auth-card-alert");
        if (!alertBox) return;

        alertBox.textContent = message;
        alertBox.className = `auth-card-alert auth-alert-${type}`;
        alertBox.style.display = "block";

        if (type === "error") {
            shakeAuthCard();
        }
    }

    function clearAuthAlert() {
        const alertBox = document.getElementById("auth-card-alert");
        if (alertBox) {
            alertBox.style.display = "none";
            alertBox.textContent = "";
        }
    }

    function shakeAuthCard() {
        const card = document.getElementById("auth-landing-card");
        if (card) {
            card.classList.remove("shake-card");
            void card.offsetWidth;
            card.classList.add("shake-card");
        }
    }


    function updateUI() {
        const settingsName = document.getElementById("settings-profile-name");
        const settingsEmail = document.getElementById("settings-profile-email");
        const settingsAvatar = document.getElementById("settings-avatar-icon");
        const editNameInput = document.getElementById("settings-edit-username");
        const signoutBtn = document.getElementById("signout-button");
        const authBtn = document.getElementById("auth-button");
        const sessionUsernameDisplay = document.getElementById("session-username-display");
        const sessionStatusSubtext = document.getElementById("session-status-subtext");
        const logoutRowBtn = document.getElementById("settings-logout-row-btn");

        const displayName = currentUser && currentUser.name ? currentUser.name : "Listener";
        const displayEmail = currentUser && currentUser.email ? currentUser.email : "user@nostalgic-radio.com";

        // 1. Pure text typewriter welcome text on music home
        if (typeof window.typeWelcomeUsername === "function" && currentUser && currentUser.name) {
            window.typeWelcomeUsername(displayName);
        }


        if (authBtn) {
            authBtn.style.display = "none";
        }
        if (signoutBtn) {
            signoutBtn.style.display = "inline-flex";
        }

        if (settingsName) settingsName.textContent = displayName;
        if (settingsEmail) settingsEmail.textContent = displayEmail;
        if (settingsAvatar) settingsAvatar.textContent = displayName.charAt(0).toUpperCase();
        if (editNameInput) editNameInput.value = displayName;

        // 3. Settings Account & Session Row - ONLY Log Out action pill
        if (sessionUsernameDisplay) {
            sessionUsernameDisplay.textContent = `Logged in as: ${displayName}`;
        }
        if (sessionStatusSubtext) {
            sessionStatusSubtext.textContent = "Click Log Out to disconnect and return to login page.";
        }

        if (logoutRowBtn) {
            logoutRowBtn.style.display = "inline-flex";
            logoutRowBtn.className = "settings-action-pill danger";
            logoutRowBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Log Out</span>
            `;
            logoutRowBtn.title = "Log Out from Nostalgic Radio";
        }
    }


    function triggerCardBorderGlow(targetTab) {
        const card = document.getElementById("auth-landing-card");
        if (!card) return;

        card.classList.remove(
            "pulse-glow-login", "pulse-glow-signup", "pulse-glow-forgot",
            "glow-mode-login", "glow-mode-signup", "glow-mode-forgot"
        );
        void card.offsetWidth;

        if (targetTab === "signup") {
            card.classList.add("glow-mode-signup", "pulse-glow-signup");
        } else if (targetTab === "forgot") {
            card.classList.add("glow-mode-forgot", "pulse-glow-forgot");
        } else {
            card.classList.add("glow-mode-login", "pulse-glow-login");
        }
    }

    function switchAuthTab(tab) {
        const tabLogin = document.getElementById("gate-tab-login");
        const tabSignup = document.getElementById("gate-tab-signup");
        const formLogin = document.getElementById("gate-login-form");
        const formSignup = document.getElementById("gate-signup-form");
        const formForgot = document.getElementById("gate-forgot-form");

        if (tab === "login") {
            if (tabLogin) tabLogin.classList.add("active");
            if (tabSignup) tabSignup.classList.remove("active");
            if (formLogin) formLogin.classList.add("active");
            if (formSignup) formSignup.classList.remove("active");
            if (formForgot) formForgot.classList.remove("active");
        } else if (tab === "signup") {
            if (tabLogin) tabLogin.classList.remove("active");
            if (tabSignup) tabSignup.classList.add("active");
            if (formLogin) formLogin.classList.remove("active");
            if (formSignup) formSignup.classList.add("active");
            if (formForgot) formForgot.classList.remove("active");
        } else if (tab === "forgot") {
            if (tabLogin) tabLogin.classList.remove("active");
            if (tabSignup) tabSignup.classList.remove("active");
            if (formLogin) formLogin.classList.remove("active");
            if (formSignup) formSignup.classList.remove("active");
            if (formForgot) formForgot.classList.add("active");
        }

        triggerCardBorderGlow(tab);
    }

    /* =========================================
       BIND AUTH FORM & TAB EVENTS
       ========================================= */
    function bindAuthFormEvents() {
        const tabLogin = document.getElementById("gate-tab-login");
        const tabSignup = document.getElementById("gate-tab-signup");
        const formLogin = document.getElementById("gate-login-form");
        const formSignup = document.getElementById("gate-signup-form");
        const switchToSignupBtn = document.getElementById("gate-switch-to-signup");
        const switchToLoginBtn = document.getElementById("gate-switch-to-login");
        const forgotPassBtn = document.getElementById("gate-forgot-pass-btn");
        const forgotBackToLoginBtn = document.getElementById("gate-forgot-back-to-login");
        const formForgot = document.getElementById("gate-forgot-form");

        if (tabLogin && tabSignup) {
            tabLogin.addEventListener("click", () => {
                clearAuthAlert();
                switchAuthTab("login");
            });
            tabSignup.addEventListener("click", () => {
                clearAuthAlert();
                switchAuthTab("signup");
            });
        }

        if (switchToSignupBtn) {
            switchToSignupBtn.addEventListener("click", (e) => {
                e.preventDefault();
                clearAuthAlert();
                switchAuthTab("signup");
                const nameInput = document.getElementById("gate-signup-name");
                if (nameInput) nameInput.focus();
            });
        }

        if (switchToLoginBtn) {
            switchToLoginBtn.addEventListener("click", (e) => {
                e.preventDefault();
                clearAuthAlert();
                switchAuthTab("login");
                const loginInput = document.getElementById("gate-login-email");
                if (loginInput) loginInput.focus();
            });
        }

        // Trigger Forgot Password Form
        if (forgotPassBtn) {
            forgotPassBtn.addEventListener("click", (e) => {
                e.preventDefault();
                clearAuthAlert();

                // If user already typed their email in the login box, copy it over
                const loginEmailInput = document.getElementById("gate-login-email");
                const forgotIdentifierInput = document.getElementById("gate-forgot-identifier");
                const forgotNewPassInput = document.getElementById("gate-forgot-new-password");

                if (loginEmailInput && forgotIdentifierInput && loginEmailInput.value.trim()) {
                    forgotIdentifierInput.value = loginEmailInput.value.trim();
                }

                switchAuthTab("forgot");

                if (forgotIdentifierInput && forgotIdentifierInput.value.trim() && forgotNewPassInput) {
                    forgotNewPassInput.focus();
                } else if (forgotIdentifierInput) {
                    forgotIdentifierInput.focus();
                }
            });
        }

        // Return from Forgot Password to Sign In
        if (forgotBackToLoginBtn) {
            forgotBackToLoginBtn.addEventListener("click", (e) => {
                e.preventDefault();
                clearAuthAlert();
                switchAuthTab("login");
                const loginInput = document.getElementById("gate-login-email");
                if (loginInput) loginInput.focus();
            });
        }

        /* -----------------------------------------
           1. SIGNUP: SAVE USER IN DATABASE
           User must create account in database first!
           ----------------------------------------- */
        if (formSignup) {
            formSignup.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearAuthAlert();

                const nameInput = document.getElementById("gate-signup-name");
                const emailInput = document.getElementById("gate-signup-email");
                const passInput = document.getElementById("gate-signup-password");
                const eraSelect = document.getElementById("gate-signup-era");
                const submitBtn = document.getElementById("gate-signup-submit-btn");

                const name = nameInput ? nameInput.value.trim() : "";
                const email = emailInput ? emailInput.value.trim() : "";
                const password = passInput ? passInput.value : "";
                const favorite_era = eraSelect ? eraSelect.value : "90s-era";

                if (!name) {
                    showAuthAlert("Please enter your full name.", "error");
                    if (nameInput) nameInput.focus();
                    return;
                }

                if (!email || !email.includes("@") || !email.includes(".")) {
                    showAuthAlert("Please enter a valid email address.", "error");
                    if (emailInput) emailInput.focus();
                    return;
                }

                if (!password || password.length < 4) {
                    showAuthAlert("Password must be at least 4 characters long.", "error");
                    if (passInput) passInput.focus();
                    return;
                }

                // Set loading state on submit button
                const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span>Saving to Database...</span>`;
                }

                try {
                    const response = await fetch("/api/auth/signup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: name,
                            email: email,
                            password: password,
                            favorite_era: favorite_era
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        const errMsg = data.message || "Could not create account. Please try again.";
                        showAuthAlert(errMsg, "error");
                        showToast(errMsg, 4000);
                        return;
                    }

                    // SUCCESS: User saved in MongoDB!
                    // Now, switch user to Login tab so they log in with their new credentials
                    showAuthAlert("✅ Account created in database! Now please sign in with your password.", "success");
                    showToast("🎉 Account created successfully in database! Please sign in now.", 5000);

                    // Switch to Login tab
                    switchAuthTab("login");

                    // Pre-fill email in login form and focus password
                    prefillLoginForm(email);
                    const loginPassInput = document.getElementById("gate-login-password");
                    if (loginPassInput) {
                        loginPassInput.value = "";
                        loginPassInput.focus();
                    }

                } catch (err) {
                    console.error("Signup network error:", err);
                    showAuthAlert("Network error. Please make sure the server is running.", "error");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                }
            });
        }

        /* -----------------------------------------
           2. LOGIN: VERIFY IN DATABASE & ENTER HOME
           User logs in, session created, enters home!
           ----------------------------------------- */
        if (formLogin) {
            formLogin.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearAuthAlert();

                const emailInput = document.getElementById("gate-login-email");
                const passInput = document.getElementById("gate-login-password");
                const submitBtn = document.getElementById("gate-login-submit-btn");

                const identifier = emailInput ? emailInput.value.trim() : "";
                const password = passInput ? passInput.value : "";

                if (!identifier) {
                    showAuthAlert("Please enter your username or email.", "error");
                    if (emailInput) emailInput.focus();
                    return;
                }

                if (!password) {
                    showAuthAlert("Please enter your password.", "error");
                    if (passInput) passInput.focus();
                    return;
                }

                // Set loading state on submit button
                const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span>Signing In...</span>`;
                }

                try {
                    const response = await fetch("/api/auth/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            identifier: identifier,
                            password: password
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        const errMsg = data.message || "Invalid username/email or password.";
                        showAuthAlert(errMsg, "error");
                        showToast(errMsg, 4000);
                        return;
                    }

                    // SUCCESS: Logged in!
                    setCurrentUser(data.user);
                    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));

                    clearAuthAlert();
                    showToast(`Welcome back, ${currentUser.name}! 📻 Tuning in...`, 4000);

                    // If user has a favorite era, apply it
                    if (currentUser.favorite_era && window.musicModes) {
                        const match = window.musicModes.find(m => m.id === currentUser.favorite_era);
                        if (match && typeof window.selectMode === "function") {
                            window.selectMode(match);
                        }
                    }

                    // Transition to Stage 3: Music Home Page
                    showAppStage("music-home");

                } catch (err) {
                    console.error("Login network error:", err);
                    showAuthAlert("Network error. Please make sure the server is running.", "error");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                }
            });
        }

        /* -----------------------------------------
           3. FORGOT / RESET PASSWORD: UPDATE IN DATABASE
           Verifies account, updates password hash in MongoDB,
           and switches to Login tab with credentials pre-filled.
           ----------------------------------------- */
        if (formForgot) {
            formForgot.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearAuthAlert();

                const identifierInput = document.getElementById("gate-forgot-identifier");
                const newPassInput = document.getElementById("gate-forgot-new-password");
                const confirmPassInput = document.getElementById("gate-forgot-confirm-password");
                const submitBtn = document.getElementById("gate-forgot-submit-btn");

                const identifier = identifierInput ? identifierInput.value.trim() : "";
                const newPassword = newPassInput ? newPassInput.value : "";
                const confirmPassword = confirmPassInput ? confirmPassInput.value : "";

                if (!identifier) {
                    showAuthAlert("Please enter your registered username or email.", "error");
                    if (identifierInput) identifierInput.focus();
                    return;
                }

                if (!newPassword || newPassword.length < 4) {
                    showAuthAlert("New password must be at least 4 characters long.", "error");
                    if (newPassInput) newPassInput.focus();
                    return;
                }

                if (newPassword !== confirmPassword) {
                    showAuthAlert("Passwords do not match. Please re-enter.", "error");
                    if (confirmPassInput) confirmPassInput.focus();
                    return;
                }

                // Set loading state on submit button
                const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span>Updating Password...</span>`;
                }

                try {
                    const response = await fetch("/api/auth/reset-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            identifier: identifier,
                            new_password: newPassword,
                            confirm_password: confirmPassword
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        const errMsg = data.message || "Could not reset password. Please check your details.";
                        showAuthAlert(errMsg, "error");
                        showToast(errMsg, 4000);
                        return;
                    }

                    // SUCCESS: Password updated in MongoDB!
                    showAuthAlert("✅ Password updated in database! Please sign in with your new password.", "success");
                    showToast("🎉 Password updated! Now sign in with your new password.", 5000);

                    // Switch back to Login tab
                    switchAuthTab("login");

                    // Pre-fill email/username in login form and focus password
                    const loginEmail = document.getElementById("gate-login-email");
                    const loginPass = document.getElementById("gate-login-password");
                    if (loginEmail) {
                        loginEmail.value = data.identifier || identifier;
                    }
                    if (loginPass) {
                        loginPass.value = "";
                        loginPass.focus();
                    }

                    // Clear forgot password inputs
                    if (newPassInput) newPassInput.value = "";
                    if (confirmPassInput) confirmPassInput.value = "";

                } catch (err) {
                    console.error("Forgot password network error:", err);
                    showAuthAlert("Network error. Please make sure the server is running.", "error");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                }
            });
        }
    }

    /* =========================================
       LOG OUT HANDLER
       Clears Flask session in backend, local state,
       pauses music, closes panels, and returns to Stage 2.
       ========================================= */
    async function handleUserLogout() {
        const prevName = currentUser && currentUser.name ? currentUser.name : "Listener";

        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            console.warn("Logout request failed:", e);
        }

        setCurrentUser(null);

        // Pause audio playback
        pauseMusicPlayer();

        // Close all modals / side panels
        closeAllPanels();

        // Reset password field
        const loginPass = document.getElementById("gate-login-password");
        if (loginPass) loginPass.value = "";

        clearAuthAlert();

        // Switch to Stage 2: Login and Review Page
        showAppStage("login-reviews");

        showToast(`Logged out from ${prevName}'s account. 📻 See you soon!`, 3500);
    }

    /* =========================================
       BIND SETTINGS & STAGE EVENTS
       ========================================= */
    function bindStageEvents() {
        const gateNavLoginBtn = document.getElementById("gate-nav-login-btn");
        const gateNavReviewsBtn = document.getElementById("gate-nav-reviews-btn");
        const authCard = document.getElementById("auth-landing-card");
        const gateCardCloseBtn = document.getElementById("gate-card-close-btn");
        const reviewsSection = document.getElementById("gate-reviews-section");

        if (gateNavLoginBtn) {
            gateNavLoginBtn.addEventListener("click", () => {
                if (authCard) {
                    authCard.style.display = "block";
                    authCard.scrollIntoView({ behavior: "smooth", block: "center" });

                    const isSignup = document.getElementById("gate-tab-signup")?.classList.contains("active");
                    triggerCardBorderGlow(isSignup ? "signup" : "login");

                    setTimeout(() => {
                        const input = document.getElementById(isSignup ? "gate-signup-name" : "gate-login-email");
                        if (input) input.focus();
                    }, 350);
                }

                if (gateNavLoginBtn) gateNavLoginBtn.classList.add("active");
                if (gateNavReviewsBtn) gateNavReviewsBtn.classList.remove("active");
            });
        }

        if (gateNavReviewsBtn) {
            gateNavReviewsBtn.addEventListener("click", () => {
                if (reviewsSection) {
                    reviewsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                }
                if (gateNavReviewsBtn) gateNavReviewsBtn.classList.add("active");
                if (gateNavLoginBtn) gateNavLoginBtn.classList.remove("active");
            });
        }

        // Close card button (Minimizes card on stage 2, does NOT bypass login)
        if (gateCardCloseBtn) {
            gateCardCloseBtn.addEventListener("click", () => {
                if (authCard) {
                    authCard.style.display = "none";
                }
                if (gateNavLoginBtn) gateNavLoginBtn.classList.remove("active");
            });
        }

        // Mobile bar Home button — must obey login requirement!
        const mobNavHome = document.getElementById("mob-nav-home");
        if (mobNavHome) {
            mobNavHome.addEventListener("click", () => {
                if (!currentUser || !currentUser.name) {
                    showToast("🔒 Please log in first to access the radio!", 3500);
                    showAppStage("login-reviews");
                } else {
                    showAppStage("music-home");
                }
            });
        }
    }

    function bindSettingsEvents() {
        const signoutBtn = document.getElementById("signout-button");
        const logoutRowBtn = document.getElementById("settings-logout-row-btn");
        const saveNameBtn = document.getElementById("save-username-btn");
        const editNameInput = document.getElementById("settings-edit-username");

        // Profile Card Log Out Button
        if (signoutBtn) {
            signoutBtn.addEventListener("click", (e) => {
                e.preventDefault();
                handleUserLogout();
            });
        }

        // Account & Session Row Log Out Button
        if (logoutRowBtn) {
            logoutRowBtn.addEventListener("click", (e) => {
                e.preventDefault();
                handleUserLogout();
            });
        }

        // Save username in Settings
        if (saveNameBtn && editNameInput) {
            saveNameBtn.addEventListener("click", () => {
                const newName = editNameInput.value.trim();
                if (!newName) {
                    showToast("Please enter a valid display name.");
                    return;
                }

                if (currentUser) {
                    currentUser.name = newName;
                    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
                    updateUI();
                    showToast(`Display name updated to ${newName}! ✨`);
                }
            });

            editNameInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveNameBtn.click();
                }
            });
        }
    }

    /* =========================================
       HELPER: PAUSE MUSIC
       ========================================= */
    function pauseMusicPlayer() {
        try {
            if (typeof youtubePlayer !== "undefined" && youtubePlayer && typeof youtubePlayer.pauseVideo === "function") {
                youtubePlayer.pauseVideo();
            } else {
                const playBtn = document.getElementById("play-button");
                if (playBtn && playBtn.textContent.trim() === "⏸") {
                    playBtn.click();
                }
            }
        } catch (e) {
            console.warn("Could not pause music:", e);
        }
    }

    /* =========================================
       HELPER: CLOSE ALL PANELS
       ========================================= */
    function closeAllPanels() {
        if (typeof window.closeSettingsPanel === "function") window.closeSettingsPanel();
        if (typeof window.closeModePanel === "function") window.closeModePanel();
        if (typeof window.closeAboutPanel === "function") window.closeAboutPanel();
        if (typeof window.closeFaqPanel === "function") window.closeFaqPanel();

        const panels = document.querySelectorAll(".settings-panel, .mode-panel, .info-panel, .memory-modal");
        panels.forEach(p => {
            p.classList.remove("open");
            p.setAttribute("aria-hidden", "true");
        });
    }

    /* =========================================
       CLOCK FOR STAGE 2 HEADER
       ========================================= */
    function updateGateClock() {
        const gateClockEl = document.getElementById("gate-clock");
        if (!gateClockEl) return;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        gateClockEl.textContent = `${hours}:${minutes}`;
    }

    function startGateClock() {
        updateGateClock();
        setInterval(updateGateClock, 1000);
    }

    function showToast(msg, duration = 3000) {
        if (typeof window.showToast === "function") {
            window.showToast(msg, duration);
        } else {
            console.log("Toast:", msg);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAuth);
    } else {
        initAuth();
    }
})();
