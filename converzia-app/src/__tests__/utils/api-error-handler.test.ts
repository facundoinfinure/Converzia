import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  handleApiError,
  handleUnauthorized,
  handleForbidden,
  handleNotFound,
  handleValidationError,
  handleConflict,
  apiSuccess,
  ErrorCode,
} from "@/lib/utils/api-error-handler";

describe("API Error Handler", () => {
  describe("apiSuccess", () => {
    it("should return success response with data", async () => {
      const response = apiSuccess({ id: 1, name: "Test" });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ id: 1, name: "Test" });
    });

    it("should include message when provided", async () => {
      const response = apiSuccess({ id: 1 }, "Operation completed");
      const json = await response.json();

      expect(json.message).toBe("Operation completed");
    });

    it("should allow custom status codes", async () => {
      const response = apiSuccess({ id: 1 }, "Created", 201);

      expect(response.status).toBe(201);
    });
  });

  describe("handleUnauthorized", () => {
    it("should return 401 status", async () => {
      const response = handleUnauthorized();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(json.error).toBe("Unauthorized");
    });

    it("should use custom message when provided", async () => {
      const response = handleUnauthorized("Token expirado");
      const json = await response.json();

      expect(json.error).toBe("Token expirado");
    });
  });

  describe("handleForbidden", () => {
    it("should return 403 status", async () => {
      const response = handleForbidden();
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe(ErrorCode.FORBIDDEN);
      expect(json.error).toBe("Forbidden");
    });

    it("should use custom message when provided", async () => {
      const response = handleForbidden("Acceso denegado a este recurso");
      const json = await response.json();

      expect(json.error).toBe("Acceso denegado a este recurso");
    });
  });

  describe("handleNotFound", () => {
    it("should return 404 status", async () => {
      const response = handleNotFound("Tenant");
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    it("should include resource name in message", async () => {
      const response = handleNotFound("Usuario");
      const json = await response.json();

      expect(json.error).toContain("Usuario");
    });

    it("should include request_id for tracing", async () => {
      const response = handleNotFound("Offer", { offer_id: "123" });
      const json = await response.json();

      expect(json.request_id).toBeDefined();
    });
  });

  describe("handleValidationError", () => {
    it("should return 400 status", async () => {
      const response = handleValidationError(new Error("Invalid email"));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("should have validation error code", async () => {
      const response = handleValidationError(new Error("Email required"), {
        field: "email",
        required: true,
      });
      const json = await response.json();

      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.error).toBe("Validation error");
    });
  });

  describe("handleConflict", () => {
    it("should return 409 status", async () => {
      const response = handleConflict("El recurso ya existe");
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.code).toBe(ErrorCode.CONFLICT);
      expect(json.error).toBe("El recurso ya existe");
    });
  });

  describe("handleApiError", () => {
    it("should handle generic errors", async () => {
      const error = new Error("Something went wrong");
      const response = handleApiError(error, {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error interno del servidor",
      });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.error).toBe("Error interno del servidor");
    });

    it("should include context when provided", async () => {
      const error = new Error("DB error");
      const response = handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "Error de base de datos",
        context: { table: "tenants", operation: "insert" },
      });
      const json = await response.json();

      // Context should be logged but not exposed in response for security
      expect(json.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it("should handle null error gracefully", async () => {
      const response = handleApiError(null, {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error desconocido",
      });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe("ErrorCode enum", () => {
    it("should have all expected error codes", () => {
      expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
      expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
      expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
      expect(ErrorCode.CONFLICT).toBe("CONFLICT");
      expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(ErrorCode.DATABASE_ERROR).toBe("DATABASE_ERROR");
      expect(ErrorCode.EXTERNAL_API_ERROR).toBe("EXTERNAL_API_ERROR");
    });
  });
});
