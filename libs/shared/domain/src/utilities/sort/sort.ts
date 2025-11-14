import { object } from '../object/object';

export const sort = <T>(items: T[]) => {
  const createSorter = (sortOrder: 'asc' | 'desc' = 'asc') => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    const sortWithComparator = (compareFn: (a: T, b: T) => number): T[] => {
      return [...items].sort((a, b) => compareFn(a, b) * multiplier);
    };

    const compareValues = (aValue: string | number | Date, bValue: string | number | Date): number => {
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return aValue.getTime() - bValue.getTime();
      }

      return String(aValue).localeCompare(String(bValue));
    };

    return {
      by: (keyExtractor: (item: T) => string | number | Date): T[] => {
        return sortWithComparator((a, b) => {
          const aValue = keyExtractor(a);
          const bValue = keyExtractor(b);
          return compareValues(aValue, bValue);
        });
      },

      byProperty: (propertyPath: string): T[] => {
        return sortWithComparator((a, b) => {
          const aValue = object.getValue(a as Record<string, unknown>, propertyPath) as string | number | Date;
          const bValue = object.getValue(b as Record<string, unknown>, propertyPath) as string | number | Date;
          return compareValues(aValue, bValue);
        });
      },

      byCustom: (compareFn: (a: T, b: T) => number): T[] => {
        return sortWithComparator(compareFn);
      },
    };
  };

  return { ...createSorter('asc'), asc: () => createSorter('asc'), desc: () => createSorter('desc') };
};
