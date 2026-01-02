/**
 * arknights.js
 * Configuration for Arknights (明日方舟)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, PityBernoulliModel } = global.GG;

    // 6-star Pity Table
    // PITY_6STAR[1:51] = 0.02 (0.02 * 50)
    // PITY_6STAR[51:99] = 0.02 + k*0.02
    // 99 = 1.00
    // Note: Python code says `PITY_6STAR[1:51] = 0.02`. Index 50 is included.
    // Python code: `PITY_6STAR[51:99] = np.arange(1, 49) * 0.02 + 0.02`
    // Index 51 (k=1) -> 0.04.

    // JS Array size 100 (0-99).
    const P = new Float64Array(100);
    for (let i = 1; i <= 50; i++) P[i] = 0.02;
    for (let i = 51; i <= 99; i++) {
        P[i] = 0.02 + (i - 50) * 0.02;
    }
    // Safety clamp
    for (let i = 0; i < 100; i++) if (P[i] > 1) P[i] = 1;

    const P_DIST = p2dist(P);

    // Standard Pool: Single UP 6-star (50%)
    const AKStandardModel = new PityBernoulliModel(P_DIST, 0.5);

    // Limited Pool: Specific Limited 6-star (35%)
    // (Actually pool is 70% UP split between 2, so specific is 35%)
    const AKLimitedModel = new PityBernoulliModel(P_DIST, 0.35);

    global.GG.Models['arknights'] = {
        name: '明日方舟 (Arknights)',
        character: {
            name: '常驻标准寻访 (单UP 6★)',
            model: AKStandardModel,
            baseProb: '2%',
            pity: '99'
        },
        weapon: {
            name: '限定寻访 (特定 6★)',
            model: AKLimitedModel,
            baseProb: '2%',
            pity: '99'
        }
    };

})(window);
