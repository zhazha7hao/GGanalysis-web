/**
 * wuthering_waves.js
 * Configuration for Wuthering Waves (鸣潮)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel, CommonGachaModel } = global.GG;

    // Pity Table Construction based on gacha_model.py
    // PITY_5STAR[1:66] = 0.008 (indices 1 to 65)
    // PITY_5STAR[66:71] = 0.008 + k*0.04
    // PITY_5STAR[71:76] = P65 + 5*0.04 + k*0.08 = 0.208 + k*0.08 ... wait, need check formula carefully.
    
    // Python Code:
    // PITY_5STAR[1:66] = 0.008
    // PITY_5STAR[66:71] = np.arange(1, 5+1) * 0.04 + PITY_5STAR[65] (P[65]=0.008) -> 0.048, 0.088, 0.128, 0.168, 0.208 (at 70)
    // PITY_5STAR[71:76] = np.arange(1, 5+1) * 0.08 + PITY_5STAR[70] (0.208) -> 0.288, 0.368, 0.448, 0.528, 0.608 (at 75)
    // PITY_5STAR[76:80] = np.arange(1, 4+1) * 0.1 + PITY_5STAR[75] (0.608) -> 0.708, 0.808, 0.908, 1.008 (at 79)
    // PITY_5STAR[79] = 1 (Correction)

    const P = new Float64Array(80); // 0-79. 1-indexed means we simulate size 80, index 0 unused.
    
    for (let i = 1; i <= 65; i++) P[i] = 0.008;
    for (let k = 1; k <= 5; k++) P[65 + k] = 0.008 + k * 0.04; // 66-70
    const p70 = P[70];
    for (let k = 1; k <= 5; k++) P[70 + k] = p70 + k * 0.08; // 71-75
    const p75 = P[75];
    for (let k = 1; k <= 4; k++) P[75 + k] = p75 + k * 0.1; // 76-79
    P[79] = 1;

    const P_DIST = p2dist(P);

    // Character: 50/50 DualPity
    const WWCharacterModel = new DualPityModel(P_DIST, [0, 0.5, 1]);

    // Weapon: 100% PityModel
    // We can simulate PityModel using DualPity with upRate=1? Or just raw Pity?
    // CommonGachaModel logic: call(num, pity) -> PityLayer.
    // DualPityModel inherits it.
    // If we want pure guarantee, DualPity with upRate=1 (and upPity ignored/static) essentially works if logic holds.
    // Let's verify DualPityModel logic for rate=1.
    // "Lose then Win" part = base * 0 = 0.
    // "Win directly" = base * 1.
    // So yes, DualPityModel(dist, [0, 1, 1]) works as PityModel.
    const WWWeaponModel = new DualPityModel(P_DIST, [0, 1, 1]); // Rate 100%

    // Logic verification for weapon model:
    // "upPity" argument in call() usually 0. If rate is 1, it enters "Win directly" path.
    // If upPity=1 (user mistake?), "Guaranteed" path is same as "Win directly".
    // So safe.

    global.GG.Models['wuthering_waves'] = {
        name: '鸣潮 (Wuthering Waves)',
        character: {
            name: '角色活动唤取 (5★)',
            model: WWCharacterModel,
            baseProb: '0.8%',
            pity: '80'
        },
        weapon: {
            name: '武器活动唤取 (5★)',
            model: WWWeaponModel,
            baseProb: '0.8% (100% UP)',
            pity: '80'
        }
    };

})(window);
