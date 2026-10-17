import { calendarEntries, monthGrid } from '../src/pages/CalendarPage';

describe('CalendarPage helpers (v3)', () => {
  it('lays a month out Monday to Sunday, padded with neighbouring days', () => {
    const weeks = monthGrid(2026, 5); // June 2026 starts on a Monday
    expect(weeks[0]![0]).toBe('2026-06-01');
    expect(weeks.at(-1)!.at(-1)).toBe('2026-07-05');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthGrid(2026, 9)[0]![0]).toBe('2026-09-28'); // October 2026 starts on a Thursday
  });

  it('collects tasks, withdrawals, seasons, records and medicine expiry', () => {
    const entries = calendarEntries({
      farm: {
        id: 'f1',
        name: 'Hill Farm',
        groups: [
          {
            id: 'g1',
            name: 'Ewes',
            lambingStart: '2026-03-01',
            lambingEnd: '2026-03-03',
            calvingStart: null,
            calvingEnd: null,
            withdrawal: { meatEnds: '2026-06-20', milkEnds: null },
          },
        ],
      },
      tasks: [
        {
          id: 't1',
          title: 'Trim feet',
          dueDate: '2026-06-05',
          done: false,
          overdue: false,
          group: { name: 'Ewes' },
        },
      ],
      registerEvents: [
        {
          id: 'e1',
          kind: 'DEATH',
          date: '2026-05-01',
          count: 2,
          bornDead: null,
          value: null,
          otherParty: null,
          reference: null,
          cause: null,
          note: null,
          recordedBy: 'a',
          voided: false,
          voidReason: null,
          group: { id: 'g1', name: 'Ewes' },
        },
        {
          id: 'e2',
          kind: 'DEATH',
          date: '2026-05-02',
          count: 1,
          bornDead: null,
          value: null,
          otherParty: null,
          reference: null,
          cause: null,
          note: null,
          recordedBy: 'a',
          voided: true,
          voidReason: 'x',
          group: { id: 'g1', name: 'Ewes' },
        },
      ],
      medicines: [
        { id: 'm1', productName: 'Wormer', expiryDate: '2026-07-01', status: 'OK' },
        { id: 'm2', productName: 'Gone', expiryDate: '2026-07-02', status: 'FINISHED' },
      ],
    });
    expect(entries.map((e) => [e.date, e.kind, e.text])).toEqual([
      ['2026-06-05', 'task', 'Trim feet (Ewes)'],
      ['2026-06-20', 'withdrawal', 'Ewes: meat withdrawal ends'],
      ['2026-03-01', 'season', 'Lambing: Ewes'],
      ['2026-03-02', 'season', 'Lambing: Ewes'],
      ['2026-03-03', 'season', 'Lambing: Ewes'],
      ['2026-05-01', 'record', 'Death or loss: Ewes (2)'],
      ['2026-07-01', 'medicine', 'Wormer expires'],
    ]);
  });
});
