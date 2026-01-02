/**
 * reverse_1999.js
 * Configuration for Reverse: 1999 (重返未来1999)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel } = global.GG;

    // 6-star Pity Table
    // PITY_6STAR[1:61] = 0.015 (indices 1 to 60)
    // PITY_6STAR[61:71] = np.arange(1, 11) * 0.025 + 0.015
    // k=1 (61) -> 0.04. k=10 (70) -> 0.25+0.015 = 0.265? No.
    // Let's re-read python code: `np.arange(1, 11) * 0.025 + 0.015`
    // P[61] = 0.015 + 0.025 = 0.04.
    // P[70] = 0.015 + 10*0.025 = 0.265.
    // AND `PITY_6STAR[70] = 1`. Hard set.
    // So distinct jump at 70? Or logic implies hard pity.

    // JS Array size 71.
    const P = new Float64Array(71);
    for (let i = 1; i <= 60; i++) P[i] = 0.015;
    for (let i = 61; i < 70; i++) {
        P[i] = 0.015 + (i - 60) * 0.025;
    }
    P[70] = 1;

    const P_DIST = p2dist(P);

    // Character: 50/50 DualPity
    const R1999CharacterModel = new DualPityModel(P_DIST, [0, 0.5, 1]);

    // Weapon (Actually thoughts? Rev1999 doesn't have weapons in same way?)
    // User requested support.
    // Usually people calculating Characters.
    // If inputting for "Weapon" slot, maybe use it for "Standard Specific 6★"? 
    // Python code `specific_stander_6star` is PityBernoulli(1/11)?
    // Let's just create a duplicate Character model for "Standard 6★" or similar if requested.
    // For now, let's map "Weapon" to "Common 6★" (Standard Pool)?
    // Or just disable it / make it same as character for now?
    // Actually, let's look at `gacha_model.py`. `specific_up_5star`.
    // Let's provide standard UP logic for both slots for simple usage, assuming user puts "0" if unused.

    const R1999WeaponModel = new DualPityModel(P_DIST, [0, 0.5, 1]);

    global.GG.Models['reverse_1999'] = {
        name: '重返未来1999 (Reverse: 1999)',
        character: {
            name: '活动征集 (6★角色)',
            model: R1999CharacterModel,
            baseProb: '1.5%',
            pity: '70'
        },
        weapon: {
            name: '活动征集 (6★角色)', // Just duplicate for now unless specific
            model: R1999WeaponModel,
            baseProb: '1.5%',
            pity: '70'
        }
    };

})(window);
