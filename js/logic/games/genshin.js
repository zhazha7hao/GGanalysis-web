/**
 * genshin.js
 * Configuration for Genshin Impact
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel, CapturingRadianceModel } = global.GG;

    // Character Pool 5-star
    // PITY_5STAR[1:74] = 0.006, [74:90] inc, 90=1.
    const PITY_5STAR_P = linearPIncrease(0.006, 74, 0.06, 90);
    const PITY_5STAR_DIST = p2dist(PITY_5STAR_P);

    // Weapon Pool 5-star
    // PITY_W5STAR[1:63] = 0.007, [63:77] inc, 77=1.
    const PITY_W5STAR_P = linearPIncrease(0.007, 63, 0.07, 77);
    const PITY_W5STAR_DIST = p2dist(PITY_W5STAR_P);

    // Genshin 5.0 Capturing Radiance
    // CR_P = [0, 0, 0, 1] (Standard counters)
    // NOTE: If using strict mode, pass these params.
    const GenshinCharacterModel = new CapturingRadianceModel(PITY_5STAR_DIST, [0, 0, 0, 1]);

    // Weapon Pool (75/25) - Standard DualPity
    const GenshinWeaponModel = new DualPityModel(PITY_W5STAR_DIST, [0, 0.75, 1]);

    global.GG.Models['genshin'] = {
        name: '原神 (Genshin Impact)',
        character: {
            name: '角色活动祈愿 (5★)',
            model: GenshinCharacterModel,
            baseProb: '0.6% (+捕获明光)',
            pity: '90'
        },
        weapon: {
            name: '神铸赋形 (5★武器)',
            model: GenshinWeaponModel,
            baseProb: '0.7%',
            pity: '77'
        }
    };

})(window);
