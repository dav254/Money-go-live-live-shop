/** Shared UI-level types for the editor components (kept out of lib/ so the
 *  pure logic modules never import React). */

export type ToolId =
  | 'edit'
  | 'audio'
  | 'text'
  | 'effects'
  | 'overlay'
  | 'captions'
  | 'filters';

export type SelectionKind = 'clip' | 'audio' | 'text' | 'overlay' | 'caption';

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export const TOOL_LABELS: Record<ToolId, string> = {
  edit: 'Edit',
  audio: 'Audio',
  text: 'Text',
  effects: 'Effects',
  overlay: 'Overlay',
  captions: 'Captions',
  filters: 'Filters',
};
