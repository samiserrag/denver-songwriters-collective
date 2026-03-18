# Investigation: Publish State Desync + Silent Failure Risk

Date: 2026-03-18  
Scope: Event host edit/publish flow (`/dashboard/my-events/[id]`) and public happenings visibility

## Summary

A host-facing publish action showed success UI ("Happening Created & Published!") while the event could still remain `Draft` in persisted state.

In addition, the edit form could submit a stale `is_published` value during later saves, unintentionally reverting a live event back to draft.

Impact: hosts can believe an event is live while it is hidden from `/happenings`, creating silent operational failure.

## Reproduction Pattern Observed

1. Create event and reach edit page with success banner.
2. Trigger publish action and observe success message.
3. Event detail page still shows `Draft Preview` or edit page still shows `Draft`.
4. `/happenings` does not include the event.

## Root Cause

Two coupled issues:

1. Publish control did not enforce a strict persisted-state confirmation path for host-visible success feedback.
2. Edit form submitted `is_published` as part of general PATCH payload; local form state could be stale after publish/unpublish actions and overwrite server truth on next save.

## Fix Implemented

### 1) Publish control now validates persisted state and surfaces failures

File: `web/src/app/(protected)/dashboard/my-events/[id]/_components/PublishButton.tsx`

- Added explicit error/success messaging near the button.
- On PATCH success, verifies response `is_published` matches requested target.
- If mismatch: shows failure message, refreshes page, and does not report success.

### 2) Edit form no longer mutates publish state in edit mode

File: `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx`

- Edit-mode submit payload omits `is_published`.
- `is_published` is only sent during create mode.
- Added sync effect so local form state tracks server `event.is_published` after refresh.

## Verification

- Event can be published and appears in `/happenings`.
- Event detail page no longer shows `Draft Preview` after successful publish.
- Save changes on edit page no longer flips published events back to draft.

## Regression Guard

Added contract test:

- `web/src/__tests__/publish-state-persistence-guard.test.ts`

Asserts:

- Edit form syncs local publish state from server prop.
- Edit form does not submit `is_published` in edit mode.
- Publish button has persisted-state mismatch guard and explicit failure messaging.

