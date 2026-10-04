# Implementation Plan: Task 15.2 - Post-Consultation Rating & Review Pipeline

## Prerequisites
- Working knowledge of `Consultation` and `VetProfile` models in `apps/api/prisma/schema.prisma`.
- Understanding of `ConsultationsModule` in `apps/api/src/modules/consultations/`.
- Shared types package `@vetralink/shared-types`.

---

## Implementation Steps (Atomic Checklist)

- [x] **Step 1: Database Schema & Shared Types**
  - In `schema.prisma`:
    - Define enum `ReviewModerationStatus` (`PENDING`, `APPROVED`, `FLAGGED`, `REJECTED`).
    - Define model `ConsultationReview` with `id`, `consultationId`, `farmerId`, `vetId`, `rating`, `feedback`, `tags`, `isPublic`, `moderationStatus`, `moderatedById`, `moderatedAt`, `moderationReason`, `createdAt`, `updatedAt`.
    - In `VetProfile`, add `averageRating Decimal @default(0) @map("average_rating") @db.Decimal(3, 2)` and `totalReviews Int @default(0) @map("total_reviews")`.
    - In `User`, add relations `authoredReviews`, `receivedReviews`, `moderatedReviews`.
    - In `Consultation`, add relation `review`.
    - Run `prisma generate` (`pnpm --filter @vetralink/api db:generate`).
  - In `packages/shared-types`:
    - Add `ReviewModerationStatus` and `ReviewRatingTag` enums in `src/enums/index.ts`.
    - Create `src/dto/consultations/consultation-review.dto.ts` with:
      - `SubmitConsultationReviewDto`
      - `ConsultationReviewDto`
      - `VetRatingSummaryDto`
      - `ModerateReviewDto`
      - `ReviewQueryDto`
    - Re-export in `src/dto/consultations/index.ts` and `src/index.ts`.
    - Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

- [x] **Step 2: Domain Entity & Repository**
  - Create `ConsultationReviewEntity` in `apps/api/src/modules/consultations/entities/consultation-review.entity.ts`.
  - Create repository interface `IConsultationReviewRepository` in `apps/api/src/modules/consultations/repositories/consultation-review.repository.interface.ts`.
  - Implement `ConsultationReviewRepository` in `apps/api/src/modules/consultations/repositories/consultation-review.repository.ts`.

- [x] **Step 3: Review Domain Service**
  - Create service interface `IConsultationReviewService` in `apps/api/src/modules/consultations/services/consultation-review.service.interface.ts`.
  - Implement `ConsultationReviewService` in `apps/api/src/modules/consultations/services/consultation-review.service.ts`:
    - `submitReview(consultationId, author, dto, traceId?)`
    - `getConsultationReview(consultationId, requestingUser)`
    - `getVetReviews(vetId, query?)`
    - `getVetRatingSummary(vetId)`
    - `moderateReview(reviewId, dto, actorUser, traceId?)`
    - `updateVetProfileAggregates(vetId)`

- [x] **Step 4: Controller & API Endpoints**
  - Create `ConsultationReviewController` in `apps/api/src/modules/consultations/controllers/consultation-review.controller.ts`:
    - `POST /consultations/:id/review`: Submit review (Farmer only).
    - `GET /consultations/:id/review`: Get review for a consultation.
    - `GET /consultations/reviews/vet/:vetId`: Get public/approved reviews and summary for a veterinarian.
    - `GET /consultations/reviews/moderation`: Admin queue for flagged/pending reviews.
    - `POST /consultations/reviews/:id/moderate`: Admin approve/flag/reject review.
  - Register repository, service, and controller in `ConsultationsModule`.

- [x] **Step 5: Unit & Integration Tests**
  - Create `consultation-review.service.spec.ts` testing:
    - Successful review submission for COMPLETED consultation.
    - Rejection if consultation is not in COMPLETED status.
    - Rejection if non-client farmer or another user tries to submit review.
    - Rejection if duplicate review is submitted.
    - Rating boundary validation (1 to 5).
    - Vet profile aggregate update (`averageRating` and `totalReviews`).
    - Moderation transitions (`APPROVED`, `FLAGGED`, `REJECTED`) and audit logging.
  - Create `consultation-review.controller.spec.ts` testing endpoint permissions and responses.
  - Run tests: `pnpm --filter @vetralink/api test review`.
  - Run API build: `pnpm --filter @vetralink/api build`.

- [x] **Step 6: Documentation & Roadmap Sign-off**
  - Check off items in `plan.md`.
  - Update `ROADMAP.md` marking Task 15.2 complete.
  - Present summary, test results, and suggested commit message at human-in-the-loop gate.

---

## Verification & Acceptance Criteria
- A farmer can submit a 1-5 star review with feedback and tags for a completed consultation.
- Reviews submitted for incomplete consultations are rejected with `ValidationDomainException`.
- Querying a veterinarian's reviews returns their average rating, total review count, rating distribution, and review list.
- Admin can moderate reviews, updating the vet's published rating aggregates.
- All unit and integration test suites pass with 100% coverage.
- Clean build of `@vetralink/api`.
