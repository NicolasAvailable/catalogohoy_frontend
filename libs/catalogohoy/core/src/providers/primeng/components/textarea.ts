export const root = {
  background: '{form.field.background}',
  disabledBackground: 'var(--color-grey-50)',
  filledBackground: '{form.field.filled.background}',
  filledHoverBackground: '{form.field.filled.hover.background}',
  filledFocusBackground: '{form.field.filled.focus.background}',
  borderColor: 'var(--color-grey-100)',
  hoverBorderColor: 'var(--color-primary-500)',
  focusBorderColor: 'transparent',
  invalidBorderColor: '{form.field.invalid.border.color}',
  color: 'var(--color-grey-800)',
  disabledColor: '{form.field.disabled.color}',
  placeholderColor: 'var(--color-grey-200)',
  invalidPlaceholderColor: '{form.field.invalid.placeholder.color}',
  shadow: '{form.field.shadow}',
  paddingX: '{form.field.padding.x}',
  paddingY: '0.45rem',
  borderRadius: 'var(--radius-base)',
  focusRing: {
    width: '{form.field.focus.ring.width}',
    style: '{form.field.focus.ring.style}',
    color: 'var(--color-primary-500)',
    offset: '{form.field.focus.ring.offset}',
    shadow: '0 0 0 1px var(--color-primary-500)',
  },
  transitionDuration: '{form.field.transition.duration}',
  sm: {
    fontSize: '{form.field.sm.font.size}',
    paddingX: '{form.field.sm.padding.x}',
    paddingY: '.4rem',
  },
  lg: {
    fontSize: '{form.field.lg.font.size}',
    paddingX: '{form.field.lg.padding.x}',
    paddingY: '{form.field.lg.padding.y}',
  },
};

export const textarea = { root };
