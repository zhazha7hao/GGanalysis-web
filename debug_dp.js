
const max5star = 12;
const itemNum = 1;
const upPity = 0;
const crCount = 1;
const crP = [0, 0, 0, 1];

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
        // 1. Guaranteed
        if (i >= 2) {
            for (let k = 1; k < 4; k++) {
                const prev = getM(i - 2, j - 1, k - 1);
                if (prev > 0) {
                    const probLose = 0.5 - crP[k - 1] / 2;
                    console.log(`i=${i} j=${j} k=${k}: From Guaranteed (prev=${prev}, prob=${probLose})`);
                    addM(i, j, k, prev * probLose);
                }
            }
        }
        // 2. Small Pity Win
        for (let k = 0; k < 2; k++) {
            const prev = getM(i - 1, j - 1, k + 1);
            if (prev > 0) {
                const val = 0.5 - crP[k + 1] / 2;
                console.log(`i=${i} j=${j} k=${k}: From Win (prev=${prev}, val=${val})`);
                addM(i, j, k, prev * val);
            }
        }
        // Special k=0
        {
            const prev = getM(i - 1, j - 1, 0);
            if (prev > 0) {
                const val = 0.5 - crP[0] / 2;
                console.log(`i=${i} j=${j} k=0: From Win special (prev=${prev}, val=${val})`);
                addM(i, j, 0, prev * val);
            }
        }
        // 3. Capture
        for (let k = 0; k < 4; k++) {
            const prev = getM(i - 1, j - 1, k);
            if (prev > 0) {
                const val = crP[k];
                if (val > 0) {
                    console.log(`i=${i} j=${j} k=1: From Capture (prev=${prev}, val=${val})`);
                    addM(i, j, 1, prev * val);
                }
            }
        }
    }
}

const result = [];
let totalSum = 0;
for (let i = 0; i <= max5star; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += getM(i, itemNum, k);
    result.push(sum);
    totalSum += sum;
}
console.log("Result:", result);
console.log("Total Sum:", totalSum);
