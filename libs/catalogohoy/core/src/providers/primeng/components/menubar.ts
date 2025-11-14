export const root = {
  borderColor: 'transparent',
  borderRadius: 'var(--radius-base)',
  color: 'var(--color-grey-800)',
  gap: '1rem',
  padding: '.7rem 0',
  transitionDuration: '{transition.duration}',
};

export const baseItem = {
  borderRadius: '0',
  padding: '0.75rem 1rem',
};

export const item = {
  focusBackground: 'transparent',
  activeBackground: 'transparent',
  color: 'var(--color-grey-800)',
  focusColor: 'var(--color-grey-800)',
  activeColor: 'var(--color-grey-800)',
  padding: '{navigation.item.padding}',
  borderRadius: '0',
  gap: '{navigation.item.gap}',
  icon: {
    color: 'var(--color-grey-800)',
    focusColor: 'var(--color-grey-800)',
    activeColor: 'var(--color-grey-800)',
  },
};

export const submenu = {
  padding: '1rem 1.5rem .75rem .5rem',
  gap: '1rem',
  background: '{content.background}',
  borderColor: 'transparent',
  borderRadius: '0',
  shadow: '0 0.3rem 0.625rem 0 #00000014',
  mobileIndent: '1.25rem',
  icon: {
    size: '{navigation.submenu.icon.size}',
    color: 'var(--color-grey-800)',
    focusColor: 'var(--color-grey-800)',
    activeColor: 'var(--color-grey-800)',
  },
};

export const separator = {
  borderColor: '{content.border.color}',
};

export const mobileButton = {
  borderRadius: '50%',
  size: '2rem',
  color: '{text.muted.color}',
  hoverColor: '{text.hover.muted.color}',
  hoverBackground: '{content.hover.background}',
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
      background: '#fff',
    },
  },
  dark: {
    root: {
      background: '{surface.800}',
    },
  },
};

export const menubar = {
  root,
  baseItem,
  item,
  submenu,
  separator,
  mobileButton,
  colorScheme,
};
