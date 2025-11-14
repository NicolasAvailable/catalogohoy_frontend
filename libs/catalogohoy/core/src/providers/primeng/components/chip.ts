export const root = {
  borderRadius: '1.5rem',
  paddingX: '0.625rem',
  paddingY: '0.625rem',
  gap: '0.5rem',
  transitionDuration: '{transition.duration}',
};

export const image = {
  width: '2rem',
  height: '2rem',
};

export const icon = {
  size: '1rem',
};

export const removeIcon = {
  size: '1rem',
  focusRing: {
    width: '{focus.ring.width}',
    style: '{focus.ring.style}',
    color: '{focus.ring.color}',
    offset: '{focus.ring.offset}',
    shadow: '{focus.ring.shadow}',
  },
};

export const colorScheme = {
  light: {
    root: {
      background: 'var(--color-white-500)',
      color: 'var(--color-grey-500)',
    },
    icon: {
      color: 'var(--color-grey-400)',
    },
    removeIcon: {
      color: 'var(--color-grey-300)',
    },
  },
  dark: {
    root: {
      background: 'var(--color-white-500)',
      color: 'var(--color-grey-500)',
    },
    icon: {
      color: 'var(--color-grey-300)',
    },
    removeIcon: {
      color: 'var(--color-grey-300)',
    },
  },
};

export default {
  root,
  image,
  icon,
  removeIcon,
  colorScheme,
};
