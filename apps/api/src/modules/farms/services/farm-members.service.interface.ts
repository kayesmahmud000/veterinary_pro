import {
  AddFarmMemberDto,
  FarmMemberListDto,
  FarmMemberResponseDto,
} from "@vetralink/shared-types";

export interface IFarmMembersService {
  addMember(
    farmId: string,
    dto: AddFarmMemberDto,
  ): Promise<FarmMemberResponseDto>;

  getMembers(farmId: string): Promise<FarmMemberListDto>;
}

export const FARM_MEMBERS_SERVICE = "FARM_MEMBERS_SERVICE";
