/**
 * arknights_endfield.js
 * Configuration for Arknights: Endfield (明日方舟：终末地)
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const { p2dist, PityBernoulliModel, FiniteDist } = global.GG;

    // ==========================================
    // 1. Pity Tables
    // ==========================================

    // Character 6-star Pity (81)
    // 1-65: 0.008
    // 66-81: +0.05
    // 80: 1 (Index 80 corresponds to 80th pull if 1-based, but we usually use 0-index for "0 pulls" then 1..80)
    // Code: PITY_6STAR = np.zeros(81). P[80]=1. Matches my index logic.
    const PITY_CHAR = new Float64Array(81);
    for (let i = 1; i <= 65; i++) PITY_CHAR[i] = 0.008;
    for (let i = 66; i < 80; i++) {
        PITY_CHAR[i] = 0.008 + (i - 65) * 0.05;
    }
    PITY_CHAR[80] = 1;

    // Weapon 6-star Pity (41)
    // 1-39: 0.04 (Based on python code PITY_W6STAR[1:39+1] = 0.04)
    // 40: 1
    const PITY_WEAPON = new Float64Array(41);
    for (let i = 1; i <= 39; i++) PITY_WEAPON[i] = 0.04;
    PITY_WEAPON[40] = 1;

    // Dist objects
    const DIST_CHAR = p2dist(PITY_CHAR);
    const DIST_WEAPON = p2dist(PITY_WEAPON);

    // ==========================================
    // 2. Logic Helpers
    // ==========================================

    /**
     * Applies Spark / Interval Reward logic to CDFs.
     * Logic: At reward_pos (e.g., 240), you get +1 item.
     * So if you wanted k items, after 240 pulls you only need k-1 from gacha.
     * @param {Array<number[]>} rawCdfs - List of CDF arrays for k=0, 1, 2... target.
     * @param {Function} rewardRule - Returns pull count for j-th reward.
     * @returns {Array<number[]>} - Modified CDFs.
     */
    function applySpark(rawCdfs, rewardRule) {
        // rawCdfs[k] is CDF for k items.
        // We want to construct newCdfs[k].
        const newCdfs = [];
        // k=0 is always [1, 1...] (Already have 0 items)
        newCdfs.push(rawCdfs[0]);

        const targetNum = rawCdfs.length - 1;

        for (let k = 1; k <= targetNum; k++) {
            // Base CDF is rawCdfs[k] (Need all k from gacha)
            // But we switch to rawCdfs[k-1] at pos(1), rawCdfs[k-2] at pos(2)...

            // Start with a copy of rawCdfs[k] (Assuming no rewards)
            // We'll construct it piece by piece or just clone and patch.
            // Since JS arrays are strictly indexed, we can just iterate x.

            // To be efficient, we find the switching points.
            // Reward 1 at x1. Reward 2 at x2...
            // Range [0, x1): Use rawCdfs[k]
            // Range [x1, x2): Use rawCdfs[k-1] (1 reward obtained)
            // Range [x_m, ...): Use rawCdfs[max(0, k-m)]

            // Determine max length needed.
            // usually rawCdfs have sufficient length. 
            const maxLength = rawCdfs[k].length;
            const newCdf = new Float64Array(maxLength);

            // Define reward positions: [x1, x2, ...]
            const rewardPos = [];
            let j = 1;
            while (true) {
                const pos = rewardRule(j);
                if (pos >= maxLength && (k - j) < 0) break; // Optimization
                // Safety break if pos is not increasing or stuck (though rule implies linear)
                if (rewardPos.length > 0 && pos <= rewardPos[rewardPos.length - 1]) break;

                rewardPos.push(pos);
                j++;
                // Safety limit: if we are asking for more rewards than k (target) + reasonable buffer
                if (j > k + 10) break;
            }

            let currentRewardIdx = 0; // 0 rewards
            let nextRewardAt = rewardPos[0];

            for (let x = 0; x < maxLength; x++) {
                if (currentRewardIdx < rewardPos.length && x >= nextRewardAt) {
                    currentRewardIdx++;
                    nextRewardAt = rewardPos[currentRewardIdx];
                }

                const neededFromGacha = Math.max(0, k - currentRewardIdx);
                const sourceCdf = rawCdfs[neededFromGacha];

                // Safety check if sourceCdf is short (shouldn't happen with valid logic)
                if (x < sourceCdf.length) {
                    newCdf[x] = sourceCdf[x];
                } else {
                    newCdf[x] = 1;
                }
            }
            newCdfs.push(newCdf);
        }
        return newCdfs;
    }

    // ==========================================
    // 3. Models
    // ==========================================

    /**
     * Endfield Character Model
     * - Base: PityBernoulli(0.5)
     * - First Copy Hard Pity: 120 (Truncated)
     * - Subsequent: Standard
     * - Spark: Every 240
     */
    class EndfieldCharacterModel {
        constructor() {
            this.baseModel = new PityBernoulliModel(DIST_CHAR, 0.5);
            // 120 Hard Pity for FIRST item
            this.hardPityLimit = 120;
            // Spark every 240
            this.sparkRule = (j) => 240 * j;
        }

        call(itemNum = 1) {
            // Early return for 0 items
            if (itemNum <= 0) return new global.GG.FiniteDist([1]);

            // 1. Calculate Raw Distributions (Without Spark)

            // Dist for 1st item (Truncated at 120)
            let distFirst = this.baseModel.call(1);
            if (distFirst.dist.length > this.hardPityLimit + 1) {
                // Truncate logic
                let mass = 0;
                const newP = new Float64Array(this.hardPityLimit + 1);
                for (let i = 0; i <= this.hardPityLimit; i++) {
                    newP[i] = distFirst.dist[i];
                }
                // Sum remaining mass
                for (let i = this.hardPityLimit + 1; i < distFirst.dist.length; i++) {
                    mass += distFirst.dist[i];
                }
                // Add to hard pity limit
                newP[this.hardPityLimit] += mass;
                distFirst = new FiniteDist(newP);
            }

            // Dist for Subsequent items (Standard)
            const distSub = this.baseModel.call(1);

            // Convolve to get Dists for k=1..itemNum
            // We need all intermediate Dists to build CDFs for Spark.
            // rawDists[k] = Dist for k items.
            const rawDists = [new FiniteDist([1])]; // k=0

            let currentDist = new FiniteDist([1]);
            for (let k = 1; k <= itemNum; k++) {
                if (k === 1) {
                    currentDist = distFirst;
                } else {
                    currentDist = currentDist.convolve(distSub);
                }
                rawDists.push(currentDist);
            }

            // 2. Convert to CDFs
            const rawCdfs = rawDists.map(d => d.cdf);

            // 3. Apply Spark
            // Ensure CDFs are long enough (Spark is at 240*k or more)
            // If we want 1 item, max pull is 240 (guaranteed).
            // Current distFirst might end at 120. We need to pad CDF to 240+ to apply spark logic visible on chart?
            // Actually, if we apply spark, the CDF becomes 1 at 240. 
            // So we need to ensure the specific array is accessed up to 240.
            // applySpark handles accessing. If index > length, assumes 1.
            const sparkCdfs = applySpark(rawCdfs, this.sparkRule);

            // 4. Return Final Distribution (PDF) for itemNum
            const finalCdf = sparkCdfs[itemNum];
            // Convert back to PDF
            return global.GG.cdf2dist(finalCdf);
        }
    }

    /**
     * Endfield Weapon Model
     * - Base: PityBernoulli(0.25) [Based on python 0.25]
     * - Pity: 40 hard, 4% base.
     * - First Copy Hard Pity: 80.
     * - Spark: 160*j + 20? 
     *   "IntervalAutoReward_UPW6star = lambda j: 160 * j + 20"
     */
    class EndfieldWeaponModel {
        constructor() {
            this.baseModel = new PityBernoulliModel(DIST_WEAPON, 0.25);
            this.hardPityLimit = 80;
            this.sparkRule = (j) => 160 * j + 20;
        }

        call(itemNum = 1) {
            if (itemNum <= 0) return new global.GG.FiniteDist([1]);

            // Same logic as Character
            let distFirst = this.baseModel.call(1);
            if (distFirst.dist.length > this.hardPityLimit + 1) {
                let mass = 0;
                const newP = new Float64Array(this.hardPityLimit + 1);
                for (let i = 0; i <= this.hardPityLimit; i++) newP[i] = distFirst.dist[i];
                for (let i = this.hardPityLimit + 1; i < distFirst.dist.length; i++) mass += distFirst.dist[i];
                newP[this.hardPityLimit] += mass;
                distFirst = new FiniteDist(newP);
            }

            const distSub = this.baseModel.call(1);
            const rawDists = [new FiniteDist([1])];
            let currentDist = new FiniteDist([1]);
            for (let k = 1; k <= itemNum; k++) {
                if (k === 1) currentDist = distFirst;
                else currentDist = currentDist.convolve(distSub);
                rawDists.push(currentDist);
            }

            const rawCdfs = rawDists.map(d => d.cdf);
            const sparkCdfs = applySpark(rawCdfs, this.sparkRule);
            return global.GG.cdf2dist(sparkCdfs[itemNum]);
        }
    }

    // cdf2dist helper (if not in global yet, simple implementation)
    // Assuming GG.cdf2dist exists? 
    // Usually dist class has it or logic has it.
    // Let's rely on GG namespace or implement.
    if (!global.GG.cdf2dist) {
        global.GG.cdf2dist = function (cdf) {
            const p = new Float64Array(cdf.length);
            p[0] = cdf[0];
            for (let i = 1; i < cdf.length; i++) {
                p[i] = cdf[i] - cdf[i - 1];
            }
            return new FiniteDist(p);
        };
    }

    // Exports
    global.GG.Models['arknights_endfield'] = {
        name: '明日方舟：终末地 (Endfield)',
        character: {
            name: '干员 (Operator)',
            model: new EndfieldCharacterModel(),
            baseProb: '0.8%',
            pity: '80 (Hard 120)'
        },
        weapon: {
            name: '武器 (Weapon)',
            model: new EndfieldWeaponModel(),
            baseProb: '4.0%',
            pity: '40 (Hard 80)'
        }
    };

})(window);
