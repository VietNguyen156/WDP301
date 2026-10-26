function nonNegativeIntegers(schema, paths) {
  for (const path of paths) {
    schema
      .path(path)
      .validate(
        (value) =>
          value === undefined || (Number.isSafeInteger(value) && value >= 0),
        `${path} phải là số nguyên không âm`,
      );
  }
}
module.exports = nonNegativeIntegers;
