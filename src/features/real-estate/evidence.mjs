export const MAX_EVIDENCE_BYTES = 2097152;
export function validateEvidence(bytes, mime) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length === 0 ||
    bytes.length > MAX_EVIDENCE_BYTES
  )
    throw new Error("Evidence must be a nonempty PDF, PNG or JPEG up to 2 MB.");
  const match =
    mime === "application/pdf"
      ? bytes.length >= 5 &&
        String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : mime === "image/png"
        ? bytes.length >= 8 &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : mime === "image/jpeg"
          ? bytes.length >= 3 &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255
          : false;
  if (!match)
    throw new Error(
      "File contents do not match an allowed PDF, PNG or JPEG type.",
    );
  return { mime, byteSize: bytes.length };
}
