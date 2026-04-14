/**
 * File overview:
 * Purpose: Renders Home UI for the app's screens and flows.
 * Main exports: featureCards, journeyCards, miniCelebrationConfetti, animatedUmpireFrames, animatedHistoryFrames, animatedSpectatorFrames, animatedTeamsFrames, animatedLoudspeakerFrames, animatedWalkieFeatureFrames, animatedAnnouncerFrames, animatedShareFrames, animatedCoverFrames, animatedInsightsFrames, animatedDirectorFrames, animatedLiveBannerFrames, animatedJourneyWalkieFrames, animatedJourneyAudioFrames, animatedAccessFrames.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

export const featureCards = [
  {
    title: "Walkie-Talkie",
    copy: "One live talk channel for the umpire, director, and spectators. It keeps quick calls and responses on the same line.",
    accent: "emerald",
    previewType: "walkie",
  },
  {
    title: "Loudspeaker",
    copy: "Turn one phone into a quick PA mic for score calls and ground updates. It works well for tournaments, match venues, and indoor screens.",
    accent: "amber",
    previewType: "loudspeaker",
  },
  {
    title: "Score Announcer",
    copy: "Read the score out loud with cleaner timing and clearer voice updates. That helps players and viewers hear the match state without looking down.",
    accent: "violet",
    previewType: "announcer",
  },
  {
    title: "Share The Match",
    copy: "Share one live link so anyone can follow the match on any screen. Phones, tablets, and TVs can all open the same live scoreboard fast.",
    accent: "orange",
    previewType: "share",
  },
  {
    title: "Match Images",
    copy: "Use one match image across the live, spectator, and result screens. It keeps every match page looking consistent from start to finish.",
    accent: "rose",
    previewType: "cover",
  },
  {
    title: "Result Insights",
    copy: "Finish with a clear result screen and a better winner summary. The last screen feels complete instead of looking like a raw scoreboard dump.",
    accent: "yellow",
    previewType: "insights",
  },
  {
    title: "Director Console",
    copy: "Control music, effects, walkie, and live audio from one screen. It gives one operator a cleaner way to run the full match sound desk.",
    accent: "cyan",
    previewType: "director",
  },
  {
    title: "Live Match Banner",
    copy: "Bring the newest live match to the home page for one-tap viewing. Anyone opening the site can jump straight into the live game.",
    accent: "emerald",
    previewType: "livebanner",
  },
];

export const journeyCards = [
  {
    title: "Create Teams And Session",
    copy: "Create the match, add two teams, and start from one clean setup screen. The setup stays simple even for someone running a full match quickly.",
    accent: "rose",
    previewType: "teams",
  },
  {
    title: "Run The Toss",
    copy: "Choose who starts with the bat or ball, then go live. The toss flow is quick and clear before the first ball is scored.",
    accent: "amber",
    previewType: "toss",
  },
  {
    title: "Control The Match In Umpire Mode",
    copy: "One live screen lets you update the score, mark wickets and extras, read the score aloud, use walkie-talkie, and play sound effects. It is designed so one person can run the whole live match from one phone.",
    accent: "orange",
    previewType: "umpire",
  },
  {
    title: "Track Ball History",
    copy: "See recent balls in order so everyone knows what just happened. That makes it easier to understand the latest over without asking again.",
    accent: "cyan",
    previewType: "history",
  },
  {
    title: "Share The Spectator View",
    copy: "Share one simple link so anyone can follow the match on any screen. Spectators do not need umpire access or match controls to keep up.",
    accent: "emerald",
    previewType: "spectator",
  },
  {
    title: "Read Match Status Fast",
    copy: "Show the score, target, overs left, and whether the game is live or finished. It also makes innings changes and final results easy to spot.",
    accent: "cyan",
    previewType: "status",
  },
  {
    title: "Talk With In-Match Walkie",
    copy: "Let the umpire and director talk live when something needs attention. That keeps decisions and coordination inside the match instead of outside apps.",
    accent: "emerald",
    previewType: "match-walkie",
  },
  {
    title: "Use Loudspeaker And Announcer",
    copy: "Play spoken updates, PA calls, and effects without leaving the match. Audio stays part of the live scoring flow instead of a separate setup.",
    accent: "violet",
    previewType: "match-audio",
  },
  {
    title: "Keep Match Access Secure",
    copy: "Protect control screens with a PIN while keeping the viewer side easy to open. The right people get match control without slowing down the flow.",
    accent: "violet",
    previewType: "access",
  },
];

export const miniCelebrationConfetti = [
  {
    left: "8%",
    delay: "0.1s",
    duration: "4.3s",
    rotate: "12deg",
    color: "#facc15",
  },
  {
    left: "18%",
    delay: "0.5s",
    duration: "4.9s",
    rotate: "-16deg",
    color: "#fde68a",
  },
  {
    left: "31%",
    delay: "0.2s",
    duration: "4.5s",
    rotate: "18deg",
    color: "#ffffff",
  },
  {
    left: "46%",
    delay: "0.7s",
    duration: "5.1s",
    rotate: "-10deg",
    color: "#f59e0b",
  },
  {
    left: "61%",
    delay: "0.35s",
    duration: "4.6s",
    rotate: "15deg",
    color: "#facc15",
  },
  {
    left: "75%",
    delay: "0.8s",
    duration: "5.3s",
    rotate: "-14deg",
    color: "#fde68a",
  },
  {
    left: "88%",
    delay: "0.45s",
    duration: "4.8s",
    rotate: "11deg",
    color: "#ffffff",
  },
];

export const animatedUmpireFrames = [
  {
    target: "39",
    score: "20/0",
    overs: "2.1",
    oversLeft: "(23)",
    activeAction: "Dot",
  },
  {
    target: "39",
    score: "21/0",
    overs: "2.2",
    oversLeft: "(22)",
    activeAction: "1",
  },
  {
    target: "39",
    score: "23/0",
    overs: "2.3",
    oversLeft: "(21)",
    activeAction: "2",
  },
  {
    target: "39",
    score: "26/0",
    overs: "2.4",
    oversLeft: "(20)",
    activeAction: "3",
  },
  {
    target: "39",
    score: "30/0",
    overs: "2.5",
    oversLeft: "(19)",
    activeAction: "4",
  },
  {
    target: "39",
    score: "31/0",
    overs: "2.5",
    oversLeft: "(19)",
    activeAction: "Wide",
  },
  {
    target: "39",
    score: "37/0",
    overs: "2.6",
    oversLeft: "(18)",
    activeAction: "6",
  },
  {
    target: "39",
    score: "37/1",
    overs: "3.0",
    oversLeft: "(18)",
    activeAction: "OUT",
  },
];

export const animatedHistoryFrames = [
  {
    scoreLine: "Team A 49/3",
    balls: [{ label: "1" }],
    note: "Ball 1 added",
  },
  {
    scoreLine: "Team A 53/3",
    balls: [{ label: "1" }, { label: "4", tone: "amber" }],
    note: "Ball 2 added",
  },
  {
    scoreLine: "Team A 54/3",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
    ],
    note: "Ball 3 added",
  },
  {
    scoreLine: "Team A 54/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
    ],
    note: "Ball 4 added",
  },
  {
    scoreLine: "Team A 56/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
      { label: "2" },
    ],
    note: "Ball 5 added",
  },
  {
    scoreLine: "Team A 57/4",
    balls: [
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "Wd", tone: "amber" },
      { label: "W", tone: "rose" },
      { label: "2" },
      { label: "1" },
    ],
    note: "Over complete",
  },
];

export const animatedSpectatorFrames = [
  { target: "45", need: "44", runs: "1", balls: [{ label: "1" }] },
  {
    target: "45",
    need: "43",
    runs: "2",
    balls: [{ label: "1" }, { label: "1" }],
  },
  {
    target: "45",
    need: "42",
    runs: "3",
    balls: [{ label: "1" }, { label: "1" }, { label: "1" }],
  },
  {
    target: "45",
    need: "38",
    runs: "7",
    balls: [
      { label: "1" },
      { label: "1" },
      { label: "1" },
      { label: "4", tone: "amber" },
    ],
  },
  {
    target: "45",
    need: "37",
    runs: "8",
    balls: [
      { label: "1" },
      { label: "1" },
      { label: "1" },
      { label: "4", tone: "amber" },
      { label: "1" },
    ],
  },
];

export const animatedTeamsFrames = [
  {
    step: 1,
    heading: "Session setup",
    type: "session",
    sessionName: "Friday Night Finals",
    sessionNote: "Give the match a clear name first.",
    note: "Start with the match name.",
    badge: "Setup",
  },
  {
    step: 2,
    heading: "Teams ready",
    type: "teams",
    sessionName: "Friday Night Finals",
    teamA: "Team Blue",
    teamB: "Team Red",
    note: "Add both teams before the toss.",
    badge: "Teams",
  },
  {
    step: 3,
    heading: "Run the toss",
    type: "toss",
    sessionName: "Friday Night Finals",
    caller: "Team Blue calls Heads",
    selectedSide: "Heads",
    result: "Heads lands. Team Blue wins the toss.",
    note: "Now choose whether to bat or bowl first.",
    badge: "Toss",
  },
  {
    step: 4,
    heading: "Start the match",
    type: "decision",
    sessionName: "Friday Night Finals",
    tossWinner: "Team Blue",
    decision: "Bat first",
    support: "Team Red starts with the ball.",
    note: "Toss is done and umpire mode is ready.",
    badge: "Ready",
  },
];

export const animatedLoudspeakerFrames = [
  {
    status: "Armed for hold to talk.",
    footer: "Ready for next call",
    live: false,
  },
  { status: "Score call is live.", footer: "PA mic active", live: true },
  {
    status: "Ground update in progress.",
    footer: "Voice is reaching speakers",
    live: true,
  },
  {
    status: "Mic is back on standby.",
    footer: "Ready for the next call",
    live: false,
  },
];

export const animatedWalkieFeatureFrames = [
  {
    speaker: "Umpire live",
    note: "Director listening",
    badges: ["Umpire", "Director", "Spectators"],
  },
  {
    speaker: "Director live",
    note: "Umpire ready to reply",
    badges: ["Director", "Umpire", "Spectators"],
  },
  {
    speaker: "Spectator request",
    note: "Umpire can answer fast",
    badges: ["Spectators", "Umpire", "Director"],
  },
];

export const animatedAnnouncerFrames = [
  {
    score: "Team B 52 for 3 after 8.2 overs.",
    queue: "Next update is queued.",
  },
  { score: "Team B 56 for 3 after 8.4 overs.", queue: "Boundary call ready." },
  { score: "Target 45. Team B needs 37.", queue: "Chase update queued." },
];

export const animatedShareFrames = [
  {
    url: "gvcricket.live/session/friday-finals",
    activeDevice: "Phone",
    note: "Share opens fast",
  },
  {
    url: "gvcricket.live/session/friday-finals",
    activeDevice: "Tablet",
    note: "Works on larger screens",
  },
  {
    url: "gvcricket.live/session/friday-finals",
    activeDevice: "Big Screen",
    note: "Good for score display",
  },
];

export const animatedCoverFrames = [
  { label: "Live", tone: "rose", note: "Shown on the live match page." },
  { label: "Spectator", tone: "cyan", note: "Carries into the viewer page." },
  {
    label: "Result",
    tone: "amber",
    note: "Still looks right on the final card.",
  },
];

export const animatedInsightsFrames = [
  {
    winner: "Team A won",
    detail: "Won by 7 wickets",
    score: "44/4",
    overs: "4.0",
    rr: "11.00",
  },
  {
    winner: "Team B won",
    detail: "Won by 12 runs",
    score: "61/5",
    overs: "6.0",
    rr: "10.16",
  },
  {
    winner: "Team A won",
    detail: "Won by 2 wickets",
    score: "39/4",
    overs: "5.4",
    rr: "6.88",
  },
];

export const animatedDirectorFrames = [
  {
    activeLabels: ["Walkie", "PA Mic"],
    meters: { mic: "84%", music: "62%", fx: "71%" },
  },
  {
    activeLabels: ["Announcer", "Effects"],
    meters: { mic: "68%", music: "54%", fx: "82%" },
  },
  {
    activeLabels: ["YouTube", "Crowd"],
    meters: { mic: "39%", music: "78%", fx: "66%" },
  },
];

export const animatedLiveBannerFrames = [
  { teams: "TEAM A vs TEAM B", score: "1/0 - View score now" },
  { teams: "TEAM BLUE vs TEAM RED", score: "23/0 - Live in over 3" },
  { teams: "RED ROCKETS vs BLUE BLAZERS", score: "Final over live now" },
];

export const animatedJourneyWalkieFrames = [
  {
    title: "Walkie live",
    note: "Umpire speaking now.",
    counts: [
      ["Umpire", "live"],
      ["Director", "ready"],
      ["Spectators", "2 joined"],
    ],
  },
  {
    title: "Director reply",
    note: "Director speaking back.",
    counts: [
      ["Umpire", "ready"],
      ["Director", "live"],
      ["Spectators", "2 joined"],
    ],
  },
  {
    title: "Walkie live",
    note: "Spectators can still listen.",
    counts: [
      ["Umpire", "ready"],
      ["Director", "ready"],
      ["Spectators", "3 joined"],
    ],
  },
];

export const animatedJourneyAudioFrames = [
  { call: "Team A 52 for 3 after 8.2 overs.", sub: "Score call queued." },
  {
    call: "Four runs. Team A moves to 56 for 3.",
    sub: "Boundary update ready.",
  },
  { call: "Target 45. Team B needs 37.", sub: "Chase update ready." },
];

export const animatedAccessFrames = [
  { pin: "• - - -", status: "Start secure entry" },
  { pin: "• • - -", status: "PIN checking" },
  { pin: "• • • •", status: "Access granted" },
];
