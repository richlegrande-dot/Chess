/**
 * Chess Coaching Themes - Comprehensive taxonomy of chess improvement areas
 * 
 * This module defines the core ontology for chess coaching advice, providing
 * structured categories and themes that can be detected through game analysis
 * and used to generate targeted educational content.
 */

export type CoachThemeCategory =
  | "opening"
  | "tactics"
  | "strategy"
  | "endgame"
  | "time_management"
  | "psychology";

export interface CoachTheme {
  id: string;          // Unique identifier for the theme
  category: CoachThemeCategory;
  shortName: string;   // Display name for UI
  description: string; // Human-readable explanation
  detectionNotes: string; // Technical notes for automated detection
  adviceTemplate: string; // Template for generating advice
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'all'; // Target skill level
}

/**
 * Comprehensive collection of chess coaching themes organized by category
 */
export const COACH_THEMES: CoachTheme[] = [
  // ====================================
  // OPENING THEMES
  // ====================================
  {
    id: "opening_delayed_castling",
    category: "opening",
    shortName: "Delayed Castling",
    description: "King remained in center too long while position became tactical",
    detectionNotes: "King not castled by move 12-15 with open center files or attacking pieces aimed at center",
    adviceTemplate: "Castle earlier for king safety. On move {moveNumber}, {playedMove} kept your king exposed. Consider {bestMove} to complete development safely.",
    skillLevel: "beginner"
  },
  {
    id: "opening_too_many_pawn_moves",
    category: "opening",
    shortName: "Excessive Pawn Play",
    description: "Too many pawn moves in opening instead of piece development",
    detectionNotes: "More than 3-4 pawn moves in first 10 moves without corresponding piece development",
    adviceTemplate: "Focus on piece development over pawn advances. Each opening move should improve your position - pieces before pawns!",
    skillLevel: "beginner"
  },
  {
    id: "opening_same_piece_twice",
    category: "opening",
    shortName: "Repeated Piece Moves",
    description: "Moved the same piece multiple times without clear purpose",
    detectionNotes: "Same piece moved 2+ times in first 12 moves without tactical justification",
    adviceTemplate: "Avoid moving the same piece twice in the opening unless absolutely necessary. Develop all pieces before improving one.",
    skillLevel: "beginner"
  },
  {
    id: "opening_neglected_center",
    category: "opening",
    shortName: "Poor Center Control",
    description: "Failed to establish or contest central control early",
    detectionNotes: "No central pawn moves (e4/d4/e5/d5) in first 8 moves, opponent dominates center",
    adviceTemplate: "Control the center early with pawns and pieces. Central control gives your pieces more scope and limits opponent options.",
    skillLevel: "all"
  },
  {
    id: "opening_premature_queen",
    category: "opening",
    shortName: "Early Queen Development",
    description: "Brought queen out too early, making it a target",
    detectionNotes: "Queen developed before move 8 and subsequently attacked or has to retreat",
    adviceTemplate: "Avoid early queen development - it becomes a target. Develop minor pieces first, then castle and centralize.",
    skillLevel: "beginner"
  },
  {
    id: "opening_tactical_trap",
    category: "opening",
    shortName: "Opening Trap",
    description: "Fell into a well-known opening trap or tactical sequence",
    detectionNotes: "Large material loss or positional disaster in first 15 moves matching known trap patterns",
    adviceTemplate: "This was a known opening trap. Study your openings deeper to avoid such pitfalls in the future.",
    skillLevel: "intermediate"
  },
  {
    id: "opening_poor_choice",
    category: "opening",
    shortName: "Inappropriate Opening",
    description: "Chose overly complex opening for skill level",
    detectionNotes: "Highly theoretical opening played incorrectly by lower-rated player",
    adviceTemplate: "Consider simpler, more principled openings. Master fundamental development before tackling complex theory.",
    skillLevel: "beginner"
  },

  // ====================================
  // TACTICS THEMES
  // ====================================
  {
    id: "tactics_hung_piece",
    category: "tactics",
    shortName: "Undefended Piece",
    description: "Left a piece undefended and it was captured for free",
    detectionNotes: "Material loss ≥ 3 points with no compensation, piece became undefended after move",
    adviceTemplate: "Always check if your pieces are defended after each move. On move {moveNumber}, {playedMove} left your piece unprotected.",
    skillLevel: "beginner"
  },
  {
    id: "tactics_missed_capture",
    category: "tactics",
    shortName: "Missed Free Material",
    description: "Failed to capture an undefended or poorly defended piece",
    detectionNotes: "Free material ≥ 3 points available but not taken, no obvious downsides to capture",
    adviceTemplate: "Look for free material before making your move. You could have won material with {bestMove} instead of {playedMove}.",
    skillLevel: "beginner"
  },
  {
    id: "tactics_missed_fork",
    category: "tactics",
    shortName: "Missed Fork",
    description: "Failed to execute or defend against a fork (double attack)",
    detectionNotes: "Position allows fork attacking 2+ valuable pieces simultaneously",
    adviceTemplate: "Watch for fork opportunities - attacking two pieces at once. Look for knight forks and pawn forks especially.",
    skillLevel: "intermediate"
  },
  {
    id: "tactics_missed_pin",
    category: "tactics",
    shortName: "Missed Pin/Skewer",
    description: "Overlooked pin or skewer opportunity",
    detectionNotes: "Pin or skewer pattern available attacking valuable piece through less valuable one",
    adviceTemplate: "Pins and skewers are powerful tactics. Look for opportunities to attack through enemy pieces.",
    skillLevel: "intermediate"
  },
  {
    id: "tactics_mate_threat",
    category: "tactics",
    shortName: "Ignored Mate Threat",
    description: "Failed to address immediate checkmate threat",
    detectionNotes: "Mate in 1-3 available to opponent but not addressed in move selection",
    adviceTemplate: "Always check for mate threats first! Safety before material - defend against checkmate before pursuing other goals.",
    skillLevel: "all"
  },
  {
    id: "tactics_overloaded_piece",
    category: "tactics",
    shortName: "Overloaded Defender",
    description: "Failed to exploit or protect against overloaded pieces",
    detectionNotes: "Key defending piece has multiple duties and can be overwhelmed",
    adviceTemplate: "Identify overloaded pieces - defenders doing too many jobs. Attack what they can't all protect.",
    skillLevel: "intermediate"
  },
  {
    id: "tactics_back_rank",
    category: "tactics",
    shortName: "Back Rank Weakness",
    description: "Vulnerable to or missed back rank mate patterns",
    detectionNotes: "King trapped on back rank with no escape squares, rook/queen can deliver mate",
    adviceTemplate: "Create luft (escape squares) for your king to avoid back rank mates. Always ensure king has escape routes.",
    skillLevel: "intermediate"
  },
  {
    id: "tactics_discovered_attack",
    category: "tactics",
    shortName: "Discovered Attack",
    description: "Missed or fell victim to discovered attack",
    detectionNotes: "Moving one piece reveals attack from piece behind it, often with devastating effect",
    adviceTemplate: "Watch for discovered attacks - moving one piece can unleash another. These are often game-changing tactics.",
    skillLevel: "advanced"
  },

  // ====================================
  // STRATEGY THEMES
  // ====================================
  {
    id: "strategy_weak_pawns",
    category: "strategy",
    shortName: "Weak Pawn Structure",
    description: "Created isolated, doubled, or backward pawns unnecessarily",
    detectionNotes: "Pawn structure deteriorated significantly, creating long-term weaknesses",
    adviceTemplate: "Pawn structure is permanent - avoid creating weak pawns unless gaining significant compensation.",
    skillLevel: "intermediate"
  },
  {
    id: "strategy_bad_trade",
    category: "strategy",
    shortName: "Poor Piece Exchange",
    description: "Traded good pieces for bad ones or improved opponent's position",
    detectionNotes: "Exchange that improves opponent's piece coordination or pawn structure",
    adviceTemplate: "Consider what the exchange accomplishes. Don't trade your active pieces for opponent's passive ones.",
    skillLevel: "intermediate"
  },
  {
    id: "strategy_ignored_plan",
    category: "strategy",
    shortName: "Ignored Opponent's Plan",
    description: "Failed to address or counter opponent's strategic plan",
    detectionNotes: "Opponent executes clear plan (attack, breakthrough, etc.) without resistance",
    adviceTemplate: "Always ask: 'What is my opponent trying to do?' Counter their plans while pursuing your own.",
    skillLevel: "all"
  },
  {
    id: "strategy_passive_pieces",
    category: "strategy",
    shortName: "Passive Pieces",
    description: "Pieces remained on poor squares without clear purpose",
    detectionNotes: "Multiple pieces on back ranks or edge squares with limited scope",
    adviceTemplate: "Activate your pieces! Every piece should have a clear role. Improve your worst-placed piece first.",
    skillLevel: "intermediate"
  },
  {
    id: "strategy_wrong_plan",
    category: "strategy",
    shortName: "Inappropriate Plan",
    description: "Pursued plan unsuited to position type or pawn structure",
    detectionNotes: "Strategic approach contradicts positional requirements (e.g., attacking with weak king)",
    adviceTemplate: "Match your plan to the position. Don't force strategies that don't fit the pawn structure.",
    skillLevel: "advanced"
  },
  {
    id: "strategy_space_advantage",
    category: "strategy",
    shortName: "Space Management",
    description: "Failed to use or obtain space advantage effectively",
    detectionNotes: "Significant space imbalance not properly utilized or defended",
    adviceTemplate: "Space advantages should be used to restrict opponent pieces and create weaknesses. Don't let space go to waste.",
    skillLevel: "advanced"
  },

  // ====================================
  // ENDGAME THEMES
  // ====================================
  {
    id: "endgame_passive_king",
    category: "endgame",
    shortName: "Passive King",
    description: "King remained passive when it should be active",
    detectionNotes: "Endgame with king far from center or action while opponent's king is active",
    adviceTemplate: "In the endgame, the king is a fighting piece! Centralize and activate your king aggressively.",
    skillLevel: "all"
  },
  {
    id: "endgame_pawn_rush",
    category: "endgame",
    shortName: "Premature Pawn Push",
    description: "Pushed pawns too aggressively without proper support",
    detectionNotes: "Pawn advances that create weaknesses or fail due to lack of support",
    adviceTemplate: "Support your pawn advances properly. Don't rush pawns forward without adequate piece support.",
    skillLevel: "intermediate"
  },
  {
    id: "endgame_rook_placement",
    category: "endgame",
    shortName: "Poor Rook Activity",
    description: "Misplaced rooks in endgame (not behind passed pawns, passive)",
    detectionNotes: "Rooks on poor squares in endgame, not following principle of activity",
    adviceTemplate: "Rooks belong behind passed pawns and on active files. Activate your rooks before advancing pawns.",
    skillLevel: "intermediate"
  },
  {
    id: "endgame_bad_exchange",
    category: "endgame",
    shortName: "Simplified to Lost Ending",
    description: "Exchanged into a theoretically lost endgame",
    detectionNotes: "Series of exchanges leading to known losing endgame (e.g., wrong color bishop)",
    adviceTemplate: "Know basic endgame theory before simplifying. Some endgames are drawn despite material equality.",
    skillLevel: "advanced"
  },
  {
    id: "endgame_passed_pawn",
    category: "endgame",
    shortName: "Passed Pawn Creation",
    description: "Failed to create or advance passed pawns effectively",
    detectionNotes: "Missed opportunities to create passed pawns or support existing ones",
    adviceTemplate: "Passed pawns are the soul of chess in the endgame. Create and support them whenever possible.",
    skillLevel: "intermediate"
  },

  // ====================================
  // TIME MANAGEMENT THEMES
  // ====================================
  {
    id: "time_critical_position",
    category: "time_management",
    shortName: "Rushed Critical Decision",
    description: "Moved too quickly in a critical position",
    detectionNotes: "Large evaluation swing in position that warranted more calculation time",
    adviceTemplate: "Spend more time on critical positions. When the position is sharp or material is at stake, calculate carefully.",
    skillLevel: "all"
  },
  {
    id: "time_trouble_blunder",
    category: "time_management",
    shortName: "Time Pressure Blunder",
    description: "Made obvious mistake due to time pressure",
    detectionNotes: "Clear blunder in time trouble with simple alternative available",
    adviceTemplate: "Manage your time better to avoid time pressure. Simple, safe moves are better than blunders in zeitnot.",
    skillLevel: "all"
  },
  {
    id: "time_overthinking",
    category: "time_management",
    shortName: "Overthinking Simple Positions",
    description: "Spent too much time on straightforward positions",
    detectionNotes: "Excessive time used on positions with limited candidate moves",
    adviceTemplate: "Reserve thinking time for complex positions. Play obvious moves quickly to save time for critical moments.",
    skillLevel: "intermediate"
  },

  // ====================================
  // PSYCHOLOGY THEMES
  // ====================================
  {
    id: "psychology_winning_jitters",
    category: "psychology",
    shortName: "Winning Position Nerves",
    description: "Played for tricks in winning position and blundered",
    detectionNotes: "Large advantage converted to disadvantage through risky play",
    adviceTemplate: "When winning, play simply and safely. Don't give opponent unnecessary chances with risky moves.",
    skillLevel: "all"
  },
  {
    id: "psychology_premature_resignation",
    category: "psychology",
    shortName: "Gave Up Too Early",
    description: "Resigned in position that was still drawable or salvageable",
    detectionNotes: "Resignation in position with defensive resources or practical chances",
    adviceTemplate: "Fight until the end! Many games are saved from seemingly hopeless positions. Look for defensive resources.",
    skillLevel: "all"
  },
  {
    id: "psychology_emotional_play",
    category: "psychology",
    shortName: "Emotional Decision Making",
    description: "Made moves based on emotion rather than objective analysis",
    detectionNotes: "Series of questionable moves after opponent's strong play or threat",
    adviceTemplate: "Stay objective and calm. Don't let opponent's threats or your emotions cloud your judgment.",
    skillLevel: "all"
  },
  {
    id: "psychology_overconfidence",
    category: "psychology",
    shortName: "Overconfident Play",
    description: "Played carelessly with material or positional advantage",
    detectionNotes: "Advantage frittered away through casual, insufficiently careful moves",
    adviceTemplate: "Stay focused even when ahead. Maintain concentration and convert advantages systematically.",
    skillLevel: "intermediate"
  }
];

/**
 * Get themes by category for filtering and organization
 */
export function getThemesByCategory(category: CoachThemeCategory): CoachTheme[] {
  return COACH_THEMES.filter(theme => theme.category === category);
}

/**
 * Get theme by ID for lookups
 */
export function getThemeById(id: string): CoachTheme | undefined {
  return COACH_THEMES.find(theme => theme.id === id);
}

/**
 * Get themes appropriate for skill level
 */
export function getThemesForSkillLevel(skillLevel: 'beginner' | 'intermediate' | 'advanced'): CoachTheme[] {
  return COACH_THEMES.filter(theme => 
    theme.skillLevel === skillLevel || theme.skillLevel === 'all'
  );
}

/**
 * Theme priority for ensuring diverse takeaways
 */
export const THEME_PRIORITIES: Record<CoachThemeCategory, number> = {
  tactics: 10,        // Highest priority - most immediately actionable
  opening: 8,         // High priority for education
  strategy: 6,        // Medium-high for improvement
  endgame: 5,         // Medium for completeness
  time_management: 3, // Lower priority unless severe
  psychology: 2       // Lowest priority - harder to act on
};

/**
 * Export types for external use
 */
export type { CoachTheme, CoachThemeCategory };