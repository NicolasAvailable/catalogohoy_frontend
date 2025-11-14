import { $date } from '../../date/date';

describe('$date utility', () => {
  describe('Input handling', () => {
    it('should accept Date objects', () => {
      const inputDate = new Date('2024-01-15T10:30:00Z');
      const result = $date(inputDate);

      expect(result).toHaveProperty('plus');
      expect(result).toHaveProperty('minus');
    });

    it('should accept string dates', () => {
      const result = $date('2024-01-15T10:30:00Z');

      expect(result).toHaveProperty('plus');
      expect(result).toHaveProperty('minus');
    });

    it('should accept number timestamps', () => {
      const timestamp = Date.now();
      const result = $date(timestamp);

      expect(result).toHaveProperty('plus');
      expect(result).toHaveProperty('minus');
    });

    it('should handle invalid date strings gracefully', () => {
      const result = $date('invalid-date');

      expect(result).toHaveProperty('plus');
      expect(result).toHaveProperty('minus');
      // The result should still have the structure even if the date is invalid
    });
  });

  describe('plus operations', () => {
    const baseDate = new Date('2024-01-15T10:30:00Z');

    describe('plus.days', () => {
      it('should add positive days correctly', () => {
        const result = $date(baseDate).plus.days(5);
        const expected = new Date('2024-01-20T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should add single day correctly', () => {
        const result = $date(baseDate).plus.days(1);
        const expected = new Date('2024-01-16T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero days', () => {
        const result = $date(baseDate).plus.days(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative days (subtract)', () => {
        const result = $date(baseDate).plus.days(-3);
        const expected = new Date('2024-01-12T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional days', () => {
        const result = $date(baseDate).plus.days(0.5); // 12 hours
        const expected = new Date('2024-01-15T22:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('plus.hours', () => {
      it('should add positive hours correctly', () => {
        const result = $date(baseDate).plus.hours(5);
        const expected = new Date('2024-01-15T15:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should add single hour correctly', () => {
        const result = $date(baseDate).plus.hours(1);
        const expected = new Date('2024-01-15T11:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero hours', () => {
        const result = $date(baseDate).plus.hours(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative hours', () => {
        const result = $date(baseDate).plus.hours(-2);
        const expected = new Date('2024-01-15T08:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle hours that cross day boundaries', () => {
        const result = $date(baseDate).plus.hours(24);
        const expected = new Date('2024-01-16T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional hours', () => {
        const result = $date(baseDate).plus.hours(0.5); // 30 minutes
        const expected = new Date('2024-01-15T11:00:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('plus.minutes', () => {
      it('should add positive minutes correctly', () => {
        const result = $date(baseDate).plus.minutes(45);
        const expected = new Date('2024-01-15T11:15:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should add single minute correctly', () => {
        const result = $date(baseDate).plus.minutes(1);
        const expected = new Date('2024-01-15T10:31:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero minutes', () => {
        const result = $date(baseDate).plus.minutes(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative minutes', () => {
        const result = $date(baseDate).plus.minutes(-15);
        const expected = new Date('2024-01-15T10:15:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle minutes that cross hour boundaries', () => {
        const result = $date(baseDate).plus.minutes(60);
        const expected = new Date('2024-01-15T11:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle large numbers of minutes', () => {
        const result = $date(baseDate).plus.minutes(1440); // 24 hours
        const expected = new Date('2024-01-16T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional minutes', () => {
        const result = $date(baseDate).plus.minutes(0.5); // 30 seconds
        const expected = new Date('2024-01-15T10:30:30Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('plus.seconds', () => {
      it('should add positive seconds correctly', () => {
        const result = $date(baseDate).plus.seconds(45);
        const expected = new Date('2024-01-15T10:30:45Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should add single second correctly', () => {
        const result = $date(baseDate).plus.seconds(1);
        const expected = new Date('2024-01-15T10:30:01Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero seconds', () => {
        const result = $date(baseDate).plus.seconds(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative seconds', () => {
        const result = $date(baseDate).plus.seconds(-30);
        const expected = new Date('2024-01-15T10:29:30Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle seconds that cross minute boundaries', () => {
        const result = $date(baseDate).plus.seconds(60);
        const expected = new Date('2024-01-15T10:31:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle large numbers of seconds', () => {
        const result = $date(baseDate).plus.seconds(3600); // 1 hour
        const expected = new Date('2024-01-15T11:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional seconds', () => {
        const result = $date(baseDate).plus.seconds(0.5); // 500 milliseconds
        const expected = new Date('2024-01-15T10:30:00.500Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });
  });

  describe('minus operations', () => {
    const baseDate = new Date('2024-01-15T10:30:00Z');

    describe('minus.days', () => {
      it('should subtract positive days correctly', () => {
        const result = $date(baseDate).minus.days(5);
        const expected = new Date('2024-01-10T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should subtract single day correctly', () => {
        const result = $date(baseDate).minus.days(1);
        const expected = new Date('2024-01-14T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero days', () => {
        const result = $date(baseDate).minus.days(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative days (add)', () => {
        const result = $date(baseDate).minus.days(-3);
        const expected = new Date('2024-01-18T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle large numbers of days', () => {
        const result = $date(baseDate).minus.days(365);
        const expected = new Date('2023-01-15T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional days', () => {
        const result = $date(baseDate).minus.days(0.5); // 12 hours
        const expected = new Date('2024-01-14T22:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('minus.hours', () => {
      it('should subtract positive hours correctly', () => {
        const result = $date(baseDate).minus.hours(5);
        const expected = new Date('2024-01-15T05:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should subtract single hour correctly', () => {
        const result = $date(baseDate).minus.hours(1);
        const expected = new Date('2024-01-15T09:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero hours', () => {
        const result = $date(baseDate).minus.hours(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative hours', () => {
        const result = $date(baseDate).minus.hours(-2);
        const expected = new Date('2024-01-15T12:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle hours that cross day boundaries', () => {
        const result = $date(baseDate).minus.hours(24);
        const expected = new Date('2024-01-14T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional hours', () => {
        const result = $date(baseDate).minus.hours(0.5); // 30 minutes
        const expected = new Date('2024-01-15T10:00:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('minus.minutes', () => {
      it('should subtract positive minutes correctly', () => {
        const result = $date(baseDate).minus.minutes(15);
        const expected = new Date('2024-01-15T10:15:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should subtract single minute correctly', () => {
        const result = $date(baseDate).minus.minutes(1);
        const expected = new Date('2024-01-15T10:29:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero minutes', () => {
        const result = $date(baseDate).minus.minutes(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative minutes', () => {
        const result = $date(baseDate).minus.minutes(-45);
        const expected = new Date('2024-01-15T11:15:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle minutes that cross hour boundaries', () => {
        const result = $date(baseDate).minus.minutes(60);
        const expected = new Date('2024-01-15T09:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle large numbers of minutes', () => {
        const result = $date(baseDate).minus.minutes(1440); // 24 hours
        const expected = new Date('2024-01-14T10:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional minutes', () => {
        const result = $date(baseDate).minus.minutes(0.5); // 30 seconds
        const expected = new Date('2024-01-15T10:29:30Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });

    describe('minus.seconds', () => {
      it('should subtract positive seconds correctly', () => {
        const result = $date(baseDate).minus.seconds(30);
        const expected = new Date('2024-01-15T10:29:30Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should subtract single second correctly', () => {
        const result = $date(baseDate).minus.seconds(1);
        const expected = new Date('2024-01-15T10:29:59Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle zero seconds', () => {
        const result = $date(baseDate).minus.seconds(0);

        expect(result.getTime()).toBe(baseDate.getTime());
      });

      it('should handle negative seconds', () => {
        const result = $date(baseDate).minus.seconds(-45);
        const expected = new Date('2024-01-15T10:30:45Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle seconds that cross minute boundaries', () => {
        const result = $date(baseDate).minus.seconds(60);
        const expected = new Date('2024-01-15T10:29:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle large numbers of seconds', () => {
        const result = $date(baseDate).minus.seconds(3600); // 1 hour
        const expected = new Date('2024-01-15T09:30:00Z');

        expect(result.getTime()).toBe(expected.getTime());
      });

      it('should handle fractional seconds', () => {
        const result = $date(baseDate).minus.seconds(0.5); // 500 milliseconds
        const expected = new Date('2024-01-15T10:29:59.500Z');

        expect(result.getTime()).toBe(expected.getTime());
      });
    });
  });

  describe('Chaining operations', () => {
    const baseDate = new Date('2024-01-15T10:30:00Z');

    it('should allow chaining plus operations', () => {
      const chainedResult = $date($date(baseDate).plus.days(1)).plus.hours(2).getTime();
      const expected = new Date('2024-01-16T12:30:00Z').getTime();

      expect(chainedResult).toBe(expected);
    });

    it('should allow chaining minus operations', () => {
      const chainedResult = $date($date(baseDate).minus.days(1)).minus.hours(2).getTime();
      const expected = new Date('2024-01-14T08:30:00Z').getTime();

      expect(chainedResult).toBe(expected);
    });

    it('should allow mixing plus and minus operations', () => {
      const step1 = $date(baseDate).plus.days(2);
      const step2 = $date(step1).minus.hours(3);
      const result = $date(step2).plus.minutes(15);
      const expected = new Date('2024-01-17T07:45:00Z');

      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('Edge cases', () => {
    it('should handle leap year calculations', () => {
      const leapYearDate = new Date('2024-02-28T12:00:00Z');
      const result = $date(leapYearDate).plus.days(1);
      const expected = new Date('2024-02-29T12:00:00Z');

      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle month boundary crossings', () => {
      const endOfMonth = new Date('2024-01-31T12:00:00Z');
      const result = $date(endOfMonth).plus.days(1);
      const expected = new Date('2024-02-01T12:00:00Z');

      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle year boundary crossings', () => {
      const endOfYear = new Date('2023-12-31T23:59:59Z');
      const result = $date(endOfYear).plus.seconds(1);
      const expected = new Date('2024-01-01T00:00:00Z');

      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle daylight saving time transitions', () => {
      // This test depends on the system timezone, but we test the basic functionality
      const beforeDST = new Date('2024-03-10T06:00:00Z');
      const result = $date(beforeDST).plus.hours(24);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(beforeDST.getTime() + 24 * 60 * 60 * 1000);
    });

    it('should handle very large numbers', () => {
      const baseDate = new Date('2024-01-15T10:30:00Z');
      const result = $date(baseDate).plus.days(10000);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(baseDate.getTime());
    });

    it('should handle very small fractional numbers', () => {
      const baseDate = new Date('2024-01-15T10:30:00Z');
      const result = $date(baseDate).plus.seconds(0.001); // 1 millisecond

      expect(result.getTime()).toBe(baseDate.getTime() + 1);
    });

    it('should handle negative timestamps', () => {
      const negativeTimestamp = -86400000; // 1 day before epoch
      const result = $date(negativeTimestamp).plus.days(1);
      const expected = new Date(0); // Epoch

      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('Return value validation', () => {
    const baseDate = new Date('2024-01-15T10:30:00Z');

    it('should always return Date objects', () => {
      expect($date(baseDate).plus.days(1)).toBeInstanceOf(Date);
      expect($date(baseDate).plus.hours(1)).toBeInstanceOf(Date);
      expect($date(baseDate).plus.minutes(1)).toBeInstanceOf(Date);
      expect($date(baseDate).plus.seconds(1)).toBeInstanceOf(Date);
      expect($date(baseDate).minus.days(1)).toBeInstanceOf(Date);
      expect($date(baseDate).minus.hours(1)).toBeInstanceOf(Date);
      expect($date(baseDate).minus.minutes(1)).toBeInstanceOf(Date);
      expect($date(baseDate).minus.seconds(1)).toBeInstanceOf(Date);
    });

    it('should return new Date instances (not modify original)', () => {
      const originalDate = new Date('2024-01-15T10:30:00Z');
      const originalTime = originalDate.getTime();

      $date(originalDate).plus.days(1);

      expect(originalDate.getTime()).toBe(originalTime);
    });

    it('should return valid dates for all operations', () => {
      const operations = [
        () => $date(baseDate).plus.days(1),
        () => $date(baseDate).plus.hours(1),
        () => $date(baseDate).plus.minutes(1),
        () => $date(baseDate).plus.seconds(1),
        () => $date(baseDate).minus.days(1),
        () => $date(baseDate).minus.hours(1),
        () => $date(baseDate).minus.minutes(1),
        () => $date(baseDate).minus.seconds(1),
      ];

      operations.forEach((operation) => {
        const result = operation();
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(false);
      });
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle scheduling 5 minutes from now (like PostDateMinimumValidation)', () => {
      const now = new Date();
      const fiveMinutesLater = $date(now).plus.minutes(5);

      expect(fiveMinutesLater.getTime()).toBe(now.getTime() + 5 * 60 * 1000);
    });

    it('should handle calculating business hours', () => {
      const startOfDay = new Date('2024-01-15T09:00:00Z');
      const endOfDay = $date(startOfDay).plus.hours(8); // 8-hour workday

      expect(endOfDay.getTime()).toBe(new Date('2024-01-15T17:00:00Z').getTime());
    });

    it('should handle session expiration times', () => {
      const loginTime = new Date('2024-01-15T10:00:00Z');
      const sessionExpiry = $date(loginTime).plus.hours(24); // 24-hour session

      expect(sessionExpiry.getTime()).toBe(new Date('2024-01-16T10:00:00Z').getTime());
    });

    it('should handle reminder notifications', () => {
      const eventTime = new Date('2024-01-15T15:00:00Z');
      const reminderTime = $date(eventTime).minus.minutes(30); // 30 minutes before

      expect(reminderTime.getTime()).toBe(new Date('2024-01-15T14:30:00Z').getTime());
    });

    it('should handle cache expiration', () => {
      const cacheTime = new Date('2024-01-15T10:00:00Z');
      const expirationTime = $date(cacheTime).plus.seconds(3600); // 1 hour cache

      expect(expirationTime.getTime()).toBe(new Date('2024-01-15T11:00:00Z').getTime());
    });
  });

  describe('reset operations', () => {
    const baseDate = new Date('2024-01-15T10:30:45.123Z');

    describe('reset.hours', () => {
      it('should reset hours to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.hours();

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
        expect(result.getDate()).toBe(baseDate.getDate());
        expect(result.getMonth()).toBe(baseDate.getMonth());
        expect(result.getFullYear()).toBe(baseDate.getFullYear());
      });

      it('should handle dates already at hour 0', () => {
        const midnightDate = new Date('2024-01-15T00:30:45.123Z');
        const result = $date(midnightDate).reset.hours();

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(30);
      });

      it('should handle dates at different hours', () => {
        const dates = [
          new Date('2024-01-15T01:30:45Z'),
          new Date('2024-01-15T12:30:45Z'),
          new Date('2024-01-15T23:30:45Z'),
        ];

        dates.forEach((date) => {
          const result = $date(date).reset.hours();
          expect(result.getHours()).toBe(0);
        });
      });
    });

    describe('reset.minutes', () => {
      it('should reset minutes to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.minutes();

        expect(result.getMinutes()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
      });

      it('should handle dates already at minute 0', () => {
        const zeroMinuteDate = new Date('2024-01-15T10:00:45.123Z');
        const result = $date(zeroMinuteDate).reset.minutes();

        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(45);
      });

      it('should handle different minute values', () => {
        const dates = [
          new Date('2024-01-15T10:01:45Z'),
          new Date('2024-01-15T10:30:45Z'),
          new Date('2024-01-15T10:59:45Z'),
        ];

        dates.forEach((date) => {
          const result = $date(date).reset.minutes();
          expect(result.getMinutes()).toBe(0);
        });
      });
    });

    describe('reset.seconds', () => {
      it('should reset seconds to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.seconds();

        expect(result.getSeconds()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
      });

      it('should handle dates already at second 0', () => {
        const zeroSecondDate = new Date('2024-01-15T10:30:00.123Z');
        const result = $date(zeroSecondDate).reset.seconds();

        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(123);
      });

      it('should handle different second values', () => {
        const dates = [
          new Date('2024-01-15T10:30:01Z'),
          new Date('2024-01-15T10:30:30Z'),
          new Date('2024-01-15T10:30:59Z'),
        ];

        dates.forEach((date) => {
          const result = $date(date).reset.seconds();
          expect(result.getSeconds()).toBe(0);
        });
      });
    });

    describe('reset.milliseconds', () => {
      it('should reset milliseconds to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.milliseconds();

        expect(result.getMilliseconds()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
      });

      it('should handle dates already at millisecond 0', () => {
        const zeroMillisecondDate = new Date('2024-01-15T10:30:45.000Z');
        const result = $date(zeroMillisecondDate).reset.milliseconds();

        expect(result.getMilliseconds()).toBe(0);
        expect(result.getSeconds()).toBe(45);
      });

      it('should handle different millisecond values', () => {
        const dates = [
          new Date('2024-01-15T10:30:45.001Z'),
          new Date('2024-01-15T10:30:45.500Z'),
          new Date('2024-01-15T10:30:45.999Z'),
        ];

        dates.forEach((date) => {
          const result = $date(date).reset.milliseconds();
          expect(result.getMilliseconds()).toBe(0);
        });
      });
    });

    describe('reset.time', () => {
      it('should reset all time components to 0 (hours, minutes, seconds, milliseconds)', () => {
        const result = $date(baseDate).reset.time();

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getDate()).toBe(baseDate.getDate());
        expect(result.getMonth()).toBe(baseDate.getMonth());
        expect(result.getFullYear()).toBe(baseDate.getFullYear());
      });

      it('should handle dates already at midnight', () => {
        const midnightDate = new Date('2024-01-15T00:00:00.000Z');
        const result = $date(midnightDate).reset.time();

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getDate()).toBe(midnightDate.getDate());
        expect(result.getMonth()).toBe(midnightDate.getMonth());
        expect(result.getFullYear()).toBe(midnightDate.getFullYear());
      });

      it('should work with different dates and times', () => {
        const dates = [
          new Date('2024-01-15T23:59:59.999Z'),
          new Date('2024-12-31T12:30:45.123Z'),
          new Date('2024-02-29T06:15:30.500Z'), // Leap year
        ];

        dates.forEach((date) => {
          const result = $date(date).reset.time();
          expect(result.getHours()).toBe(0);
          expect(result.getMinutes()).toBe(0);
          expect(result.getSeconds()).toBe(0);
          expect(result.getMilliseconds()).toBe(0);
          expect(result.getDate()).toBe(date.getDate());
          expect(result.getMonth()).toBe(date.getMonth());
          expect(result.getFullYear()).toBe(date.getFullYear());
        });
      });

      it('should be equivalent to setHours(0, 0, 0, 0)', () => {
        const testDate = new Date('2024-01-15T10:30:45.123Z');
        const resetResult = $date(testDate).reset.time();

        const manualReset = new Date(testDate);
        manualReset.setHours(0, 0, 0, 0);

        expect(resetResult.getTime()).toBe(manualReset.getTime());
      });
    });

    describe('reset operations chaining', () => {
      it('should allow chaining reset operations with other date operations', () => {
        const resetDate = $date(baseDate).reset.time();
        const result = $date(resetDate).plus.days(1);

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getDate()).toBe(16); // January 16
        expect(result.getMonth()).toBe(0); // January
        expect(result.getFullYear()).toBe(2024);
      });

      it('should work with minus operations after reset', () => {
        const resetDate = $date(baseDate).reset.time();
        const result = $date(resetDate).minus.days(1);

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getDate()).toBe(14); // January 14
        expect(result.getMonth()).toBe(0); // January
        expect(result.getFullYear()).toBe(2024);
      });
    });

    describe('reset edge cases', () => {
      it('should handle leap year dates', () => {
        const leapYearDate = new Date('2024-02-29T15:30:45.123Z');
        const result = $date(leapYearDate).reset.time();

        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(1); // February (0-indexed)
        expect(result.getDate()).toBe(29);
        expect(result.getHours()).toBe(0);
      });

      it('should handle year boundary dates', () => {
        const yearBoundary = new Date('2023-12-31T23:59:59.999Z');
        const result = $date(yearBoundary).reset.time();

        expect(result.getFullYear()).toBe(2023);
        expect(result.getMonth()).toBe(11); // December
        expect(result.getDate()).toBe(31);
        expect(result.getHours()).toBe(0);
      });

      it('should handle daylight saving time transitions', () => {
        // Test around DST transition (results may vary by timezone)
        const dstDate = new Date('2024-03-10T10:30:45Z');
        const result = $date(dstDate).reset.time();

        expect(result).toBeInstanceOf(Date);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
      });
    });
  });

  describe('format operations', () => {
    const baseDate = new Date('2024-01-15T10:30:45.123Z');

    describe('format.day', () => {
      it('should return date in YYYY-MM-DD format', () => {
        const result = $date(baseDate).format.day();

        expect(result).toBe('2024-01-15');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle different dates correctly', () => {
        const testCases = [
          { date: new Date('2024-01-01T00:00:00Z'), expected: '2024-01-01' },
          { date: new Date('2024-12-31T23:59:59Z'), expected: '2024-12-31' },
          { date: new Date('2024-02-29T12:00:00Z'), expected: '2024-02-29' }, // Leap year
          { date: new Date('2023-02-28T12:00:00Z'), expected: '2023-02-28' }, // Non-leap year
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.day();
          expect(result).toBe(expected);
        });
      });

      it('should handle single digit months and days with leading zeros', () => {
        const singleDigitDate = new Date('2024-03-05T10:30:00Z');
        const result = $date(singleDigitDate).format.day();

        expect(result).toBe('2024-03-05');
      });

      it('should be timezone independent (always UTC)', () => {
        const utcDate = new Date('2024-01-15T23:30:00Z');
        const result = $date(utcDate).format.day();

        expect(result).toBe('2024-01-15');
      });
    });

    describe('format.week', () => {
      it('should return start of week in YYYY-MM-DD format', () => {
        // January 15, 2024 is a Monday, so start of week should be January 14, 2024 (Sunday)
        const monday = new Date('2024-01-15T10:30:00Z'); // Monday
        const result = $date(monday).format.week();

        expect(result).toBe('2024-01-14'); // Previous Sunday
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle different days of the week correctly', () => {
        const testCases = [
          { date: new Date('2024-01-14T10:00:00Z'), expected: '2024-01-14' }, // Sunday (start of week)
          { date: new Date('2024-01-15T10:00:00Z'), expected: '2024-01-14' }, // Monday
          { date: new Date('2024-01-16T10:00:00Z'), expected: '2024-01-14' }, // Tuesday
          { date: new Date('2024-01-17T10:00:00Z'), expected: '2024-01-14' }, // Wednesday
          { date: new Date('2024-01-18T10:00:00Z'), expected: '2024-01-14' }, // Thursday
          { date: new Date('2024-01-19T10:00:00Z'), expected: '2024-01-14' }, // Friday
          { date: new Date('2024-01-20T10:00:00Z'), expected: '2024-01-14' }, // Saturday
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.week();
          expect(result).toBe(expected);
        });
      });

      it('should handle week boundaries across months', () => {
        const endOfMonth = new Date('2024-01-31T10:00:00Z'); // Wednesday
        const result = $date(endOfMonth).format.week();

        expect(result).toBe('2024-01-28'); // Previous Sunday
      });

      it('should handle week boundaries across years', () => {
        const newYear = new Date('2024-01-01T10:00:00Z'); // Monday
        const result = $date(newYear).format.week();

        expect(result).toBe('2023-12-31'); // Previous Sunday (previous year)
      });

      it('should handle leap year weeks', () => {
        const leapYearDate = new Date('2024-02-29T10:00:00Z'); // Thursday
        const result = $date(leapYearDate).format.week();

        expect(result).toBe('2024-02-25'); // Previous Sunday
      });
    });

    describe('format.month', () => {
      it('should return month in YYYY-MM format', () => {
        const result = $date(baseDate).format.month();

        expect(result).toBe('2024-01');
        expect(result).toMatch(/^\d{4}-\d{2}$/);
      });

      it('should handle different months correctly', () => {
        const testCases = [
          { date: new Date('2024-01-15T10:00:00Z'), expected: '2024-01' },
          { date: new Date('2024-02-15T10:00:00Z'), expected: '2024-02' },
          { date: new Date('2024-12-15T10:00:00Z'), expected: '2024-12' },
          { date: new Date('2023-06-15T10:00:00Z'), expected: '2023-06' },
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.month();
          expect(result).toBe(expected);
        });
      });

      it('should pad single digit months with leading zero', () => {
        const singleDigitMonth = new Date('2024-03-15T10:00:00Z');
        const result = $date(singleDigitMonth).format.month();

        expect(result).toBe('2024-03');
      });

      it('should handle leap year February', () => {
        const leapYearFeb = new Date('2024-02-29T10:00:00Z');
        const result = $date(leapYearFeb).format.month();

        expect(result).toBe('2024-02');
      });
    });

    describe('format.year', () => {
      it('should return year as string', () => {
        const result = $date(baseDate).format.year();

        expect(result).toBe('2024');
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d{4}$/);
      });

      it('should handle different years correctly', () => {
        const testCases = [
          { date: new Date('2020-01-15T10:00:00Z'), expected: '2020' },
          { date: new Date('2023-01-15T10:00:00Z'), expected: '2023' },
          { date: new Date('2024-01-15T10:00:00Z'), expected: '2024' },
          { date: new Date('2025-01-15T10:00:00Z'), expected: '2025' },
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.year();
          expect(result).toBe(expected);
        });
      });

      it('should handle leap years', () => {
        const leapYear = new Date('2024-02-29T10:00:00Z');
        const result = $date(leapYear).format.year();

        expect(result).toBe('2024');
      });

      it('should handle century boundaries', () => {
        const centuryBoundary = new Date('2000-01-01T10:00:00Z');
        const result = $date(centuryBoundary).format.year();

        expect(result).toBe('2000');
      });
    });

    describe('format.fullDate', () => {
      it('should return formatted date in Spanish locale', () => {
        const result = $date(baseDate).format.fullDate();

        expect(typeof result).toBe('string');
        expect(result).toContain('2024');
        expect(result).toContain('enero'); // Spanish for January
        expect(result).toContain('15');
      });

      it('should include weekday, day, month, and year', () => {
        const monday = new Date('2024-01-15T10:00:00Z'); // Monday
        const result = $date(monday).format.fullDate();

        expect(result).toContain('lunes'); // Spanish for Monday
        expect(result).toContain('15');
        expect(result).toContain('enero');
        expect(result).toContain('2024');
      });

      it('should handle different months in Spanish', () => {
        const testCases = [
          { date: new Date('2024-01-15T10:00:00Z'), month: 'enero' },
          { date: new Date('2024-02-15T10:00:00Z'), month: 'febrero' },
          { date: new Date('2024-03-15T10:00:00Z'), month: 'marzo' },
          { date: new Date('2024-12-15T10:00:00Z'), month: 'diciembre' },
        ];

        testCases.forEach(({ date, month }) => {
          const result = $date(date).format.fullDate();
          expect(result).toContain(month);
        });
      });

      it('should handle different weekdays in Spanish', () => {
        const testCases = [
          { date: new Date('2024-01-14T10:00:00Z'), weekday: 'domingo' }, // Sunday
          { date: new Date('2024-01-15T10:00:00Z'), weekday: 'lunes' }, // Monday
          { date: new Date('2024-01-16T10:00:00Z'), weekday: 'martes' }, // Tuesday
          { date: new Date('2024-01-20T10:00:00Z'), weekday: 'sábado' }, // Saturday
        ];

        testCases.forEach(({ date, weekday }) => {
          const result = $date(date).format.fullDate();
          expect(result).toContain(weekday);
        });
      });

      it('should handle leap year dates', () => {
        const leapDay = new Date('2024-02-29T10:00:00Z');
        const result = $date(leapDay).format.fullDate();

        expect(result).toContain('29');
        expect(result).toContain('febrero');
        expect(result).toContain('2024');
      });
    });

    describe('format chaining and integration', () => {
      it('should work with other date operations', () => {
        const tomorrow = $date(baseDate).plus.days(1);
        const tomorrowFormatted = $date(tomorrow).format.day();

        expect(tomorrowFormatted).toBe('2024-01-16');
      });

      it('should work with reset operations', () => {
        const resetDate = $date(baseDate).reset.time();
        const formatted = $date(resetDate).format.day();

        expect(formatted).toBe('2024-01-15');
      });

      it('should handle multiple format calls on same date', () => {
        const dateInstance = $date(baseDate);

        expect(dateInstance.format.day()).toBe('2024-01-15');
        expect(dateInstance.format.month()).toBe('2024-01');
        expect(dateInstance.format.year()).toBe('2024');
      });
    });
  });

  describe('reset operations', () => {
    const baseDate = new Date('2024-01-15T10:30:45.123Z');

    describe('reset.hours', () => {
      it('should reset hours to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.hours();
        
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
      });

      it('should handle dates already at hour 0', () => {
        const midnightDate = new Date('2024-01-15T00:30:45.123Z');
        const result = $date(midnightDate).reset.hours();
        
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(30);
      });
    });

    describe('reset.minutes', () => {
      it('should reset minutes to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.minutes();
        
        expect(result.getMinutes()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
      });
    });

    describe('reset.seconds', () => {
      it('should reset seconds to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.seconds();
        
        expect(result.getSeconds()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getMilliseconds()).toBe(baseDate.getMilliseconds());
      });
    });

    describe('reset.milliseconds', () => {
      it('should reset milliseconds to 0 while preserving other components', () => {
        const result = $date(baseDate).reset.milliseconds();
        
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getHours()).toBe(baseDate.getHours());
        expect(result.getMinutes()).toBe(baseDate.getMinutes());
        expect(result.getSeconds()).toBe(baseDate.getSeconds());
      });
    });

    describe('reset.time', () => {
      it('should reset all time components to 0', () => {
        const result = $date(baseDate).reset.time();
        
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
        expect(result.getDate()).toBe(baseDate.getDate());
        expect(result.getMonth()).toBe(baseDate.getMonth());
        expect(result.getFullYear()).toBe(baseDate.getFullYear());
      });

      it('should be equivalent to setHours(0, 0, 0, 0)', () => {
        const testDate = new Date('2024-01-15T10:30:45.123Z');
        const resetResult = $date(testDate).reset.time();
        
        const manualReset = new Date(testDate);
        manualReset.setHours(0, 0, 0, 0);
        
        expect(resetResult.getTime()).toBe(manualReset.getTime());
      });
    });
  });

  describe('format operations', () => {
    const baseDate = new Date('2024-01-15T10:30:45.123Z');

    describe('format.day', () => {
      it('should return date in YYYY-MM-DD format', () => {
        const result = $date(baseDate).format.day();
        
        expect(result).toBe('2024-01-15');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle different dates correctly', () => {
        const testCases = [
          { date: new Date('2024-01-01T00:00:00Z'), expected: '2024-01-01' },
          { date: new Date('2024-12-31T23:59:59Z'), expected: '2024-12-31' },
          { date: new Date('2024-02-29T12:00:00Z'), expected: '2024-02-29' }, // Leap year
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.day();
          expect(result).toBe(expected);
        });
      });
    });

    describe('format.week', () => {
      it('should return start of week in YYYY-MM-DD format', () => {
        // January 15, 2024 is a Monday, so start of week should be January 14, 2024 (Sunday)
        const monday = new Date('2024-01-15T10:30:00Z');
        const result = $date(monday).format.week();
        
        expect(result).toBe('2024-01-14'); // Previous Sunday
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle different days of the week correctly', () => {
        const testCases = [
          { date: new Date('2024-01-14T10:00:00Z'), expected: '2024-01-14' }, // Sunday
          { date: new Date('2024-01-15T10:00:00Z'), expected: '2024-01-14' }, // Monday
          { date: new Date('2024-01-20T10:00:00Z'), expected: '2024-01-14' }, // Saturday
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.week();
          expect(result).toBe(expected);
        });
      });
    });

    describe('format.month', () => {
      it('should return month in YYYY-MM format', () => {
        const result = $date(baseDate).format.month();
        
        expect(result).toBe('2024-01');
        expect(result).toMatch(/^\d{4}-\d{2}$/);
      });

      it('should handle different months correctly', () => {
        const testCases = [
          { date: new Date('2024-01-15T10:00:00Z'), expected: '2024-01' },
          { date: new Date('2024-12-15T10:00:00Z'), expected: '2024-12' },
        ];

        testCases.forEach(({ date, expected }) => {
          const result = $date(date).format.month();
          expect(result).toBe(expected);
        });
      });
    });

    describe('format.year', () => {
      it('should return year as string', () => {
        const result = $date(baseDate).format.year();
        
        expect(result).toBe('2024');
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d{4}$/);
      });
    });

    describe('format.fullDate', () => {
      it('should return formatted date in Spanish locale', () => {
        const result = $date(baseDate).format.fullDate();
        
        expect(typeof result).toBe('string');
        expect(result).toContain('2024');
        expect(result).toContain('enero'); // Spanish for January
        expect(result).toContain('15');
      });

      it('should include weekday information', () => {
        const monday = new Date('2024-01-15T10:00:00Z'); // Monday
        const result = $date(monday).format.fullDate();
        
        expect(result).toContain('lunes'); // Spanish for Monday
      });
    });
  });

  describe('format.localDateTimeString', () => {
    it('should format date without timezone offset', () => {
      const date = new Date('2024-01-15T10:30:45Z');
      const result = $date(date).format.localDateTimeString();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result).toContain('2024-01-15');
      expect(result).toContain(' ');
    });

    it('should handle different timezones consistently', () => {
      const utcDate = new Date('2024-01-15T10:30:45Z');
      const result = $date(utcDate).format.localDateTimeString();

      // Should return a string in YYYY-MM-DD HH:mm:ss format
      expect(typeof result).toBe('string');
      expect(result.length).toBe(19);
      expect(result.charAt(10)).toBe(' ');
    });

    it('should preserve exact local time without timezone conversion', () => {
      // Create a date with known local time
      const localDate = new Date(2024, 0, 15, 10, 30, 45); // January 15, 2024, 10:30:45 local time
      const result = $date(localDate).format.localDateTimeString();

      expect(result).toBe('2024-01-15 10:30:45');
    });

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00Z');
      const result = $date(leapDay).format.localDateTimeString();

      expect(result).toMatch(/^\d{4}-02-29 \d{2}:\d{2}:\d{2}$/);
    });

    it('should format single digit months and days with leading zeros', () => {
      const singleDigits = new Date('2024-03-05T08:07:06Z');
      const result = $date(singleDigits).format.localDateTimeString();

      expect(result).toMatch(/^\d{4}-03-05 \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('create static method', () => {
    describe('Valid Date inputs', () => {
      it('should return the same Date object if already valid', () => {
        const validDate = new Date('2024-01-15T10:30:00Z');
        const result = $date.create(validDate);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(validDate.getTime());
      });

      it('should convert valid date strings', () => {
        const dateString = '2024-01-15T10:30:00Z';
        const result = $date.create(dateString);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(new Date(dateString).getTime());
      });

      it('should convert valid timestamps', () => {
        const timestamp = Date.now();
        const result = $date.create(timestamp);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(timestamp);
      });

      it('should convert ISO date strings', () => {
        const isoString = '2024-12-25T00:00:00.000Z';
        const result = $date.create(isoString);

        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe(isoString);
      });

      it('should handle numeric strings that represent valid dates', () => {
        const timestamp = '1640995200000';
        const result = $date.create(timestamp);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(Number(timestamp));
      });

      it('should handle zero timestamp', () => {
        const result = $date.create(0);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(0);
        expect(result.toISOString()).toBe('1970-01-01T00:00:00.000Z');
      });

      it('should handle negative timestamps', () => {
        const negativeTimestamp = -86400000; // 1 day before epoch
        const result = $date.create(negativeTimestamp);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(negativeTimestamp);
      });
    });

    describe('Invalid inputs fallback to current date', () => {
      let originalDateNow: () => number;
      const mockNow = 1640995200000; // 2022-01-01T00:00:00.000Z

      beforeEach(() => {
        originalDateNow = Date.now;
        Date.now = jest.fn(() => mockNow);
      });

      afterEach(() => {
        Date.now = originalDateNow;
      });

      it('should return current date for null', () => {
        const result = $date.create(null);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for undefined', () => {
        const result = $date.create(undefined);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for invalid date strings', () => {
        const result = $date.create('invalid-date-string');

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for invalid Date objects', () => {
        const invalidDate = new Date('invalid');
        const result = $date.create(invalidDate);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for objects', () => {
        const result = $date.create({ year: 2024, month: 1 });

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for arrays', () => {
        const result = $date.create([2024, 1, 15]);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for boolean values', () => {
        const result1 = $date.create(true);
        const result2 = $date.create(false);

        expect(result1).toBeInstanceOf(Date);
        expect(result2).toBeInstanceOf(Date);
        expect(result1.getTime()).toBe(mockNow);
        expect(result2.getTime()).toBe(mockNow);
      });

      it('should return current date for empty strings', () => {
        const result = $date.create('');

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for NaN', () => {
        const result = $date.create(NaN);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });

      it('should return current date for functions', () => {
        const result = $date.create(() => 'test');

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(mockNow);
      });
    });

    describe('Edge cases', () => {
      it('should handle date strings with different formats', () => {
        const formats = [
          '2024-01-15',
          '01/15/2024',
          'January 15, 2024',
          '2024-01-15T10:30:00',
          '2024-01-15T10:30:00.000Z',
        ];

        formats.forEach((format) => {
          const result = $date.create(format);
          expect(result).toBeInstanceOf(Date);
          // Should either be a valid date or fallback to current date
          expect(result.getTime()).toBeGreaterThan(0);
        });
      });

      it('should handle very large timestamps', () => {
        const largeTimestamp = 8640000000000000; // Max safe date
        const result = $date.create(largeTimestamp);

        expect(result).toBeInstanceOf(Date);
        // Should either return the date or fallback to current date if too large
        expect(result).toBeInstanceOf(Date);
      });

      it('should handle string representations of numbers', () => {
        const stringNumber = '123456789';
        const result = $date.create(stringNumber);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(Number(stringNumber));
      });

      it('should handle whitespace in strings', () => {
        const whitespaceString = '  2024-01-15T10:30:00Z  ';
        const result = $date.create(whitespaceString);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(new Date('2024-01-15T10:30:00Z').getTime());
      });
    });

    describe('Method chaining', () => {
      it('should allow chaining with other $date methods', () => {
        const safeDate = $date.create('2024-01-15T10:30:00Z');
        const plusOneDay = $date(safeDate).plus.days(1);

        expect(plusOneDay).toBeInstanceOf(Date);
        expect(plusOneDay.getTime()).toBe(new Date('2024-01-16T10:30:00Z').getTime());
      });

      it('should work with invalid input and then chain operations', () => {
        const mockNow = 1640995200000; // 2022-01-01T00:00:00.000Z
        const originalDateNow = Date.now;
        Date.now = jest.fn(() => mockNow);

        const safeDate = $date.create('invalid-date');
        const plusOneHour = $date(safeDate).plus.hours(1);

        expect(plusOneHour).toBeInstanceOf(Date);
        expect(plusOneHour.getTime()).toBe(mockNow + 60 * 60 * 1000);

        Date.now = originalDateNow;
      });
    });
  });

  describe('today static method', () => {
    it('should return a Date object', () => {
      const result = $date.today();

      expect(result).toBeInstanceOf(Date);
    });

    it("should return today's date with time set to 00:00:00.000", () => {
      const result = $date.today();
      const expected = new Date();
      expected.setHours(0, 0, 0, 0);

      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should have hours set to 0', () => {
      const result = $date.today();

      expect(result.getHours()).toBe(0);
    });

    it('should have minutes set to 0', () => {
      const result = $date.today();

      expect(result.getMinutes()).toBe(0);
    });

    it('should have seconds set to 0', () => {
      const result = $date.today();

      expect(result.getSeconds()).toBe(0);
    });

    it('should have milliseconds set to 0', () => {
      const result = $date.today();

      expect(result.getMilliseconds()).toBe(0);
    });

    it('should return the same date when called multiple times on the same day', () => {
      const result1 = $date.today();
      const result2 = $date.today();

      expect(result1.getTime()).toBe(result2.getTime());
    });

    it('should return current year', () => {
      const result = $date.today();
      const currentYear = new Date().getFullYear();

      expect(result.getFullYear()).toBe(currentYear);
    });

    it('should return current month', () => {
      const result = $date.today();
      const currentMonth = new Date().getMonth();

      expect(result.getMonth()).toBe(currentMonth);
    });

    it('should return current day', () => {
      const result = $date.today();
      const currentDay = new Date().getDate();

      expect(result.getDate()).toBe(currentDay);
    });

    it('should be useful for date comparisons', () => {
      const today = $date.today();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(0, 0, 0, 0);

      expect(today.getTime()).toBeLessThan(futureDate.getTime());
    });

    it('should be useful for setting minimum dates', () => {
      const today = $date.today();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(today.getTime()).toBeGreaterThan(pastDate.getTime());
    });

    it('should work correctly with date arithmetic', () => {
      const today = $date.today();
      const tomorrow = $date(today).plus.days(1);
      const expectedTomorrow = new Date(today);
      expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);

      expect(tomorrow.getTime()).toBe(expectedTomorrow.getTime());
    });

    it('should be consistent across different time zones (same local date)', () => {
      const result = $date.today();
      const manualToday = new Date();
      manualToday.setHours(0, 0, 0, 0);

      // Both should represent the same local date at midnight
      expect(result.getFullYear()).toBe(manualToday.getFullYear());
      expect(result.getMonth()).toBe(manualToday.getMonth());
      expect(result.getDate()).toBe(manualToday.getDate());
    });

    describe('Edge cases', () => {
      it('should handle year boundaries correctly', () => {
        // Mock a date near year boundary to test consistency
        const result = $date.today();

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
      });

      it('should handle month boundaries correctly', () => {
        const result = $date.today();
        const currentDate = new Date();

        expect(result.getDate()).toBe(currentDate.getDate());
        expect(result.getMonth()).toBe(currentDate.getMonth());
      });

      it('should handle leap years correctly', () => {
        const result = $date.today();

        // Should always return a valid date regardless of leap year
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).not.toBeNaN();
      });
    });

    describe('Real-world usage scenarios', () => {
      it('should be suitable for datepicker minDate restriction', () => {
        const minDate = $date.today();
        const userSelectedDate = new Date();
        userSelectedDate.setHours(10, 30, 0, 0); // Same day, different time

        // User can select today or future dates
        expect(userSelectedDate.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
      });

      it('should work for campaign start date validation', () => {
        const campaignStartDate = $date.today();
        const now = new Date();

        // Campaign can start today (at midnight) or later
        expect(campaignStartDate.getTime()).toBeLessThanOrEqual(now.getTime());
      });

      it('should be useful for filtering records by date', () => {
        const todayStart = $date.today();
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);

        expect(todayStart.getTime()).toBeLessThan(todayEnd.getTime());
        expect(todayEnd.getTime() - todayStart.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
      });
    });
  });
});
