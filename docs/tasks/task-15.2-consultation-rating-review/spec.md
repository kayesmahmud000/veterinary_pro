# Specification: Task 15.2 - Post-Consultation Rating & Review Pipeline

## 1. Feature Overview & Objective
In tele-veterinary medicine, post-consultation feedback is critical for quality assurance, clinician reputation, trust building for farmers, and continuous clinical improvement. Once a consultation concludes (`ConsultationStatus.COMPLETED`), the farmer who initiated the encounter must have the ability to rate the veterinarian (1-5 stars), leave structured feedback tags, and write qualitative review notes.

The objective of Task 15.2 is to:
1. Establish a **Consultation Review Data Model (`ConsultationReview`)** in PostgreSQL with ratings (1-5 stars), feedback text, structured clinical tags, public visibility flags, and moderation state (`APPROVED`, `PENDING`, `FLAGGED`, `REJECTED`).
2. Enforce clinical and business invariants:
   - Only consultations in `COMPLETED` status can be reviewed.
   - Only the client farmer who booked the consultation can submit a review.
   - Idempotency: Exactly one review per consultation (`consultationId` is unique).
   - Rating must be an integer between 1 and 5.
   - Feedback text is sanitized and bounded (max 1000 characters).
3. Compute and cache aggregate metrics on **VetProfile**:
   - `averageRating` (e.g., 4.85 out of 5.00).
   - `totalReviews` (count of approved reviews).
   - Rating distribution (counts of 1, 2, 3, 4, 5-star ratings).
   - Top praise tags (e.g. `TIMELY_RESPONSE`, `ACCURATE_DIAGNOSIS`, `CLEAR_COMMUNICATION`).
4. Provide veterinarian and public profile queries:
   - `GET /consultations/reviews/vet/:vetId` returning paginated approved reviews and rating breakdown.
   - `GET /consultations/:id/review` returning the review for a specific consultation.
5. Provide administrative moderation:
   - `GET /consultations/reviews/moderation` for reviews requiring review/flagged.
   - `POST /consultations/reviews/:id/moderate` to approve, flag, or reject reviews with audit logging (`CONSULTATION_REVIEW_MODERATED`).

---

## 2. Current State vs. Proposed State

### Current State:
- Consultations transition to `COMPLETED` when clinical encounters conclude, but there is no mechanism for farmers to rate veterinarians or provide feedback.
- `VetProfile` contains scheduling and license information (`maxActiveCases`, `workingHours`, `timezone`), but has no rating or reputation fields (`averageRating`, `totalReviews`).
- No review models, services, repositories, or controllers exist in the codebase.

### Proposed State:
- `schema.prisma` includes `model ConsultationReview`, enum `ReviewModerationStatus`, and reputation metrics in `model VetProfile`.
- Farmers can submit ratings and reviews via `POST /consultations/:id/review`.
- Automatic update of `averageRating` and `totalReviews` on `VetProfile` upon review creation or moderation status changes.
- Veterinarians can view their ratings, review breakdowns, and feedback tags.
- Administrators have complete moderation capabilities to prevent spam, offensive content, or unwarranted defamation.
- Audit logging tracks `CONSULTATION_REVIEW_SUBMITTED` and `CONSULTATION_REVIEW_MODERATED`.

---

## 3. Architectural & Design Trade-offs

### Option A: Fully dynamic aggregate query on every request vs. Option B: Dual storage (incremental updates in `VetProfile` + dynamic distribution queries)
- **Option A (Dynamic Aggregation only)**:
  - Runs `AVG(rating)` and `COUNT(*)` across `consultation_reviews` on every profile view or search query.
  - Slower when filtering or sorting large lists of veterinarians by rating.
- **Option B (Cached Aggregates on `VetProfile` + Dynamic Breakdown)**:
  - Stores `averageRating` (Decimal 3,2) and `totalReviews` (Int) directly on `VetProfile` for fast O(1) indexed sort/filter.
  - Updates these fields incrementally when an approved review is submitted or moderated.
  - Computes detailed star distribution (1-5 stars) and tag frequency on the dedicated reviews endpoint.
