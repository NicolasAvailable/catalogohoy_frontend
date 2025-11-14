export const $date = (date: Date | string | number = new Date()) => {
  date = new Date(date);
  return {
    plus: {
      days: (days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
      hours: (hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000),
      minutes: (minutes: number) => new Date(date.getTime() + minutes * 60 * 1000),
      seconds: (seconds: number) => new Date(date.getTime() + seconds * 1000),
    },
    minus: {
      days: (days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
      hours: (hours: number) => new Date(date.getTime() - hours * 60 * 60 * 1000),
      minutes: (minutes: number) => new Date(date.getTime() - minutes * 60 * 1000),
      seconds: (seconds: number) => new Date(date.getTime() - seconds * 1000),
    },
    reset: {
      hours: () => {
        const newDate = new Date(date);
        newDate.setHours(0);
        return newDate;
      },
      minutes: () => {
        const newDate = new Date(date);
        newDate.setMinutes(0);
        return newDate;
      },
      seconds: () => {
        const newDate = new Date(date);
        newDate.setSeconds(0);
        return newDate;
      },
      milliseconds: () => {
        const newDate = new Date(date);
        newDate.setMilliseconds(0);
        return newDate;
      },
      time: () => {
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
      },
    },
    format: {
      day: () => date.toDateString(),
      week: () => {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toISOString().split('T')[0];
      },
      month: () => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      year: () => date.getFullYear().toString(),
      fullDate: (locale = 'es-ES') =>
        date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      localDateTimeString: () =>
        new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' '),
    },
  };
};

$date.create = (value: Date | string | number | null | undefined | unknown): Date => {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) return new Date(value);
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) return $date.create(Number(value.trim()));
  if (typeof value === 'string' && value.trim() && !isNaN(new Date(value.trim()).getTime()))
    return new Date(value.trim());

  return new Date(Date.now());
};

$date.today = () => {
  return $date(new Date()).reset.time();
};
