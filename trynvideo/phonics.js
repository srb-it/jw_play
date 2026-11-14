const phonicsSets = {
  long: {
    a: { ake: "bake cake lake rake make", ape: "tape cape", ave: "wave cave", ame: "name game same", ate: "date mate gate", ane: "mane", ase: "vase case", ade: "made" },
    i: { ine: "pine line nine vine", ike: "hike bike like", ime: "time lime", ite: "bite kite", ide: "hide ride", ive: "dive hive five live", ipe: "pipe wipe" },
    o: { ose: "hose nose pose rose", ope: "hope rope", ote: "note vote", ole: "mole pole", ome: "dome home", one: "bone cone" },
    u: { ube: "cube tube", ute: "cute mute", une: "dune June tune", ule: "mule" },
  },
  mixed: {
    a: "man/mane can/cane tap/tape rat hat/hate tag pan ham jam bat cat mat/mate ram dam lap cap/cape nap map rake",
    i: "bib rib kid lid pig wig dig pin fin dip hip lip rip hit sit/site mix six ship ride hide hive live five hike bike like time lime pipe wipe nine line pine vine",
    o: "hot pot box fox cop hop/hope dog log hose nose pose rose hole rope sole note vote mole pole dome home bone cone",
    u: "bug hug mug rug rub tub cup pup cut/cute mute June tune dune cube tube mule",
  },
};

function phonicsGroups(vowel) {
  const groups = phonicsSets.long;
  return Object.entries(vowel === "all" ? Object.assign({}, ...Object.values(groups)) : groups[vowel]);
}

function buildPhonicsDeck(set, vowel, pattern = "", target = 10) {
  if (set === "long") {
    const groups = phonicsGroups(vowel);
    const start = Math.max(0, groups.findIndex(([ending]) => ending === pattern));
    const ordered = [...groups.slice(start), ...groups.slice(0, start)];
    let entries = ordered.map(([, words]) => words).join(" ").split(" ");
    if (entries.length < target) {
      entries = entries.concat(phonicsGroups("all")
        .filter(([ending]) => !groups.some(([selected]) => selected === ending))
        .flatMap(([, words]) => words.split(" ")));
    }
    return entries.slice(0, target).map((word) => [word]);
  }
  const groups = phonicsSets[set];
  const entries = vowel === "all" ? Object.values(groups) : [groups[vowel]];
  const deck = [...new Set(entries.join(" ").split(" "))].map((entry) => entry.split("/"));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
