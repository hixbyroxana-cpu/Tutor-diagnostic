export interface EditorRequestContext {
  testId?: string;
  uid?: string;
  generation: number;
}

export function isEditorRequestContextCurrent(
  expected: EditorRequestContext,
  current: EditorRequestContext,
): boolean {
  return expected.testId === current.testId
    && expected.uid === current.uid
    && expected.generation === current.generation;
}
