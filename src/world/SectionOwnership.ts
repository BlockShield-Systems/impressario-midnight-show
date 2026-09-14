import {
  WORLD_SECTIONS,
  type WorldSection
} from "./WorldLayout";

export function getWorldSectionIndex(
  playerX: number
): number {
  if (!Number.isFinite(playerX)) {
    return -1;
  }

  return WORLD_SECTIONS.findIndex(
    section =>
      playerX >= section.startX &&
      playerX < section.endX
  );
}

export function getWorldSection(
  playerX: number
): WorldSection | null {
  const index = getWorldSectionIndex(playerX);
  return index < 0
    ? null
    : WORLD_SECTIONS[index] ?? null;
}

export function getWorldSectionById(
  id: string
): WorldSection | null {
  return WORLD_SECTIONS.find(
    section => section.id === id
  ) ?? null;
}
