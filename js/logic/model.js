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

    class PityBernoulliModel extends CommonGachaModel {
        constructor(pityDist, upRate = 0.5) {
            super();
            this.pityLayer = new PityLayer(pityDist);
            this.layers.push(this.pityLayer);
            this.upRate = upRate;
        }

        call(itemNum = 1, itemPity = 0) {
            const distFirst = this.pityLayer.getDist(itemPity);
            const distFresh = this.pityLayer.getDist(0);

            let totalDist = new FiniteDist([0]);
            let currentConv = distFirst;

            let pLose = 1 - this.upRate;
            let currentP = this.upRate;

            for (let k = 1; k < 50; k++) {
                totalDist = totalDist.add(currentConv.mul(currentP));
                currentConv = currentConv.convolve(distFresh);
                currentP *= pLose;
                if (currentP < 1e-15) break;
            }

            if (itemNum === 1) return totalDist;

            let freshSpecificDist = new FiniteDist([0]);
            let freshConv = distFresh;
            currentP = this.upRate;
            for (let k = 1; k < 50; k++) {
                freshSpecificDist = freshSpecificDist.add(freshConv.mul(currentP));
                freshConv = freshConv.convolve(distFresh);
                currentP *= pLose;
                if (currentP < 1e-15) break;
            }

            const restDist = freshSpecificDist.pow(itemNum - 1);
            return totalDist.convolve(restDist);
        }
    }

    /* Arknights Specific Models */
    function startHardTypePityDP(itemPullDist, typePityGap, itemTypes, upRate, typePullShift) {
        const distLen = itemPullDist.dist.length;
        const calcPulls = distLen - 1 + typePityGap * itemTypes + typePullShift + 50;
        const M0 = new Float64Array(calcPulls + 1);
        const M1 = new Float64Array(calcPulls + 1);

        M0[0] = 1;

        const itemProbs = [];
        for (let i = 1; i < distLen; i++) {
            if (itemPullDist.dist[i] > 1e-9) itemProbs.push([i, itemPullDist.dist[i]]);
        }

        for (let i = 1; i <= calcPulls; i++) {
            for (let [gap, prob] of itemProbs) {
                const j = i - gap;
                if (j < 0) continue;
                if (M0[j] === 0) continue;

                const idxI = Math.max(i - 1 + typePullShift, 0);
                const idxJ = Math.max(j - 1 + typePullShift, 0);

                let pType = 0;
                if (Math.floor(idxI / typePityGap) !== Math.floor(idxJ / typePityGap)) {
                    pType = Math.floor(idxI / typePityGap) / itemTypes;
                } else {
                    pType = upRate / itemTypes;
                }

                if (pType > 1) pType = 1;
                M1[i] += M0[j] * prob * pType;
                M0[i] += M0[j] * prob * (1 - pType);
            }
        }
        return new FiniteDist(M1);
    }

    class AKHardPityModel extends CommonGachaModel {
        constructor(noTypePityDist, typePityGap, itemTypes = 2, upRate = 1, typePullShift = 0) {
            super();
            this.noTypePityDist = noTypePityDist;
            this.typePityGap = typePityGap;
            this.itemTypes = itemTypes;
            this.upRate = upRate;
            this.typePullShift = typePullShift;
            // Cache zero-pity state
            this.zeroDist = startHardTypePityDP(
                this.noTypePityDist,
                this.typePityGap,
                this.itemTypes,
                this.upRate,
                this.typePullShift
            );
            this.specificDist = this.zeroDist; // Default for compatibility
        }
        call(itemNum = 1, itemPity = 0, typePity = 0) {
            if (itemNum <= 0) return new FiniteDist([1]);
            let firstDist;
            if (typePity === 0 && this.typePullShift === 0) {
                firstDist = this.zeroDist;
            } else {
                firstDist = startHardTypePityDP(
                    this.noTypePityDist,
                    this.typePityGap,
                    this.itemTypes,
                    this.upRate,
                    this.typePullShift + typePity
                );
            }
            if (itemNum === 1) return firstDist;
            return firstDist.convolve(this.zeroDist.pow(itemNum - 1));
        }
    }

    class AKDirectionalModel extends AKHardPityModel {
        constructor(noTypePityDist, upRate = 0.5) {
            super(noTypePityDist, 150, 1, upRate, 0);
        }
    }

    class AKLimitedMultModel extends CommonGachaModel {
        constructor(pityDist, upRateTotal = 0.7) {
            super();
            this.pityDist = pityDist;
            this.upRateTotal = upRateTotal;
        }

        call(itemNum = 1) {
            if (itemNum <= 0) return new FiniteDist([1]);
            const distOne6 = this.pityDist;
            let distOneUP = new FiniteDist([0]);
            let curr = distOne6;
            let pFail = 1 - this.upRateTotal;
            let pSucc = this.upRateTotal;

            for (let k = 1; k < 50; k++) {
                distOneUP = distOneUP.add(curr.mul(pSucc));
                curr = curr.convolve(distOne6);
                pSucc *= pFail;
                if (pSucc < 1e-15) break;
            }

            let distNeed2nd = new FiniteDist([0]);
            curr = distOneUP;
            pFail = 0.5;
            pSucc = 0.5;

            for (let k = 1; k < 50; k++) {
                distNeed2nd = distNeed2nd.add(curr.mul(pSucc));
                curr = curr.convolve(distOneUP);
                pSucc *= pFail;
                if (pSucc < 1e-15) break;
            }

            const total = distOneUP.convolve(distNeed2nd);

            if (itemNum > 1) {
                return total.convolve(total.pow(itemNum - 1));
            }
            return total;
        }
    }

    /**
     * Capturing Radiance Model (Genshin 5.0+)
     */
    class CapturingRadianceModel extends CommonGachaModel {
        constructor(pityP, crP = [0, 0, 0, 1]) {
            super();
            this.pityLayer = new PityLayer(pityP);
            this.crP = crP;
        }

        call(itemNum = 1, itemPity = 0, upPity = 0, crCounter = 1) {
            if (upPity === 1) {
                const distFirst = this.pityLayer.getDist(itemPity);
                if (itemNum === 1) return distFirst;
                const distRest = this._getCRDist(itemNum - 1, 0, 0, 1);
                return distFirst.convolve(distRest);
            }
            return this._getCRDist(itemNum, itemPity, upPity, crCounter);
        }

        _getCRDist(itemNum, itemPity, upPity, crCounter) {
            const burnDistArr = this._capturingRadianceDP(itemNum, upPity, crCounter);
            const distB = this.pityLayer.getDist(0);
            let totalDist = new FiniteDist([0]);
            let currentConv = this.pityLayer.getDist(itemPity);

            for (let k = 1; k < burnDistArr.length; k++) {
                const p = burnDistArr.dist[k];
                if (p > 1e-15) {
                    totalDist = totalDist.add(currentConv.mul(p));
                }
                currentConv = currentConv.convolve(distB);
            }
            return totalDist;
        }

        _capturingRadianceDP(itemNum, upPity, crCount) {
            const max5star = Math.ceil(itemNum * 1.8) + 10;
            const crP = this.crP;

            const M = new Float64Array((max5star + 1) * (itemNum + 1) * 4);
            const OFFSET_K = 1;
            const OFFSET_J = 4;
            const OFFSET_I = (itemNum + 1) * 4;

            function getM(i, j, k) {
                if (i < 0 || j < 0 || k < 0 || k >= 4) return 0;
                return M[i * OFFSET_I + j * OFFSET_J + k * OFFSET_K];
            }
            function addM(i, j, k, val) {
                if (i < 0 || j < 0 || k < 0 || k >= 4) return;
                M[i * OFFSET_I + j * OFFSET_J + k * OFFSET_K] += val;
            }

            addM(upPity, upPity, crCount, 1);

            for (let i = 1; i <= max5star; i++) {
                for (let j = 1; j <= itemNum; j++) {
                    if (i >= 2) {
                        for (let k = 1; k < 4; k++) {
                            const prev = getM(i - 2, j - 1, k - 1);
                            if (prev > 0) {
                                const probLose = 0.5 - crP[k - 1] / 2;
                                addM(i, j, k, prev * probLose);
                            }
                        }
                    }
                    for (let k = 0; k < 2; k++) {
                        const prev = getM(i - 1, j - 1, k + 1);
                        if (prev > 0) {
                            const val = 0.5 - crP[k + 1] / 2;
                            addM(i, j, k, prev * val);
                        }
                    }
                    {
                        const prev = getM(i - 1, j - 1, 0);
                        if (prev > 0) {
                            const val = 0.5 - crP[0] / 2;
                            addM(i, j, 0, prev * val);
                        }
                    }
                    for (let k = 0; k < 4; k++) {
                        const prev = getM(i - 1, j - 1, k);
                        if (prev > 0) {
                            const val = crP[k];
                            if (val > 0) {
                                addM(i, j, 1, prev * val);
                            }
                        }
                    }
                }
            }
            const result = new Float64Array(max5star + 1);
            for (let i = 0; i <= max5star; i++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += getM(i, itemNum, k);
                }
                result[i] = sum;
            }
            return new FiniteDist(result);
        }
    }

    global.GG.CommonGachaModel = CommonGachaModel;
    global.GG.DualPityModel = DualPityModel;
    global.GG.PityBernoulliModel = PityBernoulliModel;
    global.GG.CapturingRadianceModel = CapturingRadianceModel;
    global.GG.AKHardPityModel = AKHardPityModel;
    global.GG.AKDirectionalModel = AKDirectionalModel;
    global.GG.AKLimitedMultModel = AKLimitedMultModel;

    class DualPityBernoulliModel extends CommonGachaModel {
        constructor(pityDist, upRates = [0, 0.7, 1], bernRate = 0.5) {
            super();
            this.pityLayer = new PityLayer(pityDist);
            this.layers.push(this.pityLayer);
            this.upRate = upRates[1];
            this.bernRate = bernRate; // Rate of Target given Win Class
        }

        call(itemNum = 1, itemPity = 0, upPity = 0) {
            // upPity 0: Normal, 1: Guaranteed Class
            const D_fresh = this.pityLayer.getDist(0);

            // Calc Core distributions (from Normal State 0)
            // Win Class: upRate. Guarantee: 1-upRate.
            // Target: bernRate. Reset: 1-bernRate.

            // Paths from Normal:
            // 1. D -> Win Class -> Target (End): p = upRate * bernRate
            // 2. D -> Win Class -> NotTarget (Reset): p = upRate * (1 - bernRate)
            // 3. D -> Miss Class -> Guaranteed -> D -> Win Class (Guar=1) -> Target (End): p = (1-upRate) * bernRate
            // 4. D -> Miss Class -> Guaranteed -> D -> Win Class (Guar=1) -> NotTarget (Reset): p = (1-upRate) * (1-bernRate)

            // Combined Win (End) Step from Fresh Normal:
            // M_Win = D * (u*b) + D*D * ((1-u)*b)
            const P1 = this.upRate * this.bernRate;
            const P2 = (1 - this.upRate) * this.bernRate;
            const M_Win_Fresh = D_fresh.mul(P1).add(D_fresh.convolve(D_fresh).mul(P2));

            // Combined Reset (Loop) Step from Fresh Normal:
            const P3 = this.upRate * (1 - this.bernRate);
            const P4 = (1 - this.upRate) * (1 - this.bernRate);
            const M_Loop_Fresh = D_fresh.mul(P3).add(D_fresh.convolve(D_fresh).mul(P4));

            // Expected Dist from Fresh Normal E0:
            // E0 = M_Win + M_Loop * E0  => E0 = M_Win / (1 - M_Loop)
            // Using standard geometric process logic (PityBernoulli approach)
            // But we need to implement the geometric sum manually or use helper?
            // Helper `_solveGeometric(win, loop)`? 
            // In PityBernoulliModel, it does explicit loop K<50. 
            // Here M_Loop mass is significant (0.5). K needs to be large.
            // But `M_Loop` distribution is Pity-scale.
            // We can strictly iterate.

            // To save computation, let's allow `FiniteDist` methods or implement loop here.

            // Calculate E0 (Fresh Normal Dist)
            let E0 = new FiniteDist([0]);
            let curr = M_Win_Fresh;
            let loop = M_Loop_Fresh;
            // E0 = Win + Loop*Win + Loop^2*Win ...

            // This is equivalent to Convolve Power Series?
            // Actually: E0 = M_Win.convolve( (1-M_Loop)^-1 )
            // (1-X)^-1 = 1 + X + X^2 ...
            // Let G = 1 + Loop + Loop^2...
            // E0 = M_Win * G

            let G = new FiniteDist([1]);
            let loopPow = loop;
            // Iterate until probability mass of loopPow is negligible
            // Since loop mass is ~0.5, 0.5^20 < 1e-6. ~50 iters is fine.
            for (let k = 0; k < 50; k++) {
                // Optimization: accumulate G?
                // G += loopPow
                // Actually E0 += M_Win * Loop^k
                // Let's accumulate E0 directly.
            }
            // Better:
            // E0 = M_Win
            // currConv = M_Win
            // for k in 1..50:
            //    currConv = currConv * M_Loop
            //    E0 += currConv

            // Re-eval:
            // E0 initialized to M_Win_Fresh
            // term = M_Win_Fresh
            // loop = M_Loop_Fresh
            // for k=1..100: (0.5^50 is small enough)
            //    term = term.convolve(loop)
            //    E0 = E0.add(term)

            E0 = M_Win_Fresh;
            let term = M_Win_Fresh;
            for (let k = 0; k < 60; k++) { // 6-star pity is 70. 60 iterations of "Loop" (avg 1.5 pulls) -> 90 pulls * 60 = 5400?
                // Loop is "Reset". Takes ~1-2 6-stars.
                // Mass decreases by 0.5 each time.
                term = term.convolve(M_Loop_Fresh);
                E0 = E0.add(term);
                if (term.sum() < 1e-9) break;
            }

            // Determine First Item Dist
            let distFirst;

            if (upPity === 1) {
                // Guaranteed State
                // Path 1: D -> Win(Guar) -> Target(End): p = b
                // Path 2: D -> Win(Guar) -> NotTarget(Reset): p = 1-b

                // If itemPity > 0, we use D_curr
                const D_curr = this.pityLayer.getDist(itemPity);

                // Dist = D_curr*b + D_curr*(1-b) * E0
                const partWin = D_curr.mul(this.bernRate);
                const partReset = D_curr.mul(1 - this.bernRate).convolve(E0);
                distFirst = partWin.add(partReset);
            } else {
                // Normal State 
                // Uses M_Win_First and M_Loop_First based on D_curr
                const D_curr = this.pityLayer.getDist(itemPity);

                const M_Win_First = D_curr.mul(P1).add(D_curr.convolve(D_fresh).mul(P2));
                const M_Loop_First = D_curr.mul(P3).add(D_curr.convolve(D_fresh).mul(P4));

                // Dist = M_Win_First + M_Loop_First * G
                // Or Dist = M_Win_First + M_Loop_First * E0_from_Win / M_Win_fresh? No.
                // Dist = M_Win_First + M_Loop_First * E0 (Since after loop we are Fresh Normal)
                // Wait. E0 = Fresh Normal Target Dist.
                // Yes. If we loop (Reset), we go to Fresh Normal.

                distFirst = M_Win_First.add(M_Loop_First.convolve(E0));
            }

            if (itemNum === 1) return distFirst;

            // Subsequent items always start from Fresh Normal (Reset)
            // So they use E0.
            const restDist = E0.pow(itemNum - 1);
            return distFirst.convolve(restDist);
        }
    }

    // Exports
    global.GG.Models.CommonGachaModel = CommonGachaModel;
    global.GG.Models.DualPityModel = DualPityModel;
    global.GG.Models.PityBernoulliModel = PityBernoulliModel;
    global.GG.Models.AKHardPityModel = AKHardPityModel;
    global.GG.Models.AKDirectionalModel = AKDirectionalModel; // Ensure these are kept
    global.GG.Models.AKLimitedMultModel = AKLimitedMultModel;
    global.GG.Models.DualPityBernoulliModel = DualPityBernoulliModel;

})(window);
