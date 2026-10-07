import {
  AddFarmMemberInput,
  FarmMemberListDto,
  FarmMemberResponseDto,
  JwtPayload,
} from "@vetralink/shared-types";

export interface IFarmMembersService {
  addMember(
    farmId: string,
    dto: AddFarmMemberInput,
    actor: JwtPayload,
  ): Promise<FarmMemberResponseDto>;

  getMembers(farmId: string): Promise<FarmMemberListDto>;
}

export const FARM_MEMBERS_SERVICE = "FARM_MEMBERS_SERVICE";
