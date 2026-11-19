import { round2 } from "../db/index.js";

export const DEFAULT_GST_PERCENT = Number(process.env.GST_PERCENT || 18);
export const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";

/** "HH:MM" of `date` in the business time zone (IST), independent of the server's TZ. */
export const localTimeHHMM = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh === "24" ? "00" : hh}:${mm}`;
};

const inWindow = (t, start, end) => {
  if (!start || !end) return false;
  if (start <= end) return t >= start && t <= end;
  return t >= start || t <= end; // window crosses midnight, e.g. 22:00–06:00
};

/** Price per kWh at `at` (dynamic time-of-day rules in IST, else base price). */
export const pricePerKwhAt = (station, at = new Date()) => {
  let price = Number(station?.basePricePerKwh) || 0;
  const rules = Array.isArray(station?.dynamicPricing) ? station.dynamicPricing : [];
  const t = localTimeHHMM(at);
  for (const rule of rules) {
    if (inWindow(t, rule?.startTime, rule?.endTime) && Number.isFinite(Number(rule?.pricePerKwh))) {
      price = Number(rule.pricePerKwh);
      break;
    }
  }
  return price;
};

export const stationRates = (station, at = new Date()) => ({
  pricePerKwh: pricePerKwhAt(station, at),
  convenienceFee: Number(station?.convenienceFee) || 0,
  taxPercent: Number.isFinite(Number(station?.tax)) ? Number(station.tax) : DEFAULT_GST_PERCENT,
});

/**
 * Bill for `energyKwh`: energy + convenience fee, GST on both.
 * Returns rupee amounts rounded to paise.
 */
export const computeBill = ({ energyKwh, pricePerKwh, convenienceFee, taxPercent }) => {
  const energy = Math.max(Number(energyKwh) || 0, 0);
  const energyCost = round2(energy * (Number(pricePerKwh) || 0));
  const fee = round2(Number(convenienceFee) || 0);
  const tax = round2(((energyCost + fee) * (Number(taxPercent) || 0)) / 100);
  return { energyCost, convenienceFee: fee, tax, total: round2(energyCost + fee + tax) };
};

/** kWh that a prepaid amount (incl. fee + GST) buys. */
export const energyForAmount = ({ amount, pricePerKwh, convenienceFee, taxPercent }) => {
  const price = Number(pricePerKwh) || 0;
  if (price <= 0) return Infinity;
  const preTax = (Number(amount) || 0) / (1 + (Number(taxPercent) || 0) / 100);
  return Math.max((preTax - (Number(convenienceFee) || 0)) / price, 0);
};
