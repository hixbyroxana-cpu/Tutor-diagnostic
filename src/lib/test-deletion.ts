export async function deleteTestDocument(
  testId: string,
  deleteDocument: (testId: string) => Promise<void>,
) {
  if (!testId.trim()) {
    throw new Error('A test document ID is required.');
  }

  await deleteDocument(testId);
}

export function removeTestById<T extends { id?: string }>(
  tests: T[],
  deletedTestId: string,
) {
  return tests.filter(test => test.id !== deletedTestId);
}
