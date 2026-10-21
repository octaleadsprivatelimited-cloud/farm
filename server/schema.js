export const str = (max = 160, min = 1) => ({
  type: "string",
  minLength: min,
  maxLength: max,
});
export const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const id = str(36);
export const email = { type: "string", format: "email", maxLength: 254 };
export const phone = { type: "string", pattern: "^\\+?[0-9]{10,15}$" };
export const password = str(128, 12);
export const bool = { type: "boolean" };
export const integer = (min = 0, max = 1000000) => ({
  type: "integer",
  minimum: min,
  maximum: max,
});
export const ids = { type: "array", items: id, maxItems: 8, uniqueItems: true };
export const pagination = obj(
  {
    limit: { ...integer(1, 100), default: 25 },
    cursor: { type: "string", pattern: "^[0-9]{1,20}$" },
  },
  [],
);
export const addressBody = obj(
  {
    tag: str(50),
    name: str(100),
    phone,
    line: str(500),
    city: str(100),
    pincode: { type: "string", pattern: "^[0-9]{6}$" },
    isDefault: bool,
  },
  ["tag", "name", "phone", "line", "city", "pincode"],
);
export const bookingBody = obj(
  {
    serviceId: id,
    packageId: id,
    name: str(100),
    phone,
    city: str(100),
    address: str(500),
    property: str(100),
    area: integer(1, 1000000),
    date: { type: "string", format: "date" },
    time: { type: "string", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
    description: str(2000),
    uploadIds: ids,
  },
  [
    "serviceId",
    "packageId",
    "name",
    "phone",
    "city",
    "address",
    "property",
    "area",
    "date",
    "time",
    "description",
  ],
);
export const idempotencyHeaders = {
  type: "object",
  required: ["idempotency-key"],
  properties: { "idempotency-key": str(128, 8) },
};
