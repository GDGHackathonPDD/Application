import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

export function getClerkErrorMessage(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    return (
      err.errors?.[0]?.longMessage ??
      err.errors?.[0]?.message ??
      "Something went wrong. Please try again."
    );
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
