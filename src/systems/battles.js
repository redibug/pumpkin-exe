// Battle definitions: order, enemy placements, and dialogue scripts.
// Mel owns the dialogue text — keep lines short and simple.

export const BATTLES = [
  {
    name: 'SKITTER PATROL',
    enemies: [
      { type: 'skitterbug', col: 3, row: 0 },
      { type: 'skitterbug', col: 4, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you in. Two beetle viruses are crawling around in there.' },
      { speaker: 'bugchan', text: 'Beetles with cannons?! I will debug these bugs!' },
      { speaker: 'skitterbug', text: 'SKITTER SKITTER!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Squashed! Those beetles were slow!' },
    ],
    story: [
      { speaker: 'mel', text: 'Good work. But I see roots digging nearby. Stay sharp.' },
      { speaker: 'bugchan', text: 'Roots? Smells like rutabagas...' },
    ],
  },
  {
    name: 'SENTRY POST',
    naviStart: { col: 0, row: 2 }, // bottom left
    enemies: [
      { type: 'skitterbug', col: 3, row: 0 }, // top left enemy square
      { type: 'sentry', col: 5, row: 1 },     // far right middle
    ],
    intro: [
      { speaker: 'mel', text: 'A sentry turret is guarding that lane. It only shoots when you are on its row.' },
      { speaker: 'bugchan', text: 'Then I will stay off its row! Easy!' },
      { speaker: 'sentry', text: 'TARGET ACQUIRED.' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Turret down! It never even moved!' },
    ],
    story: [
      { speaker: 'mel', text: 'Nice dodging. Something is sprouting ahead...' },
      { speaker: 'bugchan', text: 'I smell veggies. Rutabaga veggies!' },
    ],
  },
  {
    name: 'BOMB NEST',
    enemies: [
      { type: 'bombspider', col: 4, row: 1 },
    ],
    intro: [
      { speaker: 'mel', text: 'A spider virus carrying a bomb. It throws it at you. Do not stand still.' },
      { speaker: 'bugchan', text: 'A bomb?! Cute spider, bad idea!' },
      { speaker: 'bombspider', text: 'TICK TOCK!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Defused! No more bombs!' },
    ],
    story: [
      { speaker: 'mel', text: 'Good. The bombs are getting bigger ahead...' },
      { speaker: 'bugchan', text: 'Bigger bombs? I am ready!' },
    ],
  },
  {
    name: 'SPROUT PATROL',
    enemies: [
      { type: 'rootabreak', col: 4, row: 0 },
      { type: 'rootabreak', col: 4, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you in. Two rootabreak viruses are digging around in there.' },
      { speaker: 'bugchan', text: 'Smells like dirt! I will debug these roots!' },
      { speaker: 'rootabreak', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Two down! That was easy!' },
    ],
    story: [
      { speaker: 'mel', text: 'Good work. But I see more signals deeper in. Keep going.' },
      { speaker: 'bugchan', text: 'Deeper? It smells worse down there...' },
    ],
  },
  {
    name: 'ROOT CELLAR',
    enemies: [
      { type: 'rootabreak', col: 3, row: 0 },
      { type: 'rootabreak', col: 5, row: 1, big: true },
      { type: 'rootabreak', col: 3, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Three this time. The big one in the middle looks mean.' },
      { speaker: 'bugchan', text: 'Big root, big problems! Chips ready, Mel!' },
      { speaker: 'rootabreak', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Phew! The big one almost got me!' },
    ],
    story: [
      { speaker: 'mel', text: 'One signal left. It is huge. Be careful, Bugchan.' },
      { speaker: 'bugchan', text: 'Huge? Like... pumpkin huge?' },
      { speaker: 'pumpkin', text: 'I AM PUMPKIN.EXE! THIS HARVEST IS MINE, LITTLE BUG!' },
    ],
  },
  {
    name: 'PUMPKIN.EXE',
    enemies: [
      { type: 'pumpkin', col: 4, row: 1 },
      { type: 'rootabreak', col: 5, row: 0 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you into the cyberworld. Something is wrong in there...' },
      { speaker: 'bugchan', text: 'Whoa! Pumpkins everywhere! And they look mad!' },
      { speaker: 'pumpkin', text: 'I AM PUMPKIN.EXE! THIS HARVEST IS MINE, LITTLE BUG!' },
      { speaker: 'bugchan', text: 'Not on my watch! Mel, send chips! I will debug this gourd!' },
    ],
    victory: [
      { speaker: 'pumpkin', text: 'NO... MY HARVEST... ROTTING...' },
      { speaker: 'bugchan', text: 'Virus deleted! Good work, Mel!' },
    ],
    story: [], // last battle: no story after, goes to ending
  },
];
