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
