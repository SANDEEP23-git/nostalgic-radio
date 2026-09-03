/* =========================================
   NOSTALGIC RADIO
   REALISTIC RAIN + RAIN SOUND
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const rainButton =
        document.getElementById("rain-button");

    const radioPage =
        document.querySelector(".radio-page");

    const rainOverlay =
        document.getElementById("rain-overlay");


    /* =========================================
       CHECK ELEMENTS
       ========================================= */

    if (
        !rainButton ||
        !radioPage ||
        !rainOverlay
    ) {
        console.warn(
            "Rain elements not found."
        );

        return;
    }


    /* =========================================
       RAIN STATE
       ========================================= */

    let rainEnabled =
        localStorage.getItem(
            "rainEnabled"
        ) === "true";


    /* =========================================
       RAIN AUDIO
       ========================================= */

    const rainSound =
        new Audio(
            "/static/audio/rain.mp3"
        );

    rainSound.loop = true;

    /*
     * Keep rain behind the music.
     * 0.0 = silent
     * 1.0 = maximum
     */

    rainSound.volume = 0;


    let rainAudioTargetVolume = 0.28;

    let rainFadeTimer = null;


    /* =========================================
       FADE RAIN SOUND
       ========================================= */

    function fadeRainSound(
        targetVolume,
        duration = 800
    ) {

        clearInterval(
            rainFadeTimer
        );


        const startVolume =
            rainSound.volume;

        const difference =
            targetVolume -
            startVolume;

        const startTime =
            performance.now();


        rainFadeTimer =
            setInterval(function () {

                const elapsed =
                    performance.now() -
                    startTime;

                const progress =
                    Math.min(
                        elapsed /
                        duration,
                        1
                    );


                /*
                 * Smooth easing.
                 */

                const eased =
                    progress *
                    (2 - progress);


                rainSound.volume =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            startVolume +
                            difference *
                            eased
                        )
                    );


                if (progress >= 1) {

                    clearInterval(
                        rainFadeTimer
                    );

                    rainFadeTimer = null;


                    /*
                     * Completely stop
                     * the audio after fade out.
                     */

                    if (
                        targetVolume === 0
                    ) {

                        rainSound.pause();

                        rainSound.currentTime = 0;
                    }
                }

            }, 30);
    }


    /* =========================================
       START RAIN SOUND
       ========================================= */

    function startRainSound() {

        /*
         * Start from current position
         * if already playing.
         */

        const playPromise =
            rainSound.play();


        /*
         * Browser autoplay protection.
         */

        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(
                function () {

                    console.log(
                        "Rain sound waiting for user interaction."
                    );

                }
            );
        }


        fadeRainSound(
            rainAudioTargetVolume,
            1200
        );
    }


    /* =========================================
       STOP RAIN SOUND
       ========================================= */

    function stopRainSound() {

        fadeRainSound(
            0,
            700
        );
    }


    /* =========================================
       CREATE RAIN DROPS
       ========================================= */

    function createRain() {

        rainOverlay.innerHTML = "";


        const screenWidth =
            window.innerWidth;

        const screenHeight =
            window.innerHeight;


        /*
         * Number of drops depends
         * on screen size.
         */

        const dropCount =
            Math.min(
                180,
                Math.max(
                    90,
                    Math.floor(
                        (
                            screenWidth *
                            screenHeight
                        ) / 9000
                    )
                )
            );


        for (
            let i = 0;
            i < dropCount;
            i++
        ) {

            const drop =
                document.createElement(
                    "span"
                );


            drop.classList.add(
                "rain-drop"
            );


            /* =================================
               DEPTH
               ================================= */

            const randomDepth =
                Math.random();


            if (
                randomDepth < 0.35
            ) {

                drop.classList.add(
                    "far"
                );

            } else if (
                randomDepth < 0.80
            ) {

                drop.classList.add(
                    "medium"
                );

            } else {

                drop.classList.add(
                    "near"
                );
            }


            /* =================================
               HORIZONTAL POSITION
               ================================= */

            drop.style.left =
                Math.random() *
                110 +
                "%";


            /* =================================
               DIFFERENT RAIN SPEEDS
               ================================= */

            const duration =
                0.55 +
                Math.random() *
                0.9;


            drop.style.animationDuration =
                duration +
                "s";


            /* =================================
               RANDOM STARTING POSITION
               ================================= */

            drop.style.animationDelay =
                -(
                    Math.random() *
                    duration
                ) +
                "s";


            /* =================================
               DIFFERENT DROP LENGTHS
               ================================= */

            const height =
                35 +
                Math.random() *
                65;


            drop.style.height =
                height +
                "px";


            rainOverlay.appendChild(
                drop
            );
        }
    }


    /* =========================================
       UPDATE RAIN UI
       ========================================= */

    function updateRainUI() {

        if (rainEnabled) {

            radioPage.classList.add(
                "rain-active"
            );


            rainButton.classList.add(
                "rain-enabled"
            );


            rainButton.title =
                "Rain: ON";


            /*
             * Start rain audio.
             */

            startRainSound();

        } else {

            radioPage.classList.remove(
                "rain-active"
            );


            rainButton.classList.remove(
                "rain-enabled"
            );


            rainButton.title =
                "Rain: OFF";


            /*
             * Fade out rain audio.
             */

            stopRainSound();
        }
    }


    /* =========================================
       TOGGLE RAIN
       ========================================= */

    rainButton.addEventListener(
        "click",
        function () {

            rainEnabled =
                !rainEnabled;


            localStorage.setItem(
                "rainEnabled",
                rainEnabled
            );


            updateRainUI();
        }
    );


    /* =========================================
       USER INTERACTION FALLBACK
       ========================================= */

    /*
     * If rain was already ON after a page
     * refresh, the browser may block audio
     * autoplay.
     *
     * Once the user interacts with the page,
     * try starting the rain sound again.
     */

    function resumeRainAudio() {

        if (!rainEnabled) {
            return;
        }


        if (
            rainSound.paused
        ) {

            const playPromise =
                rainSound.play();


            if (
                playPromise &&
                typeof playPromise.catch ===
                    "function"
            ) {

                playPromise.catch(
                    function () {
                        /*
                         * Browser still
                         * blocking audio.
                         */
                    }
                );
            }


            fadeRainSound(
                rainAudioTargetVolume,
                1000
            );
        }
    }


    document.addEventListener(
        "click",
        resumeRainAudio,
        {
            once: true
        }
    );


    document.addEventListener(
        "keydown",
        resumeRainAudio,
        {
            once: true
        }
    );


    /* =========================================
       INITIALIZE
       ========================================= */

    createRain();

    updateRainUI();


    /* =========================================
       RECREATE ON RESIZE
       ========================================= */

    let resizeTimer = null;


    window.addEventListener(
        "resize",
        function () {

            clearTimeout(
                resizeTimer
            );


            resizeTimer =
                setTimeout(
                    createRain,
                    300
                );
        }
    );

});