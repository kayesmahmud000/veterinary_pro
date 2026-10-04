import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { IPasswordHasher } from "./password-hasher.interface";

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds = 12;

  public async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  public async compare(
    plainPassword: string,
    passwordHash: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
