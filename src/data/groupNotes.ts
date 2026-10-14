/** One note per named group (content/groups.json), shown on the group card. */
import notesFile from "../../content/groups.json";
import type { L10n } from "./types";

const notes = (notesFile as { notes: Record<string, { text: L10n }> }).notes;

export function groupNote(id: string): L10n | null {
  return notes[id]?.text ?? null;
}
