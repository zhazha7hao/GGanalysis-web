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
