/**
 * hsr.js
 * Configuration for Honkai: Star Rail
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel } = global.GG;

    // Character Pool (Matches Python `gacha_model.py`)
    // PITY_5STAR[1:74] = 0.006, [74:90] += 0.06, 90=1
    const PITY_5STAR_P = linearPIncrease(0.006, 74, 0.06, 90);
    const PITY_5STAR_DIST = p2dist(PITY_5STAR_P);

    // Weapon (Light Cone) Pool
    // PITY_W5STAR[1:66] = 0.008, [66:80] += 0.07, 80=1
    // Python code: `PITY_W5STAR[66:80] = np.arange(1, 15) * 0.07 + 0.008`
    const PITY_W5STAR_P = linearPIncrease(0.008, 66, 0.07, 80);
    const PITY_W5STAR_DIST = p2dist(PITY_W5STAR_P);

    // Rates
    // Python code: Char `[0, 0.5 + 0.5/8, 1]` = 0.5625 (Due to consolidated prob?)
    // Wait, HSR python code line 47: `DualPityModel(PITY_5STAR, [0, 0.5 + 0.5/8, 1])`
    // User requested "Strictly follow Python code".
    // 0.5 + 0.5/8 = 0.5625.
    // Why? Maybe HSR has mechanisms making it 56%?
    // Let's use 0.5625 to be strict.

    // Weapon: `[0, 0.75 + 0.25/8, 1]` = 0.78125.

    const HSRCharacterModel = new DualPityModel(PITY_5STAR_DIST, [0, 0.5625, 1]);
    const HSRWeaponModel = new DualPityModel(PITY_W5STAR_DIST, [0, 0.78125, 1]);

    global.GG.Models['hsr'] = {
        name: '星穹铁道 (Honkai: Star Rail)',
        character: {
            name: '角色活动跃迁 (5★)',
            model: HSRCharacterModel,
            baseProb: '0.6%',
            pity: '90'
        },
        weapon: {
            name: '流光定影 (5★光锥)',
            model: HSRWeaponModel,
            baseProb: '0.8%',
            pity: '80'
        }
    };

})(window);
