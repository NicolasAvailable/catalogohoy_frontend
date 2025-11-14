import { clone, concat, mergeDeepRight, uniqBy } from 'ramda';
import { is } from '../../either/either.builder';

export const $object = {
  are: (object: object) => {
    return {
      all: {
        empty: Object.values(object).every((value) => value === null || value === undefined || value === ''),
      },
    };
  },

  action: (object: object) => {
    return {
      merge: (target: object) => mergeDeepRight(object, target),
      clone: () => clone(object),
      uniqueById: <T extends { id: string | number }>(target: T[]): T[] =>
        uniqBy((item: T) => item.id, concat(target, object as T[])),
    };
  },

  getValue: (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  },
};

export const object = {
  clone: <T extends object>(object: T) => $object.action(object).clone() as T,
  merge: <T extends object>(origin: T, target: object) => $object.action(origin).merge(target),
  getValue: (obj: Record<string, unknown>, path: string): unknown => $object.getValue(obj, path),
  all: {
    empty: (object: object) => is.affirmative($object.are(object).all.empty),
  },
  array: {
    uniqueById: <T extends { id: string | number }>(origin: T[], target: T[]): T[] =>
      $object.action(origin).uniqueById(target),
  },
};
