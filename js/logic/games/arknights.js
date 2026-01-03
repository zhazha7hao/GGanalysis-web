/**
 * arknights.js
 * Configuration for Arknights (明日方舟)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { p2dist, AKDirectionalModel, AKHardPityModel, PityBernoulliModel, AKLimitedMultModel } = global.GG;

    // 6-star Pity Table
    // PITY_6STAR[1:51] = 0.02
    // PITY_6STAR[51:99] = 0.02 + k*0.02
    const P = new Float64Array(100);
    for (let i = 1; i <= 50; i++) P[i] = 0.02;
    for (let i = 51; i <= 99; i++) {
        P[i] = 0.02 + (i - 50) * 0.02;
    }
    for (let i = 0; i < 100; i++) if (P[i] > 1) P[i] = 1;

    const P_DIST = p2dist(P);

    // 1. Standard Headhunting (Single UP) - Directional
    // UpRate 0.5. Gap 150.
    const AKStandardModel = new AKDirectionalModel(P_DIST, 0.5);

    // 2. Rotation/Kernel (Dual UP) - Hard Type Pity
    // UpRate 0.5 (for Specific). Gap 200. ItemTypes 2. Shift 1.
    // Python: `dual_up_specific_6star = AKHardPityModel(..., gap=200, up_rate=0.5, type_pull_shift=1)`
    const AKRotationModel = new AKHardPityModel(P_DIST, 200, 2, 0.5, 1);

    // 3. Limited (Dual UP) - Specific
    // Rate 0.35. No Hard Type Pity usually.
    // Use PityBernoulliModel(0.35)
    const AKLimitedSpecificModel = new PityBernoulliModel(P_DIST, 0.35);

    // 4. Limited (Dual UP) - Collect Both
    // Rate Total 0.7.
    const AKLimitedBothModel = new AKLimitedMultModel(P_DIST, 0.7);


    global.GG.Models['arknights'] = {
        name: '明日方舟 (Arknights)',
        hasModes: true,
        modes: [
            {
                id: 'standard',
                name: '标准寻访-单UP',
                description: '定向选调 (150抽保底UP), 50% UP',
                model: AKStandardModel,
                baseProb: '2%',
                pity: '99'
            },
            {
                id: 'rotation',
                name: '轮换池-特定6星',
                description: '双UP, 类型硬保底 (200抽), 25% Specific',
                model: AKRotationModel,
                baseProb: '2%',
                pity: '99'
            },
            {
                id: 'limited_specific',
                name: '限定池-特定6星',
                description: '双UP, 35% Specific (300井不计入概率)',
                model: AKLimitedSpecificModel,
                baseProb: '2%',
                pity: '99'
            },
            {
                id: 'limited_both',
                name: '限定池-集齐双UP',
                description: '双UP, 集齐两名UP角色',
                model: AKLimitedBothModel,
                baseProb: '2%',
                pity: '99'
            }
        ],
        // Fallback for default UI if not updated
        character: {
            name: '默认标准寻访',
            model: AKStandardModel
        },
        weapon: {
            name: '默认限定寻访',
            model: AKLimitedSpecificModel
        }
    };

})(window);
