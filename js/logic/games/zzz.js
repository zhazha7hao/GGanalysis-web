/**
 * zzz.js
 * Configuration for Zenless Zone Zero
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel } = global.GG;

    // Character Pool
    // Python `PITY_5STAR[1:74] = 0.006...` Same as Genshin.
    const PITY_5STAR_P = linearPIncrease(0.006, 74, 0.06, 90);
    const PITY_5STAR_DIST = p2dist(PITY_5STAR_P);

    // Weapon (W-Engine) Pool
    // Python `PITY_W5STAR[1:65] = 0.01` (Base 1%)
    // `PITY_W5STAR[65:80] = np.arange(1, 16) * 0.06 + 0.01` (Soft pity 65)
    const PITY_W5STAR_P = linearPIncrease(0.01, 65, 0.06, 80);
    const PITY_W5STAR_DIST = p2dist(PITY_W5STAR_P);

    const ZZZCharacterModel = new DualPityModel(PITY_5STAR_DIST, [0, 0.5, 1]);
    const ZZZWeaponModel = new DualPityModel(PITY_W5STAR_DIST, [0, 0.75, 1]);

    global.GG.Models['zzz'] = {
        name: '绝区零 (Zenless Zone Zero)',
        character: {
            name: '独家频段 (5★代理人)',
            model: ZZZCharacterModel,
            baseProb: '0.6%',
            pity: '90'
        },
        weapon: {
            name: '音擎频段 (5★音擎)',
            model: ZZZWeaponModel,
            baseProb: '1.0%',
            pity: '80'
        }
    };

})(window);
