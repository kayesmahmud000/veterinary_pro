import { FarmRole } from "../../enums/index.js";

export interface AddFarmMemberDto {
  userId: string;
  role?: FarmRole;
}

export interface FarmMemberResponseDto {
  id: string;
  farmId: string;
  userId: string;
  role: FarmRole;
  createdAt: string;
}

export interface FarmMemberListDto {
  items: FarmMemberResponseDto[];
  total: number;
}
