import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";

describe("AppModule Dependency Injection Bootstrap", () => {
  it("should compile AppModule and resolve all provider dependencies without DI errors", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
