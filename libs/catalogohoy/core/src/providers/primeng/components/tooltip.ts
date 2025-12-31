export const root = {
  maxWidth: '12.5rem',
  gutter: '0.25rem',
  shadow: '{overlay.popover.shadow}',
  padding: '0.4rem 0.6rem',
  borderRadius: '{overlay.popover.border.radius}',
};

export const colorScheme = {
  light: {
    root: {
      background: 'var(--color-grey-900)',
      color: 'var(--color-white-500)',
    },
  },
  dark: {
    root: {
      background: '{surface.700}',
      color: '{surface.0}',
    },
  },
};

export default {
  root,
  colorScheme,
};
