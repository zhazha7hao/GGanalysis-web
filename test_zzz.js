
const window = {};
global.window = window;
require('./js/logic/distribution.js');
require('./js/logic/layer.js');
require('./js/logic/model.js');
require('./js/logic/games/zzz.js');

console.log("GG.Models exists?", !!window.GG.Models);
console.log("ZZZ loaded?", !!window.GG.Models['zzz']);
if (window.GG.Models['zzz']) {
    console.log("ZZZ Name:", window.GG.Models['zzz'].name);
    try {
        const model = window.GG.Models['zzz'].character.model;
        const res = model.call(1, 0, 0);
        console.log("Calc result exp:", res.exp);
    } catch (e) {
        console.error("Calc failed:", e);
    }
}
