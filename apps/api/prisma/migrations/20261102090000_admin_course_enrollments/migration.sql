CREATE TYPE "CourseEnrollmentStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "CourseEnrollmentSource" AS ENUM ('SELF', 'ADMIN');
ALTER TABLE course_enrollments
 ADD COLUMN status "CourseEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN version INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN source "CourseEnrollmentSource" NOT NULL DEFAULT 'SELF',
 ADD COLUMN updated_at TIMESTAMPTZ(6),
 ADD COLUMN activated_at TIMESTAMPTZ(6),
 ADD COLUMN revoked_at TIMESTAMPTZ(6),
 ADD COLUMN revoked_by_id UUID;
UPDATE course_enrollments SET updated_at=created_at, activated_at=created_at;
ALTER TABLE course_enrollments
 ALTER COLUMN updated_at SET NOT NULL, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
 ALTER COLUMN activated_at SET NOT NULL, ALTER COLUMN activated_at SET DEFAULT CURRENT_TIMESTAMP,
 ADD CONSTRAINT course_enrollments_version_check CHECK (version>=0),
 ADD CONSTRAINT course_enrollments_revocation_check CHECK (
   (status='ACTIVE' AND revoked_at IS NULL AND revoked_by_id IS NULL) OR
   (status='REVOKED' AND revoked_at IS NOT NULL AND revoked_by_id IS NOT NULL)),
 ADD CONSTRAINT course_enrollments_revoked_by_id_fkey FOREIGN KEY (revoked_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX course_enrollments_product_id_status_id_idx ON course_enrollments(product_id,status,id);
CREATE INDEX course_enrollments_user_id_status_id_idx ON course_enrollments(user_id,status,id);
