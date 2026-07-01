# Test Deletion Design

## Goal

Allow a signed-in tutor to permanently delete a test they own without deleting any completed student results.

## User Experience

The Tests page adds a trash icon beside the existing copy-link and edit actions. Selecting it opens a confirmation dialog that names the test and explains that:

- the test and its public student link will stop working;
- completed results and reports will remain available;
- the deletion cannot be undone.

The tutor can cancel without making changes. While deletion is running, the confirmation action is disabled to prevent duplicate requests. After a successful deletion, the dialog closes and the test disappears from the list. A failed deletion leaves the test in place and displays a clear error.

## Data And Security

Deletion removes only the selected document from the Firestore `tests` collection. Documents in `testResults` are not changed.

The browser requests deletion using the selected Firestore test document ID. Existing Firestore rules permit deletion only when the authenticated user's UID matches the test's `ownerId`. Tests owned by another tutor cannot be deleted, even if a client attempts to bypass the interface.

Legacy ownerless tests must be assigned to Roxana's authenticated account through the existing ownership migration before they can be deleted securely.

## Components

- `TestsList` owns confirmation, pending, success, and error state.
- A small deletion helper performs the Firestore operation and makes state transitions independently testable.
- The existing Firebase export module exposes `deleteDoc`.
- Existing Firestore rule tests continue to verify same-owner deletion and are extended if needed to cover cross-owner deletion explicitly.

## Verification

Automated tests will cover:

- the deletion helper calls Firestore for the selected test;
- a successful deletion removes only that test from local state;
- a failed deletion keeps the test and exposes an error;
- Firestore permits owner deletion and rejects cross-owner deletion.

Browser verification will confirm the confirmation dialog, cancel behavior, successful deletion, preserved Results visibility, and the deleted public link returning unavailable.
