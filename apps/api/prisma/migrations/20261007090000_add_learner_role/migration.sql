-- Commit the new enum value before the next migration uses it.
ALTER TYPE "UserRole" ADD VALUE 'LEARNER';
