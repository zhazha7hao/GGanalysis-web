
const window = {};
global.window = window;

// Execute the logic
require('./debug_logic.js');

console.log("GG exists?", !!window.GG);
console.log("Models exists?", !!(window.GG && window.GG.Models));
if (window.GG && window.GG.Models) {
    console.log("Genshin model loaded?", !!window.GG.Models['genshin']);
}
