import records from "@/content/doctors.json";
import { validateDoctorProfiles } from "./doctor-directory";
export const doctorProfiles = validateDoctorProfiles(records);
