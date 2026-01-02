
const window = {};
global.window = window;
require('./js/logic/distribution.js');
require('./js/logic/layer.js');
require('./js/logic/model.js');
require('./js/logic/games/genshin.js');

const model = window.GG.Models['genshin'].character.model;
const FiniteDist = window.GG.FiniteDist;

// Mock PityLayer getDist to verify it
const pityLayer = model.pityLayer;
const distA = pityLayer.getDist(0);
console.log("DistA Sum:", distA.pSum); // Should be 1
console.log("DistA Exp:", distA.exp);

// Verbose call
const itemNum = 1;
const burnDistArr = model._capturingRadianceDP(itemNum, 0, 1);
console.log("BurnDist Sum (should be 1):", burnDistArr.pSum);
console.log("BurnDist Dist:", burnDistArr.dist);

let totalDist = new FiniteDist([0]);
let currentConv = distA;

for (let k = 1; k < burnDistArr.length; k++) {
    const p = burnDistArr.dist[k];
    if (p > 1e-15) {
        console.log(`k=${k}, p=${p}`);
        console.log("CurrentConv Sum:", currentConv.pSum);
        const term = currentConv.mul(p);
        console.log("Term Sum:", term.pSum);
        totalDist = totalDist.add(term);
        console.log("TotalDist Sum So Far:", totalDist.pSum);
    }
    const distB = pityLayer.getDist(0);
    currentConv = currentConv.convolve(distB);
}

console.log("Final TotalDist Sum:", totalDist.pSum);
console.log("Final TotalDist Exp:", totalDist.exp);
