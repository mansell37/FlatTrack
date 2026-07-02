import { api } from "./api";

export type Topic = "history" | "sport" | "science" | "biology" | "mix";

export const TOPICS: { key: Topic; emoji: string; label: string }[] = [
  { key: "history", emoji: "📜", label: "History" },
  { key: "sport", emoji: "🏅", label: "Sport" },
  { key: "science", emoji: "🔬", label: "Science" },
  { key: "biology", emoji: "🫀", label: "Human Biology" },
  { key: "mix", emoji: "🎲", label: "Surprise me" },
];

// Built-in facts per topic — used offline / while AI facts load / when no key is set.
const LOCAL: Record<Topic, string[]> = {
  history: [
    "Oxford University is older than the Aztec Empire — teaching began there around 1096, while Tenochtitlan was founded in 1325.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid of Giza.",
    "The Hundred Years' War actually lasted 116 years, from 1337 to 1453.",
    "Ancient Romans used crushed mouse brains as toothpaste — and urine as a whitener, since its ammonia bleaches.",
    "In 1907, a horse called Clever Hans became world-famous for 'doing arithmetic' — he was actually reading his questioner's body language.",
    "The shortest war in history was between Britain and Zanzibar in 1896. It lasted about 38 minutes.",
    "Genghis Khan's empire was so large that a letter could cross it faster in the 1200s than mail crossed Europe 500 years later, thanks to the Yam relay system.",
    "The first bicycles, 'dandy horses' of 1817, had no pedals — riders pushed along the ground with their feet.",
  ],
  sport: [
    "Tour de France riders burn around 6,000–7,000 calories on a big mountain stage — close to three days of normal eating.",
    "Eddy Merckx won 525 races in his career — so dominant they nicknamed him 'The Cannibal'.",
    "The marathon distance of 26.2 miles was fixed at the 1908 London Olympics so the race could finish in front of the royal box.",
    "A cyclist drafting in a peloton can save up to 40% of the energy of riding alone — team tactics are built around this.",
    "The fastest recorded bicycle speed is 296 km/h (184 mph), set by Denise Mueller-Korenek drafting behind a dragster in 2018.",
    "Basketball was invented in 1891 by James Naismith with peach baskets — someone had to fetch the ball after every score.",
    "In the 1904 Olympic marathon, the 'winner' Fred Lorz had hitched a car ride for 11 miles. He was disqualified.",
    "The yellow jersey is yellow because the Tour de France's sponsoring newspaper, L'Auto, was printed on yellow paper.",
  ],
  science: [
    "There are more possible arrangements of a deck of 52 cards than atoms on Earth — every proper shuffle is almost certainly unique in history.",
    "Neutron stars are so dense that a sugar-cube-sized piece would weigh about a billion tonnes.",
    "Honey never spoils — edible honey has been found in 3,000-year-old Egyptian tombs.",
    "A day on Venus is longer than its year: it rotates once every 243 Earth days but orbits the Sun in 225.",
    "Lightning is roughly five times hotter than the surface of the Sun — about 30,000°C.",
    "Bananas are slightly radioactive thanks to potassium-40. You'd need about 10 million at once for a harmful dose.",
    "Around 95% of the universe is dark energy and dark matter — everything we can see is only about 5%.",
    "Aluminium was once more precious than gold — Napoleon III served his most honoured guests with aluminium cutlery.",
  ],
  biology: [
    "Your heart pumps about 7,500 litres of blood a day — enough to fill a small road tanker.",
    "Trained cyclists can have resting heart rates in the 30s — Miguel Induráin's was reportedly 28 bpm.",
    "Muscles don't 'burn' from lactic acid — the burn is mostly hydrogen ions; lactate is actually recycled as fuel.",
    "Laid end to end, your blood vessels would stretch roughly 100,000 km — about two and a half times around the Earth.",
    "Your body replaces about 330 billion cells every day — nearly 1% of all your cells.",
    "VO2 max — the gold-standard measure of aerobic fitness — can improve 15–20% with training, but its ceiling is largely genetic.",
    "Bone is, weight for weight, stronger than steel — a matchbox-sized block can support up to 9 tonnes.",
    "During hard exercise, blood flow to your muscles can increase 20-fold while your gut's supply is cut by ~80% — why racing on a full stomach hurts.",
  ],
  mix: [], // filled below
};
LOCAL.mix = [...LOCAL.history, ...LOCAL.sport, ...LOCAL.science, ...LOCAL.biology];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Load facts for a topic: fresh AI facts when the server can produce them,
 * padded with the local bank; local-only offline.
 */
export async function loadFacts(topic: Topic): Promise<string[]> {
  let ai: string[] = [];
  try {
    const res = await api.facts(topic);
    ai = (res.facts || []).filter((f) => typeof f === "string" && f.length > 20);
  } catch {
    /* offline / no key — local bank only */
  }
  const local = shuffle(LOCAL[topic]);
  return ai.length ? [...shuffle(ai), ...local.slice(0, 4)] : local;
}
