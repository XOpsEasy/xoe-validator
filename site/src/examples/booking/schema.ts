import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

const DAY = 24 * 60 * 60 * 1000;
const nights = (stay: { checkIn: Date; checkOut: Date }) =>
  Math.round((stay.checkOut.getTime() - stay.checkIn.getTime()) / DAY);

export const bookingSchema = xoe
  .object({
    checkIn: xoe.coerce.date().inFuture("Check-in must be in the future."),
    checkOut: xoe.coerce.date(),
    guests: xoe.coerce.number().integer().between(1, 6),
    isCompany: xoe.boolean().default(false),
    vatNumber: xoe.string().trim().optional(),
  })
  // A rule over several fields is a refine() of the object. It gets the
  // parsed values (dates, numbers) and runs only when every field is valid.
  .refine((stay) => stay.checkOut > stay.checkIn, {
    code: "booking.dateRange",
    message: "Check-out must be after check-in.",
    path: ["checkOut"], // the field that shows the message
  })
  .refine((stay) => nights(stay) <= 14, {
    code: "booking.tooLong",
    message: "You can book at most 14 nights.",
    path: ["checkOut"],
  })
  // A field that is required only sometimes: optional() plus a refine().
  // With the code "required" the UI and translations treat it as such.
  .refine((stay) => !stay.isCompany || Boolean(stay.vatNumber), {
    code: "required",
    message: "Enter the VAT number of the company.",
    path: ["vatNumber"],
  });

export type Booking = Infer<typeof bookingSchema>;
