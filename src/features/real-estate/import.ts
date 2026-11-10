import { propertyFacts } from "./domain";
import { parsePropertyCsv } from "./csv.mjs";
export function validateCsv(input: string) {
  return parsePropertyCsv(input).map((raw, index) => {
    if (
      !/^\d+(\.\d{1,3})?$/.test(raw.lot_acres) ||
      !/^\d+(\.\d{1,2})?$/.test(raw.asking_price)
    )
      throw new Error(
        "CSV record " +
          (index + 2) +
          ": use nonnegative decimal acreage and price.",
      );
    const result = propertyFacts.safeParse({
      ...raw,
      lot_acres: Number(raw.lot_acres),
      asking_price: Number(raw.asking_price),
    });
    if (!result.success)
      throw new Error(
        "CSV record " +
          (index + 2) +
          ": check " +
          result.error.issues.map((i) => i.path.join(".")).join(", ") +
          ".",
      );
    return result.data;
  });
}
