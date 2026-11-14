const phonicsSets = {
  long: {
    a: "bake cake lake rake make tape cape wave cave name game same date mate gate mane vase case made",
    i: "pine line nine vine hike bike like time lime bite kite hide ride dive hive five live pipe wipe",
    o: "hose nose pose rose hope rope note vote mole pole dome home bone cone",
    u: "cube tube cute mute dune June tune mule",
  },
  mixed: {
    a: "man/mane can/cane tap/tape rat hat/hate tag pan ham jam bat cat mat/mate ram dam lap cap/cape nap map rake",
    i: "bib rib kid lid pig wig dig pin fin dip hip lip rip hit sit/site mix six ship ride hide hive live five hike bike like time lime pipe wipe nine line pine vine",
    o: "hot pot box fox cop hop/hope dog log hose nose pose rose hole rope sole note vote mole pole dome home bone cone",
    u: "bug hug mug rug rub tub cup pup cut/cute mute June tune dune cube tube mule",
  },
};

function buildPhonicsDeck(set, vowel) {
  const groups = phonicsSets[set];
  const entries = vowel === "all" ? Object.values(groups) : [groups[vowel]];
  const deck = [...new Set(entries.join(" ").split(" "))].map((entry) => entry.split("/"));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
