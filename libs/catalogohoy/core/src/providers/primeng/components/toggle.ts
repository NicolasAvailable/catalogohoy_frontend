export const root = {
  width: '3.5rem',
  height: '2rem',
  borderRadius: '2.3rem',
  gap: '0.25rem',
  shadow: '{form.field.shadow}',
  focusRing: {
    width: '{form.field.focus.ring.width}',
    style: '{form.field.focus.ring.style}',
    color: 'var(--color-secondary-500)',
    offset: '{form.field.focus.ring.offset}',
    shadow: '{form.field.focus.ring.shadow}',
  },
  borderWidth: '0',
  borderColor: 'transparent',
  hoverBorderColor: 'transparent',
  checkedBorderColor: 'transparent',
  checkedHoverBorderColor: 'transparent',
  invalidBorderColor: '{form.field.invalid.border.color}',
  transitionDuration: '{form.field.transition.duration}',
  slideDuration: '0.2s',
};

export const handle = {
  borderRadius: '50%',
  size: '1.25rem',
};

export const colorScheme = {
  light: {
    root: {
      background: 'var(--color-grey-100)',
      disabledBackground: 'var(--color-grey-50)',
      hoverBackground: 'var(--color-grey-100)',
      checkedBackground: '{secondary.color}',
      checkedHoverBackground: '{secondary.hover.color}',
    },
    handle: {
      background: 'var(--color-white-500)',
      disabledBackground: 'var(--color-grey-100)',
      hoverBackground: 'var(--color-white-500)',
      checkedBackground: 'var(--color-white-500)',
      checkedHoverBackground: 'var(--color-white-500)',
      color: 'var(--color-grey-100)',
      hoverColor: '{text.color}',
      checkedColor: '{secondary.color}',
      checkedHoverColor: '{secondary.hover.color}',
    },
  },
  dark: {
    root: {
      background: 'var(--color-grey-100)',
      disabledBackground: '{surface.600}',
      hoverBackground: 'var(--color-grey-100)',
      checkedBackground: '{secondary.color}',
      checkedHoverBackground: '{secondary.hover.color}',
    },
    handle: {
      background: 'var(--color-white-500)',
      disabledBackground: '{surface.900}',
      hoverBackground: 'var(--color-white-500)',
      checkedBackground: 'var(--color-white-500)',
      checkedHoverBackground: 'var(--color-white-500)',
      color: '{surface.900}',
      hoverColor: '{surface.800}',
      checkedColor: '{secondary.color}',
      checkedHoverColor: '{secondary.hover.color}',
    },
  },
};

export const toggle = {
  root,
  handle,
  colorScheme,
};
