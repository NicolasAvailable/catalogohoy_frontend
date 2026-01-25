export const root = {
  borderRadius: '.5rem',
  width: '1.5rem',
  height: '1.5rem',
  background: 'var(--color-white-500)',
  checkedBackground: 'var(--color-primary-500)',
  checkedHoverBackground: 'var(--color-primary-500)',
  disabledBackground: 'var(--color-grey-50)',
  filledBackground: 'var(--color-white-500)',
  borderColor: 'var(--color-grey-100)',
  hoverBorderColor: 'var(--color-grey-100)',
  focusBorderColor: 'var(--color-grey-100)',
  checkedBorderColor: 'var(--color-primary-500)',
  checkedHoverBorderColor: 'var(--color-primary-500)',
  checkedFocusBorderColor: 'var(--color-primary-500)',
  checkedDisabledBorderColor: 'var(--color-grey-100)',
  invalidBorderColor: 'var(--color-red-500)',
  shadow: '0',
  focusRing: {
    width: '0',
    style: '{form.field.focus.ring.style}',
    color: '{form.field.focus.ring.color}',
    offset: '{form.field.focus.ring.offset}',
    shadow: '{form.field.focus.ring.shadow}',
  },
  transitionDuration: '{form.field.transition.duration}',
  sm: {
    width: '1.25rem',
    height: '1.25rem',
  },
  lg: {
    width: '1.75rem',
    height: '1.75rem',
  },
};

export const icon = {
  size: '1rem',
  color: 'var(--color-white-500)',
  checkedColor: 'var(--color-white-500)',
  checkedHoverColor: 'var(--color-white-500)',
  disabledColor: 'var(--color-grey-300)',
  sm: {
    size: '0.75rem',
  },
  lg: {
    size: '1.25rem',
  },
};

export default {
  root,
  icon,
};
