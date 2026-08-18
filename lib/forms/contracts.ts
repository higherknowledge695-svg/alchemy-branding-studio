export const PUBLIC_FORM_ERROR_CODES = [
  "invalid_json",
  "invalid_input",
  "delivery_not_configured",
  "delivery_rejected",
  "delivery_timeout",
  "internal_error",
] as const;

export type PublicFormErrorCode = (typeof PUBLIC_FORM_ERROR_CODES)[number];

export type PublicFormFieldErrors<Field extends string = string> = Partial<
  Record<Field, string>
>;

export type PublicFormSuccess = {
  ok: true;
  requestId: string;
};

export type PublicFormFailure<Field extends string = string> = {
  ok: false;
  error: {
    code: PublicFormErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
    fields?: PublicFormFieldErrors<Field>;
  };
};

export type PublicFormResult<Field extends string = string> =
  | PublicFormSuccess
  | PublicFormFailure<Field>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPublicFormSuccess(value: unknown): value is PublicFormSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    typeof value.requestId === "string" &&
    value.requestId.length > 0
  );
}

export function parsePublicFormFailure<Field extends string = string>(
  value: unknown,
): PublicFormFailure<Field> | null {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) {
    return null;
  }

  const { error } = value;
  if (
    !PUBLIC_FORM_ERROR_CODES.includes(error.code as PublicFormErrorCode) ||
    typeof error.message !== "string" ||
    typeof error.retryable !== "boolean" ||
    typeof error.requestId !== "string" ||
    error.requestId.length === 0
  ) {
    return null;
  }

  let fields: PublicFormFieldErrors<Field> | undefined;
  if (isRecord(error.fields)) {
    fields = Object.fromEntries(
      Object.entries(error.fields).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ) as PublicFormFieldErrors<Field>;
  }

  return {
    ok: false,
    error: {
      code: error.code as PublicFormErrorCode,
      message: error.message,
      retryable: error.retryable,
      requestId: error.requestId,
      ...(fields ? { fields } : {}),
    },
  };
}
