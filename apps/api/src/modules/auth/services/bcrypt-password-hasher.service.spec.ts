import { BcryptPasswordHasher } from "./bcrypt-password-hasher.service";

describe("BcryptPasswordHasher", () => {
  let hasher: BcryptPasswordHasher;

  beforeEach(() => {
    hasher = new BcryptPasswordHasher();
  });

  it("should hash password with 12 rounds", async () => {
    const plain = "SecureP@ssw0rd123";
    const hash = await hasher.hash(plain);

    expect(hash).toBeDefined();
    // bcrypt hashes with 12 rounds start with $2a$12$ or $2b$12$
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  });

  it("should return true when comparing matching password", async () => {
    const plain = "MySecretP@ss1";
    const hash = await hasher.hash(plain);

    const isMatch = await hasher.compare(plain, hash);
    expect(isMatch).toBe(true);
  });

  it("should return false when comparing mismatched password", async () => {
    const plain = "MySecretP@ss1";
    const hash = await hasher.hash(plain);

    const isMatch = await hasher.compare("WrongPassword123", hash);
    expect(isMatch).toBe(false);
  });
});
