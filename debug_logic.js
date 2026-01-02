/**
 * distribution.js
 * Implements FiniteDist class for handling discrete finite probability distributions.
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};

    class FiniteDist {
        constructor(dist = [1], trimTailZeros = true) {
            this.dist = this._processDist(dist, trimTailZeros);
            this._exp = null;
            this._var = null;
            this._pSum = null;
            this._cdf = null;
        }

        _processDist(dist, trimTailZeros) {
            let arr;
            if (dist instanceof FiniteDist) {
                arr = new Float64Array(dist.dist);
            } else if (Array.isArray(dist)) {
                arr = new Float64Array(dist);
            } else if (dist instanceof Float64Array) {
                arr = new Float64Array(dist);
            } else {
                arr = new Float64Array([1]);
            }

            if (trimTailZeros && arr.length > 0) {
                let end = arr.length;
                while (end > 0 && arr[end - 1] === 0) {
                    end--;
                }
                if (end < arr.length) {
                    return arr.slice(0, end);
                }
            }
            return arr;
        }

        get length() {
            return this.dist.length;
        }

        get exp() {
            if (this._exp === null) this.calcDistAttribution();
            return this._exp;
        }

        get var() {
            if (this._var === null) this.calcDistAttribution();
            return this._var;
        }

        get pSum() {
            if (this._pSum === null) this.calcDistAttribution();
            return this._pSum;
        }

        get cdf() {
            if (this._cdf === null) this.calcCDF();
            return this._cdf;
        }

        calcDistAttribution(pError = 1e-6) {
            let sum = 0;
            let exp = 0;
            let secMoment = 0;

            for (let i = 0; i < this.dist.length; i++) {
                const p = this.dist[i];
                sum += p;
                exp += i * p;
                secMoment += i * i * p;
            }

            this._pSum = sum;
            if (Math.abs(sum - 1) > pError) {
                this._exp = NaN;
                this._var = NaN;
            } else {
                this._exp = exp;
                this._var = secMoment - exp * exp;
            }
        }

        calcCDF() {
            const cdf = new Float64Array(this.dist.length);
            let sum = 0;
            for (let i = 0; i < this.dist.length; i++) {
                sum += this.dist[i];
                cdf[i] = sum;
            }
            this._cdf = cdf;
        }

        convolve(other) {
            const a = this.dist;
            const b = other.dist;
            const lenA = a.length;
            const lenB = b.length;
            const newLen = lenA + lenB - 1;
            const newDist = new Float64Array(newLen);

            for (let i = 0; i < lenA; i++) {
                const valA = a[i];
                if (valA === 0) continue;
                for (let j = 0; j < lenB; j++) {
                    newDist[i + j] += valA * b[j];
                }
            }
            return new FiniteDist(newDist);
        }

        mul(other) {
            if (other instanceof FiniteDist) {
                return this.convolve(other);
            } else if (typeof other === 'number') {
                const newDist = new Float64Array(this.dist.length);
                for (let i = 0; i < this.dist.length; i++) {
                    newDist[i] = this.dist[i] * other;
                }
                return new FiniteDist(newDist, false);
            }
            throw new Error("Invalid type for multiplication");
        }

        add(other) {
            const len = Math.max(this.length, other.length);
            const newDist = new Float64Array(len);
            for (let i = 0; i < this.length; i++) newDist[i] += this.dist[i];
            for (let i = 0; i < other.length; i++) newDist[i] += other.dist[i];
            return new FiniteDist(newDist);
        }

        pow(n) {
            if (!Number.isInteger(n) || n < 0) throw new Error("Power must be a non-negative integer");
            if (n === 0) return new FiniteDist([1]);
            if (n === 1) return new FiniteDist(this.dist);

            let result = new FiniteDist([1]);
            let base = this;
            let exp = n;

            while (exp > 0) {
                if (exp % 2 === 1) result = result.convolve(base);
                base = base.convolve(base);
                exp = Math.floor(exp / 2);
            }
            return result;
        }
    }

    function linearPIncrease(baseP, pityBegin, step, hardPity) {
        const ans = new Float64Array(hardPity + 1);
        for (let i = 1; i < pityBegin; i++) {
            ans[i] = baseP;
        }
        for (let i = pityBegin; i <= hardPity; i++) {
            ans[i] = Math.min(1, baseP + (i - pityBegin + 1) * step);
        }
        return ans;
    }

    function p2dist(pityP) {
        let temp = 1;
        const dist = new Float64Array(pityP.length);
        dist[0] = 0;

        for (let i = 1; i < pityP.length; i++) {
            dist[i] = temp * pityP[i];
            temp *= (1 - pityP[i]);
        }
        return new FiniteDist(dist);
    }

    global.GG.FiniteDist = FiniteDist;
    global.GG.linearPIncrease = linearPIncrease;
    global.GG.p2dist = p2dist;

})(window);
/**
 * layer.js
 * Implements Gacha conversion layers.
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const FiniteDist = global.GG.FiniteDist; // Depend on distribution.js being loaded first

    class GachaLayer {
        constructor() { }
        call(input) { throw new Error("Not implemented"); }
    }

    class PityLayer extends GachaLayer {
        constructor(pityP) {
            super();
            // Handle FiniteDist or TypedArray if helper were available inside
            // Assume pre-processed FiniteDist for now
            this.pityDist = pityP;
        }

        getDist(itemPity = 0) {
            if (itemPity === 0) return this.pityDist;

            const newDistArr = this.pityDist.dist.slice(itemPity);
            if (newDistArr.length > 0) newDistArr[0] = 0;

            // Normalize
            let sum = 0;
            for (let x of newDistArr) sum += x;
            if (sum === 0) return new FiniteDist([1]); // Error case?

            for (let i = 0; i < newDistArr.length; i++) newDistArr[i] /= sum;

            return new FiniteDist(newDistArr);
        }
    }

    global.GG.GachaLayer = GachaLayer;
    global.GG.PityLayer = PityLayer;

})(window);
/**
 * model.js
 * Implements Gacha Models.
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};
    const FiniteDist = global.GG.FiniteDist;
    const PityLayer = global.GG.PityLayer;

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
                const p = burnDistArr[k];
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
                    // "鏈閫氳繃澶т繚搴曡幏寰楅亾鍏?
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
                    // "鏈灏忎繚搴曡幏寰楅亾鍏?
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
                    // "鏈瑙﹀彂鎹曡幏鏄庡厜鑾峰緱閬撳叿"
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
        name: '鍘熺 (Genshin Impact)',
        character: {
            name: '瑙掕壊娲诲姩绁堟効 (5鈽?',
            model: GenshinCharacterModel,
            baseProb: '0.6% (+鎹曡幏鏄庡厜)',
            pity: '90'
        },
        weapon: {
            name: '绁為摳璧嬪舰 (5鈽呮鍣?',
            model: GenshinWeaponModel,
            baseProb: '0.7%',
            pity: '77'
        }
    };

})(window);
