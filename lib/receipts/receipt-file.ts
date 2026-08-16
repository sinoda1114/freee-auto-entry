export function isImageFile(file: Pick<File, "type">): boolean {
  return file.type.startsWith("image/");
}

export function isReceiptDropFile(file: Pick<File, "type">): boolean {
  return isImageFile(file) || file.type === "application/pdf";
}
