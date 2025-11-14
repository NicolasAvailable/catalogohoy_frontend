export const root = {
  transitionDuration: '{transition.duration}',
};

export const tablist = {
  borderWidth: '0 0 1px 0',
  background: 'transparent',
  borderColor: 'var(--color-grey-50)',
};

export const tab = {
  borderWidth: '0 0 5px 0',
  borderColor: 'transparent',
  hoverBorderColor: 'transparent',
  activeBorderColor: '{primary.color}',
  color: 'var(--color-grey-300)',
  hoverColor: '{text.color}',
  activeColor: 'var(--color-grey-800)',
  padding: '0rem 1.25rem 1rem 1.25rem',
  fontWeight: '700',
  margin: '0',
  gap: '0.5rem',
  focusRing: {
    width: '{focus.ring.width}',
    style: '{focus.ring.style}',
    color: '{focus.ring.color}',
    offset: '{focus.ring.offset}',
    shadow: 'inset {focus.ring.shadow}',
  },
};

export const tabpanel = {
  background: 'transparent',
  color: '{content.color}',
  padding: '2.5rem 0 0 0',
  focusRing: {
    width: '{focus.ring.width}',
    style: '{focus.ring.style}',
    color: '{focus.ring.color}',
    offset: '{focus.ring.offset}',
    shadow: 'inset {focus.ring.shadow}',
  },
};

export const navButton = {
  background: '{content.background}',
  color: '{text.muted.color}',
  hoverColor: '{text.color}',
  width: '2.5rem',
  focusRing: {
    width: '{focus.ring.width}',
    style: '{focus.ring.style}',
    color: '{focus.ring.color}',
    offset: '{focus.ring.offset}',
    shadow: 'inset {focus.ring.shadow}',
  },
};

export const activeBar = {
  height: '0',
  bottom: '0',
  background: 'transparent',
};

export const colorScheme = {
  light: {
    navButton: {
      shadow: '0px 0px 10px 50px rgba(255, 255, 255, 0.6)',
    },
    tab: {
      background: 'transparent',
      hoverBackground: 'transparent',
      activeBackground: 'transparent',
    },
  },
  dark: {
    navButton: {
      shadow: '0px 0px 10px 50px color-mix(in srgb, {content.background}, transparent 50%)',
    },
    tab: {
      background: 'transparent',
      hoverBackground: '{surface.700}',
      activeBackground: 'transparent',
    },
  },
};

export const tabs = {
  root,
  tablist,
  tab,
  tabpanel,
  navButton,
  activeBar,
  colorScheme,
};
