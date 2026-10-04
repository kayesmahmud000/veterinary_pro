import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GlobalExceptionFilter } from "./global-exception.filter";
import {
  EntityNotFoundException,
  EntityConflictException,
  ValidationDomainException,
} from "../exceptions/domain.exception";

describe("GlobalExceptionFilter (global-exception.filter.ts)", () => {
  let filter: GlobalExceptionFilter;

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockImplementation(() => ({ json: mockJson }));
  const mockSetHeader = jest.fn();

  const mockResponse = {
    status: mockStatus,
    setHeader: mockSetHeader,
  };

  const mockRequest = {
    url: "/api/v1/animals",
    method: "POST",
    headers: {},
  };

  const mockHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new GlobalExceptionFilter();
  });

  it("should handle standard HttpException (e.g. 404 Not Found)", () => {
    const exception = new HttpException("Resource not found", HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: "Resource not found",
        errorDetails: expect.objectContaining({
          status: 404,
          instance: "/api/v1/animals",
        }),
      })
    );
    expect(mockSetHeader).toHaveBeenCalledWith("x-trace-id", expect.any(String));
  });

  it("should format class-validator array errors into structured validation items", () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: [
          "tagNumber should not be empty",
          "species must be a valid enum",
        ],
        error: "Bad Request",
      },
      HttpStatus.BAD_REQUEST
    );

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: "Validation failed",
        errors: [
          {
            field: "tagNumber",
            message: "tagNumber should not be empty",
          },
          {
            field: "species",
            message: "species must be a valid enum",
          },
        ],
      })
    );
  });

  it("should translate Clean Architecture DomainException (EntityNotFoundException)", () => {
    const domainError = new EntityNotFoundException("Animal", "COW-001");

    filter.catch(domainError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: "Animal with identifier 'COW-001' was not found.",
        errorDetails: expect.objectContaining({
          title: "ENTITY_NOT_FOUND",
          status: 404,
          type: "https://vetralink.pro/errors/entity-not-found",
        }),
      })
    );
  });

  it("should translate ValidationDomainException with custom error array", () => {
    const domainError = new ValidationDomainException("Invalid animal payload", [
      { field: "weightKg", message: "Weight cannot be negative" },
    ]);

    filter.catch(domainError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(422);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 422,
        errors: [{ field: "weightKg", message: "Weight cannot be negative" }],
      })
    );
  });

  describe("Prisma Error Translations", () => {
    it("should translate P2002 (Unique constraint violation) to HTTP 409 Conflict", () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`tag_number`)",
        {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["tag_number"] },
        }
      );

      filter.catch(prismaError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          message: "Unique constraint violation on tag_number.",
          errors: [
            {
              field: "tag_number",
              message: "A record with this tag_number already exists.",
            },
          ],
          errorDetails: expect.objectContaining({
            title: "ENTITY_CONFLICT",
            status: 409,
          }),
        })
      );
    });

    it("should translate P2025 (Record not found) to HTTP 404 Not Found", () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        {
          code: "P2025",
          clientVersion: "5.22.0",
        }
      );

      filter.catch(prismaError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 404,
          message: "The requested record was not found.",
          errorDetails: expect.objectContaining({
            title: "ENTITY_NOT_FOUND",
            status: 404,
          }),
        })
      );
    });

    it("should translate P2003 (Foreign key constraint violation) to HTTP 422 Unprocessable Entity", () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed on the field: `farm_id`",
        {
          code: "P2003",
          clientVersion: "5.22.0",
          meta: { field_name: "farm_id" },
        }
      );

      filter.catch(prismaError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(422);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 422,
          message:
            "Referenced entity 'farm_id' does not exist or relation is restricted.",
          errors: [
            {
              field: "farm_id",
              message: "Invalid relation reference on farm_id.",
            },
          ],
        })
      );
    });
  });

  it("should sanitize unhandled 500 errors and avoid leaking stack traces", () => {
    const unhandledError = new Error("FATAL: Database connection dropped unexpectedly!");

    filter.catch(unhandledError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: "Internal server error",
        data: null,
      })
    );
    // Ensure raw error message and stack trace are NOT in the returned body
    const sentResponse = mockJson.mock.calls[0][0];
    expect(sentResponse.message).not.toContain("FATAL");
    expect(sentResponse.stack).toBeUndefined();
  });
});
