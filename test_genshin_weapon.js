
const window = {};
global.window = window;
require('./js/logic/distribution.js');
require('./js/logic/layer.js');
require('./js/logic/model.js');
require('./js/logic/games/genshin.js');

const model = window.GG.Models['genshin'].weapon.model;
const dist = model.call(1, 0, 0);
console.log("Weapon Exp (1 copy):", dist.exp); // Should be around 68-70?
// Python code simulation:
// P(One) = 0.375. Fail -> Next Guarantee.
// E = 0.375 * 1 * pity + 0.625 * 2 * pity approx.
// avg pity ~ 64
// E ~ 64 * (0.375 + 1.25) = 64 * 1.625 = 104? No wait.
// DualPityModel [0, 0.375, 1] means:
// Win 0.375. Lose 0.625. If Lose, next is 1.
// Expected 5-stars needed:
// p(1) = 0.375.
// p(2) = 0.625.
// Exp 5-stars = 0.375*1 + 0.625*2 = 1.625.
// Exp Pulls = 1.625 * AvgPity (per 5-star).
// Standard Weapon Pity Avg ~ 62-63?
// 1.625 * 63 = 102.3
// But if I used 0.75 previously:
// Exp 5-stars = 0.75*1 + 0.25*2 = 1.25
// Exp Pulls = 1.25 * 63 = 78.
// User said "Huge error", presumably numbers were too low.
// So 102 is plausible for "Specific Weapon".
console.log("Variances:", dist.var);
