/**
 * reverse_1999.js
 * Configuration for Reverse: 1999 (重返未来1999)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { linearPIncrease, p2dist, DualPityModel } = global.GG;

    // 6-star Pity Table (0-70)
    // 1-60: 0.015
    // 61-70: Increase by 0.025
    // 70: 1.0 (Hard Pity)
    const P = new Float64Array(71);
    for (let i = 1; i <= 60; i++) P[i] = 0.015;
    for (let i = 61; i < 70; i++) {
        P[i] = 0.015 + (i - 60) * 0.025;
    }
    P[70] = 1;

    const P_DIST = p2dist(P);

    // Models
    // 1. Activity (Single UP): 50/50, Guarantee.
    const R1999SingleUpModel = new DualPityModel(P_DIST, [0, 0.5, 1]);

    // 2. Dual UP (Specific): 70% UP (2 chars), 50% specific within UP.
    // Class Pity (70/30) -> Specific Bernoulli (50/50).
    // Note: The guaranteed box UI will reflect "Guaranteed Class".
    // If Guaranteed is set, Model treats as Class Guaranteed.
    const R1999DualUpModel = new window.GG.Models.DualPityBernoulliModel(P_DIST, [0, 0.7, 1], 0.5);

    global.GG.Models['reverse_1999'] = {
        name: '重返未来1999 (Reverse: 1999)',
        hasModes: true,
        modes: [
            {
                id: 'single_up',
                name: '活动征集 (单UP/Single UP)',
                description: '标准活动卡池，50%概率UP，歪后保底 (Standard 50/50)',
                model: R1999SingleUpModel
            },
            {
                id: 'dual_up',
                name: '轮换/双UP (特定6★/Specific)',
                description: '双UP卡池捞特定角色 (70% UP, 50% Specific)',
                model: R1999DualUpModel
            }
        ],
        character: {
            name: '角色 (Character)',
            model: R1999SingleUpModel, // Default
            baseProb: '1.5%',
            pity: '70'
        },
        weapon: {
            name: '无 (None)',
            model: null,
            baseProb: '-',
            pity: '-'
        }
    };

})(window);
