import {
  FaBalanceScale,
  FaGamepad,
  FaGavel,
  FaHandshake,
  FaMapMarkerAlt,
  FaMobileAlt,
} from "react-icons/fa";

export const ruleSections = [
  {
    icon: FaGamepad,
    title: "Core Gameplay",
    headingColor: "text-green-400",
    items: [
      "Max 3 overs per batsman.",
      "Max 2 overs per bowler.",
      "To score a run, the ball must touch the grass (no runs for aerial flicks).",
      "An umpire and wicket-keeper must be present at all times.",
    ],
  },
  {
    icon: FaBalanceScale,
    title: "Fair Play & Team Selection",
    headingColor: "text-teal-400",
    items: [
      "All players must bat for a minimum of 1 over.",
      "All players must bowl for a minimum of 1 over.",
      "To prevent disputes, teams must try to be randomized for every match.",
      "The toss winning captain chooses to bat or bowl. The opposing captain gets the first pick when selecting teams.",
      "For fair rotation, the player who bats first will bowl last. The player who bowls first will bat last.",
    ],
  },
  {
    icon: FaHandshake,
    title: "Spirit of the Game",
    headingColor: "text-yellow-400",
    items: [
      "Prioritize fun and sportsmanship. This is a friendly game.",
      "No cursing or insulting other players is allowed. Respect is mandatory.",
      "Encourage and support new or inexperienced players.",
      "Rotate umpire and wicket keeper duties fairly among all players.",
    ],
  },
  {
    icon: FaGavel,
    title: "Umpiring & Dismissals",
    headingColor: "text-red-400",
    items: [
      "The umpire's decision is final and must be called loudly.",
      "There are no LBWs (Leg Before Wicket).",
      "There are no back runs or runs inside the pitch area.",
      "A full toss delivery above the waist is a no ball, resulting in a free hit on the next ball.",
    ],
  },
  {
    icon: FaMapMarkerAlt,
    title: "Field-Specific Rules",
    headingColor: "text-sky-400",
    items: [
      "At Bethel Ground: A ball hitting the fence is awarded 2 runs only.",
      "At GV Ground: Normal boundary rules (4s and 6s) apply.",
    ],
  },
];

export const appGuideSections = [
  {
    title: "Access & Setup",
    items: [
      "New Session: Create new matches with custom names, dates, overs, and teams.",
      "All Sessions: Browse and resume past or live matches.",
      "Umpire Mode: PIN-protected server scoring interface for live matches.",
      "View Mode: A public, read-only link for live score spectating.",
    ],
  },
  {
    title: "Live Scoring & Management",
    items: [
      "Scoring (0-6): Instantly add runs and log a legal delivery.",
      "OUT: Records a wicket and counts as a legal ball. A prompt handles any runs scored on the dismissal.",
      "Extras (Wide/No Ball): Adds runs without consuming a legal ball from the over.",
      "Undo: Instantly reverses the last scoring action for one-click corrections.",
      "Edit Overs: Adjust total match overs mid-game. Logic prevents setting overs below the current progress.",
      "Edit Teams: Modify team rosters on-the-fly. The all out wicket count updates automatically.",
      "History & Rules: Review a ball-by-ball history or view a summary of tournament rules at any time.",
    ],
  },
  {
    title: "Automatic Game Logic",
    items: [
      "Over Completion: An over automatically ends after 6 legal balls are delivered. Extras do not count towards this total.",
      "Innings End: An innings concludes when the overs are finished or the team is all out. A modal then prompts for the next action.",
      "Match End: The match automatically finishes when the second innings ends or the target is successfully chased, with the final result displayed.",
    ],
  },
];

export const appGuideIcon = FaMobileAlt;
