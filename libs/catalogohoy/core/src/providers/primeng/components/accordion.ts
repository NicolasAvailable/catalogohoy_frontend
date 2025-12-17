export const root = {
  transitionDuration: '{transition.duration}',
};

export const panel = {
  borderWidth: '0',
  borderColor: 'var(--color-grey-50)',
};

export const header = {
  color: 'var(--color-grey-500)',
  hoverColor: 'var(--color-grey-500)',
  activeColor: 'var(--color-grey-500)',
  activeHoverColor: 'var(--color-grey-500)',
  padding: '1.5rem',
  fontWeight: '700',
  borderRadius: 'var(--radius-base)',
  borderWidth: '1px 1px 1px 1px',
  borderColor: 'var(--color-grey-50)',
  focusRing: {
    width: '{focus.ring.width}',
    style: '{focus.ring.style}',
    color: '{focus.ring.color}',
    offset: '{focus.ring.offset}',
    shadow: 'inset {focus.ring.shadow}',
  },
  toggleIcon: {
    color: '{text.muted.color}',
    hoverColor: '{text.color}',
    activeColor: '{text.color}',
    activeHoverColor: '{text.color}',
  },
  first: {
    topBorderRadius: '{content.border.radius}',
    borderWidth: '1px',
  },
  last: {
    bottomBorderRadius: '{content.border.radius}',
    activeBottomBorderRadius: '0',
  },
};

export const content = {
  borderWidth: '0 1px 1px 1px',
  borderColor: 'var(--color-grey-50)',
  background: 'var(--color-white-500)',
  color: 'var(--color-grey-500)',
  padding: '0',
};

export const colorScheme = {
  light: {
    header: {
      background: 'var(--color-white-500)',
      hoverBackground: 'var(--color-white-500)',
      activeBackground: 'var(--color-white-500)',
      activeHoverBackground: 'var(--color-white-500)',
    },
  },
  dark: {
    header: {
      background: 'var(--color-white-500)',
      hoverBackground: 'var(--color-white-500)',
      activeBackground: 'var(--color-white-500)',
      activeHoverBackground: 'var(--color-white-500)',
    },
  },
};

export default {
  root,
  panel,
  header,
  content,
  colorScheme,
};
