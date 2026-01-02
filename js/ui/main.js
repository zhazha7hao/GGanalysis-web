/**
 * main.js
 * UI Logic
 * Global Namespace: GG
 */

(function () {
    // Safety check for Global Namespace
    if (!window.GG) {
        alert("Critical Error: Core logic scripts (GG) failed to load.");
        return;
    }

    const { ChartWrapper } = window.GG;

    // Safely get chart wrapper
    let chartWrapper = null;
    try {
        if (ChartWrapper) {
            const canvas = document.getElementById('prob-chart');
            if (canvas) {
                chartWrapper = new ChartWrapper(canvas);
            }
        } else {
            console.warn("ChartWrapper not found in GG namespace.");
        }
    } catch (e) {
        console.error("Failed to initialize ChartWrapper:", e);
    }

    const elements = {
        form: document.getElementById('calc-form'),
        gameNav: document.querySelectorAll('.nav-btn'),

        // Inputs
        inputs: document.querySelectorAll('#calc-form input, #calc-form select'),

        // Labels
        charLabel: document.getElementById('char-label'),
        weaponLabel: document.getElementById('weapon-label'),

        resExp: document.getElementById('res-exp'),
        resVar: document.getElementById('res-var'),
    };

    let currentGame = 'genshin';
    let debounceTimer = null;

    // Remove any submit buttons if present prevents confusion
    const btns = document.querySelectorAll('#calc-form button');
    btns.forEach(b => b.style.display = 'none');

    // Slider Sync Helper
    function bindSlider(sliderId, numberId) {
        const slider = document.getElementById(sliderId);
        const number = document.getElementById(numberId);
        if (!slider || !number) return;

        slider.addEventListener('input', () => {
            number.value = slider.value;
        });
        number.addEventListener('input', () => {
            slider.value = number.value;
        });
    }

    bindSlider('char-item-slider', 'char-item-num');
    bindSlider('weapon-item-slider', 'weapon-item-num');

    // Input Listeners regarding auto-calc
    elements.inputs.forEach(input => {
        // Use 'input' for text/number/range, 'change' for select/radio
        input.addEventListener('input', triggerCalc);
        input.addEventListener('change', triggerCalc);
    });

    function triggerCalc() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            calculate();
        }, 300);
    }

    // Game Switch
    elements.gameNav.forEach(btn => {
        // Force type="button" behavior
        btn.type = 'button';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const game = btn.dataset.game;

            if (!window.GG.Models || !window.GG.Models[game]) {
                console.error(`Game logic for '${game}' not loaded.`);
                alert(`Game logic for '${game}' is missing!`);
                return;
            }

            elements.gameNav.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGame = game;

            updateLabels(game);
            calculate();
        });
    });

    function updateLabels(game) {
        if (!window.GG.Models) return;
        const config = window.GG.Models[game];
        if (!config) return;

        if (elements.charLabel) elements.charLabel.textContent = config.character.name;
        if (elements.weaponLabel) elements.weaponLabel.textContent = config.weapon.name;
    }

    function calculate() {
        if (!window.GG || !window.GG.Models) return;

        const config = window.GG.Models[currentGame];
        if (!config) return;

        const charModel = config.character.model;
        const weaponModel = config.weapon.model;

        // Robust Element getting
        const getVal = (idOrName) => {
            // Try ID first
            const el = document.getElementById(idOrName);
            if (el) return parseInt(el.value, 10);

            // Try Radio Name
            const radios = document.getElementsByName(idOrName);
            if (radios.length > 0) {
                for (let r of radios) {
                    if (r.checked) return parseInt(r.value, 10);
                }
                return 0; // Default
            }
            return 0;
        };

        const cNum = getVal('char-item-num');
        const cPity = getVal('char-pity') || 0;
        const cGuaranteed = getVal('char-guaranteed'); // Now by name

        const wNum = getVal('weapon-item-num');
        const wPity = getVal('weapon-pity') || 0;
        const wGuaranteed = getVal('weapon-guaranteed'); // Now by name

        // Logic to prevent 0,0 calc
        if ((isNaN(cNum) || cNum === 0) && (isNaN(wNum) || wNum === 0)) {
            // Render 0 probability
            updateUI(new window.GG.FiniteDist([1]));
            return;
        }

        try {
            let charDist = (cNum > 0) ? charModel.call(cNum, cPity, cGuaranteed) : new window.GG.FiniteDist([1]);
            let weaponDist = (wNum > 0) ? weaponModel.call(wNum, wPity, wGuaranteed) : new window.GG.FiniteDist([1]);

            const finalDist = charDist.mul(weaponDist);
            updateUI(finalDist);
        } catch (e) {
            console.error("Calculation Error", e);
            elements.resExp.textContent = "Error";
            elements.resVar.textContent = "Error";
        }
    }

    function updateUI(dist) {
        if (elements.resExp) elements.resExp.textContent = dist.exp.toFixed(2);
        if (elements.resVar) elements.resVar.textContent = dist.var.toFixed(2);

        if (chartWrapper) {
            try {
                chartWrapper.render(dist);
            } catch (e) {
                console.warn("Chart render failed:", e);
            }
        }
    }

    // Initialization
    updateLabels('genshin');
    calculate();
})();
