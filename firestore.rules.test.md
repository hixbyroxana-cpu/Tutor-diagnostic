# Firestore Rules Emulator Verification Cases

These cases define the emulator verification matrix. They do not claim that
Firestore Emulator tests have run.

Use two authenticated users, `tutor-a` and `tutor-b`, plus an unauthenticated
client. Seed fixtures through the Admin SDK so setup bypasses client rules.

| Collection and operation | Auth/data setup | Expected |
| --- | --- | --- |
| `tests`: get/list | `tutor-a`, existing `ownerId: "tutor-a"` | Allow |
| `tests`: create | `tutor-a`, incoming `ownerId: "tutor-a"` | Allow |
| `tests`: update | `tutor-a`, existing and incoming `ownerId: "tutor-a"` | Allow |
| `tests`: delete | `tutor-a`, existing `ownerId: "tutor-a"` | Allow |
| `tests`: get/update/delete | `tutor-b`, existing `ownerId: "tutor-a"` | Deny |
| `tests`: create | `tutor-b`, incoming `ownerId: "tutor-a"` | Deny |
| `tests`: update owner transfer | `tutor-a`, existing `ownerId: "tutor-a"`, incoming `ownerId: "tutor-b"` | Deny |
| `tests`: any operation | Unauthenticated | Deny |
| `testResults`: get/list | `tutor-a`, existing `ownerId: "tutor-a"` | Allow |
| `testResults`: update | `tutor-a`, existing and incoming `ownerId: "tutor-a"` | Allow |
| `testResults`: get/update | `tutor-b`, existing `ownerId: "tutor-a"` | Deny |
| `testResults`: update owner transfer | `tutor-a`, existing `ownerId: "tutor-a"`, incoming `ownerId: "tutor-b"` | Deny |
| `testResults`: create/delete | Any browser client, including the owner | Deny |
| `testResults`: any operation | Unauthenticated | Deny |
| `tutors/tutor-a`: get | `tutor-a` | Allow |
| `tutors/tutor-a`: get | `tutor-b` or unauthenticated | Deny |
| `tutors/tutor-a`: create/update/delete | Any browser client, including `tutor-a` | Deny |
| `testTemplates`: get/list/create/update/delete | Any browser client, authenticated or not | Deny |
| Any unmatched document path: read/write | Any browser client, authenticated or not | Deny |

Public test loading, result submission, tutor profile provisioning, and template
access must use server endpoints backed by Firebase Admin APIs, which bypass
Firestore Security Rules.
