"use client";

import { useEffect, useState } from "react";
import { getDayDiscount } from "@/lib/discount";

interface Availability {
  inArticle: number;
  presenting: number;
}

interface Props {
  bookingType: "in_article" | "presenting";
  selectedDates: string[];
  onChange: (dates: string[]) => void;
  pricePerDay?: number; // display only, in dollars
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function MultiDateCalendar({ bookingType, selectedDates, onChange, pricePerDay }: Props) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sponsor/calendar?year=${year}&month=${month + 1}`)
      .then((r) => r.json())
      .then((d) => setAvailability(d.availability || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function isDateAvailable(dateStr: string): boolean {
    if (dateStr < todayStr) return false;
    const a = availability[dateStr];
    if (!a) return true;
    if (bookingType === "in_article") return a.inArticle < 2;
    if (bookingType === "presenting") return a.presenting < 1;
    return true;
  }

  function toggleDate(dateStr: string) {
    if (!isDateAvailable(dateStr)) return;
    if (selectedDates.includes(dateStr)) {
      onChange(selectedDates.filter((d) => d !== dateStr));
    } else {
      onChange([...selectedDates, dateStr].sort());
    }
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const totalDays = selectedDates.length;
  const discountPct = getDayDiscount(totalDays);

  return (
    <div>
      {/* Discount banner */}
      <div className="mb-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm">
        <div className="font-semibold text-green-800 mb-0.5">Multi-day discount</div>
        <div className="text-green-700 text-xs space-y-0.5">
          <span>1–2 days: full price · </span>
          <span>3–6 days: 5% off · </span>
          <span>7–13 days: 10% off · </span>
          <span>14–20 days: 15% off · </span>
          <span>21+ days: 20% off</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">‹</button>
          <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</span>
          <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">›</button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[36px]" />;
              const dateStr = toDateStr(year, month, day);
              const available = isDateAvailable(dateStr);
              const selected = selectedDates.includes(dateStr);
              const isPast = dateStr < todayStr;
              const avail = availability[dateStr];
              const isFull = !available && !isPast;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!available}
                  onClick={() => toggleDate(dateStr)}
                  title={isFull ? "Date unavailable" : undefined}
                  className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors relative
                    ${selected ? "bg-green-600 text-white" : ""}
                    ${!selected && available ? "hover:bg-green-50 text-gray-700" : ""}
                    ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                    ${isFull ? "text-gray-300 cursor-not-allowed line-through" : ""}
                  `}
                >
                  {day}
                  {avail && !isFull && !selected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-px">
                      {bookingType === "in_article" && avail.inArticle === 1 && (
                        <span className="w-1 h-1 rounded-full bg-orange-400 block" title="1 slot left" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block" /> Selected</span>
          <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-400 inline-block" /> 1 slot left</span>
          <span className="flex items-center gap-1 line-through">## Booked</span>
        </div>
      </div>

      {/* Live summary */}
      {totalDays > 0 && (
        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">{totalDays} day{totalDays !== 1 ? "s" : ""} selected</span>
            {discountPct > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{discountPct}% off</span>
            )}
          </div>
          {pricePerDay !== undefined && (
            <div className="mt-1 text-gray-500 text-xs">
              {discountPct > 0 ? (
                <>
                  <span className="line-through text-gray-400">${(pricePerDay * totalDays).toFixed(0)}</span>
                  {" "}→{" "}
                  <span className="font-semibold text-green-700">
                    ${(pricePerDay * (1 - discountPct / 100) * totalDays).toFixed(0)}
                  </span>
                  {" "}(${(pricePerDay * (1 - discountPct / 100)).toFixed(0)}/day)
                </>
              ) : (
                <span className="font-semibold text-gray-700">${(pricePerDay * totalDays).toFixed(0)} total</span>
              )}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {selectedDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange(selectedDates.filter((x) => x !== d))}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-600 hover:border-red-300 hover:text-red-500"
              >
                {d}
                <span className="text-gray-400">×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
