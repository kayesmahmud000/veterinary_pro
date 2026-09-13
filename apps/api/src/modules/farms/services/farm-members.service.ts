import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AddFarmMemberDto,
  FarmMemberListDto,
  FarmMemberResponseDto,
  FarmRole,
} from "@vetralink/shared-types";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../repositories/farm-member.repository.interface";
import { IFarmMembersService } from "./farm-members.service.interface";

@Injectable()
export class FarmMembersService implements IFarmMembersService {
  private readonly logger = new Logger(FarmMembersService.name);

  constructor(
    @Inject(FARM_MEMBER_REPOSITORY)
    private readonly memberRepo: IFarmMemberRepository,
  ) {}

  public async addMember(
    farmId: string,
    dto: AddFarmMemberDto,
  ): Promise<FarmMemberResponseDto> {
    const existing = await this.memberRepo.findMembership(farmId, dto.userId);
    if (existing) {
      throw new EntityConflictException(
        `User '${dto.userId}' is already a member of farm '${farmId}'.`,
        "userId",
      );
    }

    const memberEntity = FarmMemberEntity.create({
      farmId,
      userId: dto.userId,
      role: dto.role ?? FarmRole.HERDSMAN,
    });

    const saved = await this.memberRepo.create(memberEntity);

    this.logger.log(
      `Added member '${saved.userId}' with role '${saved.role}' to farm '${farmId}'.`,
    );

    return this.toDto(saved);
  }

  public async getMembers(farmId: string): Promise<FarmMemberListDto> {
    const members = await this.memberRepo.findByFarmId(farmId);
    return {
      items: members.map((m) => this.toDto(m)),
      total: members.length,
    };
  }

  private toDto(entity: FarmMemberEntity): FarmMemberResponseDto {
    return {
      id: entity.id,
      farmId: entity.farmId,
      userId: entity.userId,
      role: entity.role,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
