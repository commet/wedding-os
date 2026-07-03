# Wedding OS UX Flow

## Goal

Dearie should feel like a wedding preparation OS, not a chat transcript or a menu of features.

The user needs two things at the same time:

1. See the whole preparation state quickly enough to feel oriented.
2. Know the next concrete thought or decision without feeling pushed through a complex system.

The UI must therefore show the user's thinking flow, not just saved data.

## Core Model

Use visible step tracks instead of abstract status labels or unexplained percentages.

Home uses the shared preparation flow:

```
기준 -> 후보 -> 질문 -> 비교 -> 결정 -> 확정
```

Venues uses the venue-specific flow:

```
기준 -> 후보 -> 질문 -> 상담 -> 비교 -> 계약
```

The track is visual: small cells fill from left to right. The user does not need to read a number to understand where they are.

## Home

Home is not the app launcher. Home is the couple's preparation map.

The first screen should contain:

1. A compact whole-state map grouped by user mental area:
   - 큰 예약
   - 돈
   - 초대
   - 본식
2. One current decision.
3. The facts already known.
4. The questions that still need to be answered.
5. A direct action.

The app launcher stays secondary and collapsed.

Good home copy is not "진행 중" or "확인 필요." It should say what the user is doing mentally:

- 기준 잡는 중
- 후보 모으는 중
- 물어볼 것 남음
- 비교 중
- 결정할 차례
- 확정됨
- 순서 기다림

## Venues

The venue page should convert venue candidates into a decision.

It should not start as a catalogue. Catalogue is a source. The page itself is a decision workspace.

The first screen should show:

1. Venue-specific step track.
2. Current venue task in plain language.
3. Existing candidates and known facts.
4. Open questions before calling or touring.
5. Candidate cards that always show:
   - 맞는 점
   - 물어볼 점
   - 판단

Candidate cards should expose the decision material without requiring expansion.

## Acceptance Criteria

The design is acceptable only if a non-developer user can do these in under five seconds:

1. Say what overall preparation area needs attention.
2. Say what the current next decision is.
3. See where that decision sits in the flow.
4. Find the facts already known.
5. Find what to ask or fill next.

Avoid:

- Percent-first progress.
- Status labels that sound like internal project management.
- Large app menus above the user's current thought.
- Candidate lists that hide why a candidate is useful.
- Chat-like text without structure.
