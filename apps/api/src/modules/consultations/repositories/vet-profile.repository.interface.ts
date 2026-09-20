import { VetProfileEntity } from "../entities/vet-profile.entity";

export const VET_PROFILE_REPOSITORY = Symbol("VET_PROFILE_REPOSITORY");

export interface VetWithProfileRecord {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    status: string;
  };
  profile: VetProfileEntity | null;
}

export interface IVetProfileRepository {
  findByUserId(userId: string): Promise<VetProfileEntity | null>;
  save(entity: VetProfileEntity): Promise<VetProfileEntity>;
  findAllActiveVetsWithProfiles(): Promise<VetWithProfileRecord[]>;
  updateRatingAggregates(
    userId: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void>;
}
