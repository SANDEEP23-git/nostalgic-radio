/* =========================================
   NOSTALGIC RADIO
   BACKGROUND THEME SYSTEM
   ========================================= */

let activeBackgroundLayer = 1;


/* =========================================
   CHANGE BACKGROUND
   ========================================= */

function changeBackground(mode) {

    if (!mode) {
        return;
    }

    const layerOne =
        document.querySelector(
            ".background-layer-one"
        );

    const layerTwo =
        document.querySelector(
            ".background-layer-two"
        );

    if (!layerOne || !layerTwo) {
        return;
    }

    const backgroundPath =
        `/static/images/backgrounds/${mode.background}`;


    /*
     * Change background immediately.
     * Do not wait for Image.onload.
     */

    if (activeBackgroundLayer === 1) {

        layerTwo.style.backgroundImage =
            `url("${backgroundPath}")`;

        layerTwo.style.opacity = "1";

        layerOne.style.opacity = "0";

        activeBackgroundLayer = 2;

    } else {

        layerOne.style.backgroundImage =
            `url("${backgroundPath}")`;

        layerOne.style.opacity = "1";

        layerTwo.style.opacity = "0";

        activeBackgroundLayer = 1;

    }


    console.log(
        "Background changed:",
        mode.name
    );

}


function applyModeTheme(mode) {

    if (!mode) {
        return;
    }

    changeBackground(mode);
}
