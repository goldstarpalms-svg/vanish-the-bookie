// Every fixture, rating and result in this file is SYNTHETIC.
// Real team/player names are used only to make the interface easy to understand.
const team = (name, short, color, initials) => ({
  name,
  short,
  color,
  initials,
});
const dateInLagos = (now) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
function kickoffFor(date, offset, time) {
  const d = new Date(`${date}T12:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return new Date(`${dateInLagos(d)}T${time}:00+01:00`).toISOString();
}
const footballInputs = (ha, aa, hd, ad) => ({
  leagueGoals: 1.38,
  homeAttack: ha,
  awayAttack: aa,
  homeDefence: hd,
  awayDefence: ad,
  homeAdvantage: 0.18,
});
const raw = [
  {
    id: "ars-che",
    sport: "football",
    league: "Premier League",
    region: "England",
    day: 0,
    time: "19:45",
    home: team("Arsenal", "ARS", "#df3349", "A"),
    away: team("Chelsea", "CHE", "#326fea", "C"),
    inputs: footballInputs(1.38, 1.06, 0.82, 1.08),
  },
  {
    id: "bar-sev",
    sport: "football",
    league: "La Liga",
    region: "Spain",
    day: 0,
    time: "20:00",
    home: team("Barcelona", "BAR", "#a543a0", "B"),
    away: team("Sevilla", "SEV", "#df5262", "S"),
    inputs: footballInputs(1.44, 0.93, 0.86, 1.13),
  },
  {
    id: "int-nap",
    sport: "football",
    league: "Serie A",
    region: "Italy",
    day: 0,
    time: "20:45",
    home: team("Inter Milan", "INT", "#4084e4", "I"),
    away: team("Napoli", "NAP", "#4cc6e5", "N"),
    inputs: footballInputs(1.15, 1.18, 0.86, 0.9),
  },
  {
    id: "psg-lyo",
    sport: "football",
    league: "Ligue 1",
    region: "France",
    day: 1,
    time: "20:00",
    home: team("Paris Saint-Germain", "PSG", "#6479d7", "P"),
    away: team("Lyon", "LYO", "#ec7284", "L"),
    inputs: footballInputs(1.42, 1.1, 0.81, 1.12),
  },
  {
    id: "dor-fra",
    sport: "football",
    league: "Bundesliga",
    region: "Germany",
    day: 0,
    time: "17:30",
    home: team("Dortmund", "BVB", "#e8c840", "B"),
    away: team("Frankfurt", "SGE", "#ec7376", "F"),
    inputs: footballInputs(1.2, 1.23, 1.11, 1.08),
  },
  {
    id: "liv-new",
    sport: "football",
    league: "Premier League",
    region: "England",
    day: 1,
    time: "20:30",
    home: team("Liverpool", "LIV", "#e65364", "L"),
    away: team("Newcastle", "NEW", "#b0b9bf", "N"),
    inputs: footballInputs(1.31, 1.14, 0.83, 0.94),
  },
  {
    id: "bos-mia",
    sport: "basketball",
    league: "NBA",
    region: "USA",
    day: 0,
    time: "21:00",
    home: team("Boston Celtics", "BOS", "#48b884", "B"),
    away: team("Miami Heat", "MIA", "#ed7169", "M"),
    inputs: { homeRating: 6.4, awayRating: 1.8, homeAdvantage: 2.5, sigma: 12 },
  },
  {
    id: "den-phx",
    sport: "basketball",
    league: "NBA",
    region: "USA",
    day: 1,
    time: "02:00",
    home: team("Denver Nuggets", "DEN", "#73a0dd", "D"),
    away: team("Phoenix Suns", "PHX", "#b088eb", "P"),
    inputs: { homeRating: 4.8, awayRating: 2.2, homeAdvantage: 2.5, sigma: 12 },
  },
  {
    id: "lal-gsw",
    sport: "basketball",
    league: "NBA",
    region: "USA",
    day: 0,
    time: "22:30",
    home: team("LA Lakers", "LAL", "#c190ec", "L"),
    away: team("Golden State", "GSW", "#e3bd62", "G"),
    inputs: { homeRating: 1.7, awayRating: 3.9, homeAdvantage: 2.5, sigma: 12 },
  },
  {
    id: "alc-sin",
    sport: "tennis",
    league: "ATP · Sample match",
    region: "Singles",
    day: 0,
    time: "16:00",
    home: team("Carlos Alcaraz", "ALC", "#dda766", "CA"),
    away: team("Jannik Sinner", "SIN", "#77bbaf", "JS"),
    inputs: { homeElo: 2140, awayElo: 2195 },
  },
  {
    id: "sab-swi",
    sport: "tennis",
    league: "WTA · Sample match",
    region: "Singles",
    day: 0,
    time: "18:15",
    home: team("Aryna Sabalenka", "SAB", "#cfa1db", "AS"),
    away: team("Iga Świątek", "SWI", "#729de9", "IS"),
    inputs: { homeElo: 2180, awayElo: 2145 },
  },
  {
    id: "gau-ryb",
    sport: "tennis",
    league: "WTA · Sample match",
    region: "Singles",
    day: 1,
    time: "14:00",
    home: team("Coco Gauff", "GAU", "#d395c3", "CG"),
    away: team("Elena Rybakina", "RYB", "#8fbdae", "ER"),
    inputs: { homeElo: 2075, awayElo: 2050 },
  },
];
export function demoFixtures(now = new Date()) {
  const date = dateInLagos(now);
  return raw.map(({ day, time, ...fixture }) => ({
    ...fixture,
    id: `demo-${fixture.id}`,
    kickoff: kickoffFor(date, day, time),
    sample: true,
  }));
}
export function demoArchive(now = new Date()) {
  const date = dateInLagos(now);
  const results = [
    { home: 2, away: 1 },
    { home: 1, away: 2 },
    { home: 1, away: 1 },
    { home: 3, away: 1 },
    { home: 2, away: 1 },
    { home: 0, away: 1 },
    { home: 112, away: 103 },
    { home: 104, away: 111 },
    { void: true },
    { home: 0, away: 2 },
    { home: 2, away: 1 },
    { home: 2, away: 0 },
  ];
  return raw.map(({ day, time, ...fixture }, index) => ({
    ...fixture,
    id: `archive-${fixture.id}`,
    kickoff: kickoffFor(date, -1 - Math.floor(index / 4), time),
    sample: true,
    result: results[index],
  }));
}
