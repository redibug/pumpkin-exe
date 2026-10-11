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
      { speaker: 'mel', text: 'Good work. I see a turret guarding the next lane. Watch its row.' },
      { speaker: 'bugchan', text: 'A turret? I will stay off its row!' },
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
      { speaker: 'mel', text: 'Nice dodging. Next up is a bomb spider. Do not stand still.' },
      { speaker: 'bugchan', text: 'Bombs?! I will keep moving!' },
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
      { speaker: 'mel', text: 'Good. Now I am picking up root signals. Something is digging.' },
      { speaker: 'bugchan', text: 'Digging? Smells like dirt...' },
    ],
  },
  {
    name: 'ROOT CELLAR',
    enemies: [
      { type: 'rootabreak', col: 4, row: 0 },
      { type: 'rootabreak', col: 4, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Two rootabreak viruses. They hide underground, then jump out screaming.' },
      { speaker: 'bugchan', text: 'Smells like dirt! I will debug these roots!' },
      { speaker: 'rootabreak', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Two down! That was easy!' },
    ],
    story: [
      { speaker: 'mel', text: 'The plants are spreading. I see turrets tangled in vines ahead.' },
      { speaker: 'bugchan', text: 'Plants and turrets? Weird combo!' },
    ],
  },
  {
    name: 'OVERGROWTH',
    enemies: [
      { type: 'sentry', col: 5, row: 0 },           // top right
      { type: 'sentry', col: 5, row: 2 },           // bottom right
      { type: 'skitterbug-green', col: 3, row: 0 },  // top left (fast)
      { type: 'skitterbug-green', col: 4, row: 2 },  // middle bottom (fast)
    ],
    intro: [
      { speaker: 'mel', text: 'Turrets wrapped in vines, and green beetles. They are faster than normal.' },
      { speaker: 'bugchan', text: 'Fast and green! I will still squash them!' },
      { speaker: 'sentry', text: 'TARGET ACQUIRED.' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Fast or not, they are squashed!' },
    ],
    story: [
      { speaker: 'mel', text: 'The roots and bombs are nesting together now. Be careful.' },
      { speaker: 'bugchan', text: 'Roots AND bombs? Double trouble!' },
    ],
  },
  {
    name: 'ROOT NEST',
    enemies: [
      { type: 'rootabreak', col: 3, row: 0 },  // top left
      { type: 'bombspider', col: 4, row: 1 },  // middle
      { type: 'rootabreak', col: 5, row: 2 },  // bottom right
    ],
    intro: [
      { speaker: 'mel', text: 'A nest. Roots on the edges, spider in the middle with bombs.' },
      { speaker: 'bugchan', text: 'Messy nest! I will clean it up!' },
      { speaker: 'rootabreak', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Nest cleared! No more ticking!' },
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
