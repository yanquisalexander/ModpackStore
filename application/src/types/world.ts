export interface World {
  name: string;
  path: string;
  icon_path: string | null;
  last_modified: number;
  size_bytes: number;
  level_name: string | null;
  game_type: number | null;
  difficulty: number | null;
  hardcore: boolean | null;
  allow_commands: boolean | null;
  version: string | null;
}

export interface WorldEditData {
  game_type: number;
  difficulty: number;
  allow_commands: boolean;
  hardcore: boolean;
}

export interface ImportConflict {
  conflict_type: "name_exists" | "version_mismatch";
  message: string;
  world_name: string;
  existing_version?: string;
  import_version?: string;
}

export enum GameType {
  Survival = 0,
  Creative = 1,
  Adventure = 2,
  Spectator = 3,
}

export enum Difficulty {
  Peaceful = 0,
  Easy = 1,
  Normal = 2,
  Hard = 3,
}

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  [GameType.Survival]: "Supervivencia",
  [GameType.Creative]: "Creativo",
  [GameType.Adventure]: "Aventura",
  [GameType.Spectator]: "Espectador",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.Peaceful]: "Pacífico",
  [Difficulty.Easy]: "Fácil",
  [Difficulty.Normal]: "Normal",
  [Difficulty.Hard]: "Difícil",
};
