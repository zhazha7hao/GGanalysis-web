/**
 * model.js
 * Implements Gacha Models.
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const FiniteDist = global.GG.FiniteDist;
    const PityLayer = global.GG.PityLayer;
    global.GG.Models = global.GG.Models || {};

    class CommonGachaModel {
        constructor() {
            this.layers = [];
        }

        call(itemNum = 1, itemPity = 0, multiDist = false) {
            if (this.layers.length === 0) return new FiniteDist([1]);
            const pityLayer = this.layers[0];
            const firstDist = pityLayer.getDist(itemPity);
            if (itemNum === 1) return firstDist;
            const freshDist = pityLayer.getDist(0);
            const restDist = freshDist.pow(itemNum - 1);
            const totalDist = firstDist.convolve(restDist);
            return totalDist;
        }
    }

    class DualPityModel extends CommonGachaModel {
        constructor(pityDist, upRates = [0, 0.5, 1]) {
            super();
            this.pityLayer = new PityLayer(pityDist);
            this.layers.push(this.pityLayer);
            this.upRate = upRates[1];
        }

        call(itemNum = 1, itemPity = 0, upPity = 0) {
            const baseDistValid = this.pityLayer.getDist(itemPity);
            const baseDistFresh = this.pityLayer.getDist(0);

            // Logic for 1st item
            let distOneUp;
            if (upPity === 1) {
                // Guaranteed
                distOneUp = baseDistValid;
            } else {
                // 50/50
                // Win directly: baseDistValid * upRate
                const part1 = baseDistValid.mul(this.upRate);
                // Lose then Win: baseDistValid * (1-upRate) * baseDistFresh
                // (Lose takes 1 gold, then next is guaranteed taking another gold)
                const part2 = baseDistValid.convolve(baseDistFresh).mul(1 - this.upRate);
                distOneUp = part1.add(part2);
            }

            if (itemNum === 1) return distOneUp;

            // Logic for subsequent items (Always from fresh 50/50 state)
            // Fresh Win: baseDistFresh * upRate
            // Fresh Lose-Win: baseDistFresh * baseDistFresh * (1-upRate)
            const freshOneUp = baseDistFresh.mul(this.upRate).add(
                baseDistFresh.convolve(baseDistFresh).mul(1 - this.upRate)
            );

            const remainingDist = freshOneUp.pow(itemNum - 1);
            return distOneUp.convolve(remainingDist);
        }
    }

    /**
     * Capturing Radiance Model (Genshin 5.0+)
     * Ported from GGanalysis/games/genshin_impact/gacha_model.py
     */
    class CapturingRadianceModel extends CommonGachaModel {
        constructor(pityP, crP = [0, 0, 0, 1]) {
            super();
            this.pityLayer = new PityLayer(pityP);
            this.crP = crP;
        }

        call(itemNum = 1, itemPity = 0, upPity = 0, crCounter = 1) {
            // If guaranteed (upPity=1), CR doesn't apply for the FIRST item.
            // It behaves like DualPityModel guaranteed: consume 1 gold to get UP.
            // Then reset to 50/50 mechanics (CR eligible).

            if (upPity === 1) {
                const distFirst = this.pityLayer.getDist(itemPity);
                if (itemNum === 1) return distFirst;

                // For remaining items, we are back to 0 pity, 0 upPity (50/50), CR=1 (Reset)
                // Need dist for (itemNum - 1) items using CR logic.
                const distRest = this._getCRDist(itemNum - 1, 0, 0, 1);
                return distFirst.convolve(distRest);
            }

            // Normal CR case
            return this._getCRDist(itemNum, itemPity, upPity, crCounter);
        }

        _getCRDist(itemNum, itemPity, upPity, crCounter) {
            // 1. Calculate distribution of "How many 5-stars needed" (Burn Distribution)
            // using DP.
            const burnDistArr = this._capturingRadianceDP(itemNum, upPity, crCounter);

            // 2. Convolve PityLayer based on Burn Count
            // burnDist[k] is probability we need k 5-stars.
            // If k=1: Need passed itemPity. (Dist A)
            // If k=2: Need passed itemPity + 1 fresh 5-star. (Dist A * Dist B)
            // ...

            const distA = this.pityLayer.getDist(itemPity);
            const distB = this.pityLayer.getDist(0); // Fresh 5-star

            let totalDist = new FiniteDist([0]);
            let currentConv = distA; // A * B^0

            // burnDistArr[0] should be 0 (need at least 1 5-star usually)
            // Python code trim zeros, so index 0 is 0 5-stars? 
            // _capturingRadianceDP returns "Consumed 5-star count" distribution.
            // If we have 1 UP item goal, min 5-stars is 1.

            // Optimization: We can compute B^n iteratively. A * B^n = (A * B^(n-1)) * B.

            for (let k = 1; k < burnDistArr.length; k++) {
                const p = burnDistArr.dist[k];
                if (p > 1e-15) { // Floating point safety
                    totalDist = totalDist.add(currentConv.mul(p));
                }
                // Prepare for next k (k+1 means one more fresh 5-star)
                currentConv = currentConv.convolve(distB);
            }

            return totalDist;
        }

        _capturingRadianceDP(itemNum, upPity, crCount) {
            // Port of capturing_radiance_dp form Python
            // M[used_5star][got_up_5star][cr_state]
            // cr_state: 0 (failed, guaranteed next), 1, 2, 3 (CR counters)

            const max5star = Math.ceil(itemNum * 1.8) + 10; // Heuristic upper bound
            const crP = this.crP; // [0, 0, 0, 1]

            // State: [used_5stars, got_ups, cr_counter]
            // Dimensions:
            // used: 0..max5star
            // got: 0..itemNum
            // counter: 0..3 (0 is Guaranteed state, 1-3 are 50/50 states with specific Capture rates)

            // Matrix dimensions: M[max5star+1][itemNum+1][4]

            const M = new Float64Array((max5star + 1) * (itemNum + 1) * 4);
            const OFFSET_K = 1; // k is the innermost dimension
            const OFFSET_J = 4; // 4 states for k
            const OFFSET_I = (itemNum + 1) * 4; // (itemNum + 1) for j, times 4 for k

            function getM(i, j, k) {
                if (i < 0 || j < 0 || k < 0 || k >= 4) return 0;
                return M[i * OFFSET_I + j * OFFSET_J + k * OFFSET_K];
            }
            function addM(i, j, k, val) {
                if (i < 0 || j < 0 || k < 0 || k >= 4) return;
                M[i * OFFSET_I + j * OFFSET_J + k * OFFSET_K] += val;
            }

            // Init
            addM(upPity, upPity, crCount, 1);

            for (let i = 1; i <= max5star; i++) {
                for (let j = 1; j <= itemNum; j++) {

                    // 1. Guaranteed path (Lose -> Next Guaranteed)
                    // "本次通过大保底获得道具"
                    // Cost 2 5-stars. Prev state k-1.
                    // Prob of losing: 0.5 - crP[k-1]/2. 
                    // New state k.
                    if (i >= 2) {
                        for (let k = 1; k < 4; k++) { // k in range(1,4) in Python
                            const prev = getM(i - 2, j - 1, k - 1);
                            if (prev > 0) {
                                const probLose = 0.5 - crP[k - 1] / 2;
                                addM(i, j, k, prev * probLose);
                            }
                        }
                    }

                    // 2. Small Pity Win (Natural Win, not capture)
                    // "本次小保底获得道具"
                    // Cost 1 5-star.
                    // Python: `M[i,j,k] += M[i-1,j-1,k+1] * (0.5 - cr_p[k+1]/2)`
                    // Loop k in 0..1. Sources are k+1 (1..2).
                    // This is the probability of NOT capturing and NOT losing 50/50.
                    // It's `0.5 * (1 - cr_p[k+1])` if `cr_p` is `P(Capture | Lose)`.
                    // But the Python code uses `0.5 - cr_p[k+1]/2`.
                    // This implies `0.5 - cr_p[k+1]/2` is the probability of winning 50/50 AND resetting to state `k`.
                    // Let's follow the Python code's exact math.

                    for (let k = 0; k < 2; k++) { // k in range(0,2) in Python
                        const prev = getM(i - 1, j - 1, k + 1);
                        if (prev > 0) {
                            const val = 0.5 - crP[k + 1] / 2;
                            addM(i, j, k, prev * val);
                        }
                    }

                    // Special case for k=0 (guaranteed state)
                    // Python: `M[i,j,0] += M[i-1,j-1,0] * (0.5 - cr_p[0]/2)`
                    {
                        const prev = getM(i - 1, j - 1, 0);
                        if (prev > 0) {
                            const val = 0.5 - crP[0] / 2;
                            addM(i, j, 0, prev * val);
                        }
                    }

                    // 3. Capture Win
                    // "本次触发捕获明光获得道具"
                    // Cost 1 5-star.
                    // Python: `for k in range(0,4): M[i,j,1] += M[i-1,j-1,k] * cr_p[k]`
                    // If Capture triggers, we go to state 1 (reset counter).
                    // `crP[k]` is the probability of capture given current state `k`.

                    for (let k = 0; k < 4; k++) { // k in range(0,4) in Python
                        const prev = getM(i - 1, j - 1, k);
                        if (prev > 0) {
                            const val = crP[k];
                            if (val > 0) {
                                addM(i, j, 1, prev * val); // Dest is state 1 (Reset)
                            }
                        }
                    }
                }
            }

            // Result: Sum M[:, itemNum, :]
            // Python: np.sum(M[:, item_num, :], axis=1) -> Sum across K.
            // Result is array of size max5star+1.

            const result = new Float64Array(max5star + 1);
            for (let i = 0; i <= max5star; i++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += getM(i, itemNum, k);
                }
                result[i] = sum;
            }

            // Trim zeros
            return new FiniteDist(result);
        }
    }

    global.GG.CommonGachaModel = CommonGachaModel;
    global.GG.DualPityModel = DualPityModel;
    global.GG.CapturingRadianceModel = CapturingRadianceModel;

})(window);
