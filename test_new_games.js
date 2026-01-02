
const window = {};
global.window = window;
require('./js/logic/distribution.js');
require('./js/logic/layer.js');
require('./js/logic/model.js');
require('./js/logic/games/wuthering_waves.js');
require('./js/logic/games/arknights.js');
require('./js/logic/games/reverse_1999.js');

function test(game, type, num) {
    if (!window.GG.Models[game]) {
        console.error(`Missing ${game}`);
        return;
    }
    try {
        const model = window.GG.Models[game][type].model;
        const res = model.call(num, 0, 0);
        console.log(`[${game}][${type}] x${num} Exp: ${res.exp.toFixed(2)}`);
    } catch (e) {
        console.error(`[${game}][${type}] Failed:`, e);
    }
}

test('wuthering_waves', 'character', 1); // ~ 60-70?
test('wuthering_waves', 'weapon', 1); // 100% up? Exp ~ Pity?
test('arknights', 'character', 1); // 50% up. Stdev ~35? Exp ~35*2=70?
test('reverse_1999', 'character', 1); // 50% up.
