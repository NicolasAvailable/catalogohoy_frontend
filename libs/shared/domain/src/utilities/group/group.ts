import { $date } from '../date/date';
import { sort } from '../sort/sort';

export type GroupedItem<T> = { key: string; items: T[] };

export type GroupOptions<T> = {
  preserveOriginalKey?: boolean;
  sortBy?: 'key' | 'count' | ((a: GroupedItem<T>, b: GroupedItem<T>) => number);
  sortOrder?: 'asc' | 'desc';
};

export const $group = {
  by: <T>(items: T[], keyExtractor: (item: T) => string, options: GroupOptions<T> = {}): GroupedItem<T>[] => {
    const { preserveOriginalKey = false, sortBy, sortOrder = 'asc' } = options;

    const groupMap = new Map<string, T[]>();
    const keyMap = new Map<string, T>();

    items.forEach((item) => {
      const key = keyExtractor(item);

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        if (preserveOriginalKey) {
          keyMap.set(key, item);
        }
      }

      const existingGroup = groupMap.get(key);
      if (existingGroup) {
        existingGroup.push(item);
      }
    });

    let result = Array.from(groupMap.entries()).map(([key, items]) => {
      const originalItem = keyMap.get(key);
      return { key: preserveOriginalKey && originalItem ? keyExtractor(originalItem) : key, items };
    });

    if (sortBy) {
      result = $group.sort(result, sortBy, sortOrder);
    }

    return result;
  },

  byMultiple: <T>(
    items: T[],
    keyExtractors: Array<(item: T) => string>,
    options: GroupOptions<T> = {}
  ): GroupedItem<T>[] => {
    if (keyExtractors.length === 0) {
      return [{ key: 'all', items }];
    }

    const [firstExtractor, ...restExtractors] = keyExtractors;
    const firstLevel = $group.by(items, firstExtractor, options);

    if (restExtractors.length === 0) {
      return firstLevel;
    }

    return firstLevel.map((group) => ({
      key: group.key,
      items: $group.byMultiple(group.items, restExtractors, options) as T[],
    }));
  },

  byDate: <T>(
    items: T[],
    dateExtractor: (item: T) => Date,
    format: 'day' | 'week' | 'month' | 'year' | ((date: Date) => string) = 'day',
    options: GroupOptions<T> = {}
  ): GroupedItem<T>[] => {
    const formatter = typeof format === 'function' ? format : (date: Date) => $date(date).format[format]();
    return $group.by(items, (item) => formatter(dateExtractor(item)), { ...options, preserveOriginalKey: true });
  },

  byProperty: <T>(items: T[], propertyPath: string, options: GroupOptions<T> = {}): GroupedItem<T>[] => {
    const getValue = (obj: Record<string, unknown>, path: string): unknown => {
      return path.split('.').reduce((current, key) => {
        if (current && typeof current === 'object' && key in current) {
          return (current as Record<string, unknown>)[key];
        }
        return undefined;
      }, obj as unknown);
    };

    return $group.by(items, (item) => String(getValue(item as Record<string, unknown>, propertyPath)), options);
  },

  sort: <T>(
    groups: GroupedItem<T>[],
    sortBy: 'key' | 'count' | ((a: GroupedItem<T>, b: GroupedItem<T>) => number),
    sortOrder: 'asc' | 'desc' = 'asc'
  ): GroupedItem<T>[] => {
    if (typeof sortBy === 'function') {
      return sortOrder === 'asc' ? sort(groups).asc().byCustom(sortBy) : sort(groups).desc().byCustom(sortBy);
    }

    if (sortBy === 'key') {
      return sortOrder === 'asc'
        ? sort(groups)
            .asc()
            .by((group: GroupedItem<T>) => group.key)
        : sort(groups)
            .desc()
            .by((group: GroupedItem<T>) => group.key);
    }

    if (sortBy === 'count') {
      return sortOrder === 'asc'
        ? sort(groups)
            .asc()
            .by((group: GroupedItem<T>) => group.items.length)
        : sort(groups)
            .desc()
            .by((group: GroupedItem<T>) => group.items.length);
    }

    return groups;
  },
};

export const group = {
  by: <T>(items: T[], keyExtractor: (item: T) => string) => $group.by(items, keyExtractor),
  byDate: <T>(
    items: T[],
    dateExtractor: (item: T) => Date,
    format?: 'day' | 'week' | 'month' | 'year',
    options: GroupOptions<T> = {}
  ) => $group.byDate(items, dateExtractor, format, options),
  byProperty: <T>(items: T[], propertyPath: string) => $group.byProperty(items, propertyPath),
  byFullDate: <T>(items: T[], dateExtractor: (item: T) => Date) => {
    return $group.by(items, (item) => $date(dateExtractor(item)).format.fullDate(), { preserveOriginalKey: true });
  },
};
