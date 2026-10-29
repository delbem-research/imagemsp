/** Day names as the sources write them, without accents, Sunday first. */
const DAYS: readonly string[] = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
];

const DAY = DAYS.join('|');
const TIME = String.raw`(\d{1,2})(?:[:H](\d{2})?)?`;

/**
 * A day or a run of days, then the first time span after it:
 * `SEGUNDA A SABADO 7H-18H`, `DOMINGO E FERIADOS 7H-13H`, `DOMINGO: 8H-13H`,
 * `QUINTA-FEIRA, 7H00 AS 12H00` (the organic fairs', once unaccented).
 */
const SPAN = new RegExp(
  String.raw`(${DAY})(?:\s+A\s+(${DAY}))?[^0-9]*?${TIME}\s*(?:-|AS)\s*${TIME}`,
  'g'
);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The weekday (Sunday `0`) and the minute of the day in São Paulo. */
const saoPauloClock = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    return (
      parts.find((p) => {
        return p.type === type;
      })?.value ?? ''
    );
  };
  return {
    day: WEEKDAYS.indexOf(part('weekday')),
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  };
};

const minuteOf = (hour: string, minute: string | undefined) => {
  return Number(hour) * 60 + Number(minute ?? 0);
};

/**
 * Whether a place is open at a given moment, from opening hours written as the
 * municipal markets' are (`SEGUNDA A SÁBADO 7H-18H, DOMINGO E FERIADOS
 * 7H-13H`) or the organic fairs' (`Quinta-feira, 7h00 às 12h00`). A day the hours leave out counts as closed; holidays are not
 * known, so they follow the weekday's hours.
 *
 * @param params.hours - The opening hours, as the source writes them.
 * @param params.at - The moment asked about, read in São Paulo time.
 * @returns `true` or `false`, or `null` when no span could be read from `hours`.
 *
 * @example
 * isOpenAt({ hours: 'SEGUNDA A SÁBADO 8H-18H', at: new Date('2026-10-28T13:00:00-03:00') }); // true
 */
export const isOpenAt = ({
  hours,
  at,
}: {
  hours: string;
  at: Date;
}): boolean | null => {
  const text = hours
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
  const spans = [...text.matchAll(SPAN)];
  if (spans.length === 0) return null;

  const { day, minute } = saoPauloClock(at);
  return spans.some(([, first, last, openH, openM, closeH, closeM]) => {
    const from = DAYS.indexOf(first);
    const to = last ? DAYS.indexOf(last) : from;
    // A run may wrap past Saturday, as `SEXTA A DOMINGO`.
    const onDay =
      from <= to ? day >= from && day <= to : day >= from || day <= to;
    return (
      onDay &&
      minute >= minuteOf(openH, openM) &&
      minute < minuteOf(closeH, closeM)
    );
  });
};
