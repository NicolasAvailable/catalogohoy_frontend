export const root = {
  transitionDuration: '{transition.duration}',
};

export const preview = {
  width: '0',
  height: '0',
  borderRadius: '{form.field.border.radius}',
  focusRing: {
    width: '{form.field.focus.ring.width}',
    style: '{form.field.focus.ring.style}',
    color: '{form.field.focus.ring.color}',
    offset: '{form.field.focus.ring.offset}',
    shadow: '{form.field.focus.ring.shadow}',
  },
};

export const panel = {
  shadow: 'none',
  borderRadius: 'var(--radius-base)',
};

export const colorScheme = {
  light: {
    panel: {
      background: 'transparent',
      borderColor: 'transparent',
    },
    handle: {
      color: 'var(--color-white-500)',
    },
  },
  dark: {
    panel: {
      background: 'transparent',
      borderColor: 'transparent',
    },
    handle: {
      color: 'var(--color-white-500)',
    },
  },
};

export default {
  root,
  preview,
  panel,
  colorScheme,
};
