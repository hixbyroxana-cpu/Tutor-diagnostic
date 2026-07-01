import { describe, expect, it, vi } from 'vitest';
import { deleteTestDocument, removeTestById } from './test-deletion';

describe('deleteTestDocument', () => {
  it('deletes the selected test document', async () => {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);

    await deleteTestDocument('test-2', deleteDocument);

    expect(deleteDocument).toHaveBeenCalledWith('test-2');
  });

  it('rejects an empty test document ID without calling Firestore', async () => {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);

    await expect(deleteTestDocument('', deleteDocument)).rejects.toThrow(
      'A test document ID is required.',
    );
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('propagates deletion failures', async () => {
    const deleteDocument = vi.fn().mockRejectedValue(new Error('permission-denied'));

    await expect(deleteTestDocument('test-2', deleteDocument)).rejects.toThrow(
      'permission-denied',
    );
  });
});

describe('removeTestById', () => {
  it('removes only the deleted test', () => {
    const tests = [
      { id: 'test-1', title: 'First' },
      { id: 'test-2', title: 'Second' },
    ];

    expect(removeTestById(tests, 'test-2')).toEqual([
      { id: 'test-1', title: 'First' },
    ]);
  });
});
