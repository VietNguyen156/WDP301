class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
class ValidationError extends AppError {
  constructor(message, code = "VALIDATION_ERROR") {
    super(message, 400, code);
  }
}
class NotFoundError extends AppError {
  constructor(message = "Không tìm thấy dữ liệu") {
    super(message, 404, "RESOURCE_NOT_FOUND");
  }
}
class ForbiddenError extends AppError {
  constructor(
    message = "Bạn không có quyền thực hiện thao tác này",
    code = "FORBIDDEN",
  ) {
    super(message, 403, code);
  }
}
class BusinessRuleError extends AppError {
  constructor(message, code = "BUSINESS_RULE_ERROR") {
    super(message, 422, code);
  }
}
module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleError,
};
