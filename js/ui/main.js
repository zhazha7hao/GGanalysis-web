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
        input.addEventListener('input', triggerCalc);
        input.addEventListener('change', triggerCalc);
    });

    const autoCalcCheck = document.getElementById('auto-calc');
    if (autoCalcCheck) {
        autoCalcCheck.addEventListener('change', () => {
            // If turned ON, trigger calc immediately
            if (autoCalcCheck.checked) calculate();
        });
    }

    const calcBtn = document.getElementById('calc-btn');
    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            // Manual button always triggers calc
            calculate();
        });
    }

    function triggerCalc() {
        // If Auto Calc is OFF, do nothing
        if (autoCalcCheck && !autoCalcCheck.checked) return;

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

        // Mode Selector Logic
        const modeSelectContainer = document.getElementById('mode-selection');
        const modeSelect = document.getElementById('game-mode');
        const weaponSection = document.getElementById('weapon-label').closest('.input-section');

        // Target Guaranteed Boxes
        const charGuaranteedBox = document.getElementById('char-guaranteed-box');

        // Reset display
        modeSelectContainer.style.display = 'none';
        modeSelect.innerHTML = '';
        weaponSection.style.display = 'block';
        if (charGuaranteedBox) charGuaranteedBox.style.display = 'block';

        if (config.hasModes) {
            modeSelectContainer.style.display = 'block';
            config.modes.forEach(mode => {
                const opt = document.createElement('option');
                opt.value = mode.id;
                opt.textContent = mode.name;
                opt.title = mode.description || '';
                modeSelect.appendChild(opt);
            });
            modeSelect.value = config.modes[0].id;

            if (game === 'arknights') {
                weaponSection.style.display = 'none';
                // Hide Guaranteed Box for Arknights (Uses Type Pity)
                if (charGuaranteedBox) charGuaranteedBox.style.display = 'none';
            }
        }

        if (elements.charLabel) elements.charLabel.textContent = config.character.name;
        if (elements.weaponLabel) {
            elements.weaponLabel.textContent = config.weapon.name;
            // Hide weapon section if name implies None
            if (config.weapon.name.includes('None') || config.weapon.name.includes('无')) {
                weaponSection.style.display = 'none';
            }
        }
    }

    // Mode change listener
    const modeSelect = document.getElementById('game-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            if (currentGame === 'arknights') updateArknightsVisibility();
            calculate();
        });
    }

    function calculate() {
        if (!window.GG || !window.GG.Models) return;

        const config = window.GG.Models[currentGame];
        if (!config) return;

        let charModel = config.character.model;
        let weaponModel = config.weapon.model; // Default

        // Handle Modes
        if (config.hasModes) {
            const modeId = document.getElementById('game-mode').value;
            const mode = config.modes.find(m => m.id === modeId);
            if (mode) {
                charModel = mode.model;
                if (currentGame === 'arknights') {
                    weaponModel = null;
                }
            }
        }

        // Robust Element getting
        const getVal = (idOrName) => {
            const el = document.getElementById(idOrName);
            if (el) return parseInt(el.value, 10);
            const radios = document.getElementsByName(idOrName);
            if (radios.length > 0) {
                for (let r of radios) if (r.checked) return parseInt(r.value, 10);
                return 0;
            }
            return 0;
        };

        const cNum = getVal('char-item-num');
        const cPity = getVal('char-pity') || 0;
        const cGuaranteed = getVal('char-guaranteed');

        // Arknights specific
        const akTypePity = getVal('ak-type-pity') || 0;

        let wNum = getVal('weapon-item-num');
        const wPity = getVal('weapon-pity') || 0;
        const wGuaranteed = getVal('weapon-guaranteed');

        if (weaponModel === null) wNum = 0;

        if ((isNaN(cNum) || cNum === 0) && (isNaN(wNum) || wNum === 0)) {
            updateUI(new window.GG.FiniteDist([1]));
            return;
        }

        try {
            let charDist;
            if (cNum > 0) {
                if (currentGame === 'arknights') {
                    // Pass akTypePity
                    charDist = charModel.call(cNum, cPity, akTypePity);
                } else {
                    charDist = charModel.call(cNum, cPity, cGuaranteed);
                }
            } else {
                charDist = new window.GG.FiniteDist([1]);
            }

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
