/**
 * @jest-environment node
 */
import { isOpenAt } from '@/components/map/lib/openingHours';

/** 2026-10-26 is a Monday; `day` 0 is that Monday, 6 the Sunday after. */
const at = ({ day, time }: { day: number; time: string }) => {
  const monday = new Date(`2026-10-26T${time}:00-03:00`);
  return new Date(monday.getTime() + day * 24 * 60 * 60 * 1000);
};

const MONDAY = 0;
const SATURDAY = 5;
const SUNDAY = 6;

describe('isOpenAt', () => {
  test.each([
    { day: MONDAY, time: '07:00', open: true },
    { day: SATURDAY, time: '17:59', open: true },
    { day: SATURDAY, time: '18:00', open: false },
    { day: SUNDAY, time: '12:00', open: true },
    { day: SUNDAY, time: '14:00', open: false },
  ])(
    'a market open Mon–Sat 7–18h, Sun 7–13h: day $day at $time → $open',
    ({ day, time, open }) => {
      expect(
        isOpenAt({
          hours: 'SEGUNDA A SÁBADO 7H-18H, DOMINGO E FERIADOS 7H-13H',
          at: at({ day, time }),
        })
      ).toBe(open);
    }
  );

  test('a day the hours leave out is closed', () => {
    expect(
      isOpenAt({
        hours: 'TERCA A SABADO 8H-19H DOMINGO-8H-13H',
        at: at({ day: MONDAY, time: '10:00' }),
      })
    ).toBe(false);
  });

  test('reads minutes and a colon after the day', () => {
    const hours = 'TERÇA Á SÁBADO 8:30-18H, DOMINGO: 8H-13H.';
    expect(isOpenAt({ hours, at: at({ day: 1, time: '08:15' }) })).toBe(false);
    expect(isOpenAt({ hours, at: at({ day: 1, time: '08:30' }) })).toBe(true);
    expect(isOpenAt({ hours, at: at({ day: SUNDAY, time: '09:00' }) })).toBe(
      true
    );
  });

  test('a run of days may wrap past Saturday', () => {
    expect(
      isOpenAt({
        hours: 'SEXTA A DOMINGO 8H-12H',
        at: at({ day: SUNDAY, time: '10:00' }),
      })
    ).toBe(true);
  });

  test('reads the organic fairs\' "day, hh às hh" hours', () => {
    const hours = 'Sábado, 7h00 às 13h00 · Domingo, 8h00 às 12h00';
    expect(isOpenAt({ hours, at: at({ day: SATURDAY, time: '12:59' }) })).toBe(
      true
    );
    expect(isOpenAt({ hours, at: at({ day: SATURDAY, time: '13:00' }) })).toBe(
      false
    );
    expect(isOpenAt({ hours, at: at({ day: SUNDAY, time: '09:00' }) })).toBe(
      true
    );
    expect(isOpenAt({ hours, at: at({ day: MONDAY, time: '09:00' }) })).toBe(
      false
    );
  });

  test('null when no span can be read', () => {
    expect(isOpenAt({ hours: 'Consulte o local', at: new Date() })).toBeNull();
  });
});