- **Decision**: Implement Option B. This provides optimal read performance for marketplace listing and search while maintaining exact relational integrity for detailed review analysis.

---

## 4. Data Models & Contracts

### Prisma Schema
```prisma
enum ReviewModerationStatus {
  PENDING
  APPROVED
  FLAGGED
  REJECTED
}

model ConsultationReview {
  id               String                 @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId   String                 @unique @map("consultation_id") @db.Uuid
  farmerId         String                 @map("farmer_id") @db.Uuid
  vetId            String                 @map("vet_id") @db.Uuid
  rating           Int
  feedback         String?                @db.Text
  tags             Json                   @default("[]")
  isPublic         Boolean                @default(true) @map("is_public")
  moderationStatus ReviewModerationStatus @default(APPROVED) @map("moderation_status")
  moderatedById    String?                @map("moderated_by_id") @db.Uuid
  moderatedAt      DateTime?              @map("moderated_at") @db.Timestamptz(6)
  moderationReason String?                @map("moderation_reason") @db.Text
  createdAt        DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Restrict)
  farmer       User         @relation("FarmerReviews", fields: [farmerId], references: [id], onDelete: Restrict)
  vet          User         @relation("VetReviews", fields: [vetId], references: [id], onDelete: Restrict)
  moderatedBy  User?        @relation("ModeratedReviews", fields: [moderatedById], references: [id], onDelete: SetNull)

  @@index([vetId, moderationStatus, isPublic])
  @@index([farmerId])
  @@index([moderationStatus, createdAt])
  @@map("consultation_reviews")
}
```

### Shared Types (`packages/shared-types`)
- `ReviewModerationStatus`: `PENDING`, `APPROVED`, `FLAGGED`, `REJECTED`
- `ReviewRatingTag`: Enum of structured clinical praise tags:
  - `TIMELY_RESPONSE`, `ACCURATE_DIAGNOSIS`, `CLEAR_COMMUNICATION`, `COMPASSIONATE_CARE`, `PRACTICAL_ADVICE`, `EMERGENCY_READY`
- `SubmitConsultationReviewDto`:
  - `rating: number` (1 to 5)
  - `feedback?: string`
  - `tags?: string[]`
  - `isPublic?: boolean`
- `ConsultationReviewDto`:
  - `id: string`
  - `consultationId: string`
  - `farmerId: string`
  - `vetId: string`
  - `rating: number`
  - `feedback?: string | null`
  - `tags: string[]`
  - `isPublic: boolean`
  - `moderationStatus: ReviewModerationStatus`
  - `createdAt: string`
  - `updatedAt: string`
  - `farmer?: { id: string; name: string } | null`
  - `vet?: { id: string; name: string } | null`
- `VetRatingSummaryDto`:
  - `vetId: string`
  - `averageRating: number`
  - `totalReviews: number`
  - `ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number }`
  - `topTags: { tag: string; count: number }[]`
- `ModerateReviewDto`:
  - `status: ReviewModerationStatus`
  - `reason?: string`
- `ReviewQueryDto`:
  - `vetId?: string`
  - `farmerId?: string`
  - `moderationStatus?: ReviewModerationStatus`
  - `minRating?: number`
  - `maxRating?: number`
  - `page?: number`
  - `limit?: number`

---

## 5. Security & Edge Cases
1. **Completion Check**: Reviews cannot be submitted unless consultation status is `COMPLETED`.
2. **Authorization**: Only the client farmer who booked the consultation can submit a review.
3. **Idempotency**: One review per consultation (`consultationId` unique constraint prevents duplicate reviews).
4. **Rating Boundaries**: Ratings must be an integer between 1 and 5 (inclusive).
5. **Profanity / Flagging Filter**: Reviews containing flagged keywords or unverified claims can be automatically flagged for administrative moderation.
6. **Audit Trails**: `CONSULTATION_REVIEW_SUBMITTED` and `CONSULTATION_REVIEW_MODERATED` audit logs recorded with user ID and trace ID.
