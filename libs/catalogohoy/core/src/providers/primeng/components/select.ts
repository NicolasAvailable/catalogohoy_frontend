export const root = {
  background: '{form.field.background}',
  disabledBackground: '{form.field.disabled.background}',
  filledBackground: '{form.field.filled.background}',
  filledHoverBackground: '{form.field.filled.hover.background}',
  filledFocusBackground: '{form.field.filled.focus.background}',
  borderColor: 'var(--color-grey-100)',
  hoverBorderColor: 'var(--color-grey-100)',
  focusBorderColor: 'var(--color-grey-100)',
  invalidBorderColor: '{form.field.invalid.border.color}',
  color: 'var(--color-grey-300)',
  disabledColor: '{form.field.disabled.color}',
  placeholderColor: 'var(--color-grey-200)',
  invalidPlaceholderColor: '{form.field.invalid.placeholder.color}',
  shadow: '{form.field.shadow}',
  paddingX: '{form.field.padding.x}',
  paddingY: '0.5rem',
  borderRadius: 'var(--radius-base)',
  focusRing: {
    width: '0rem',
    style: '{form.field.focus.ring.style}',
    color: 'transparent',
    offset: '{form.field.focus.ring.offset}',
    shadow: 'transparent',
  },
  transitionDuration: '{form.field.transition.duration}',
  sm: {
    fontSize: '{form.field.sm.font.size}',
    paddingX: '{form.field.sm.padding.x}',
    paddingY: '{form.field.sm.padding.y}',
  },
  lg: {
    fontSize: '{form.field.lg.font.size}',
    paddingX: '{form.field.lg.padding.x}',
    paddingY: '0.65rem',
  },
};

export const dropdown = {
  width: '2.5rem',
  color: 'var(--color-grey-300)',
};

export const overlay = {
  background: '{overlay.select.background}',
  borderColor: '{overlay.select.border.color}',
  borderRadius: '{overlay.select.border.radius}',
  color: '{overlay.select.color}',
  shadow: '{overlay.select.shadow}',
};

export const list = {
  padding: '{list.padding}',
  gap: '{list.gap}',
  header: {
    padding: '{list.header.padding}',
  },
};

export const option = {
  focusBackground: 'var(--color-white-700)',
  selectedBackground: 'var(--color-secondary-50)',
  selectedFocusBackground: 'var(--color-secondary-50)',
  color: 'var(--color-grey-500)',
  focusColor: '{list.option.focus.color}',
  selectedColor: 'var(--color-secondary-500)',
  selectedFocusColor: 'var(--color-secondary-500)',
  padding: '{list.option.padding}',
  borderRadius: '{list.option.border.radius}',
};

export const optionGroup = {
  background: '{list.option.group.background}',
  color: '{list.option.group.color}',
  fontWeight: '{list.option.group.font.weight}',
  padding: '{list.option.group.padding}',
};

export const clearIcon = {
  color: 'var(--color-grey-300)',
};

export const checkmark = {
  color: 'var(--color-grey-300)',
  gutterStart: '-0.5rem',
  gutterEnd: '0.5rem',
};

export const emptyMessage = {
  padding: '{list.option.padding}',
};

export const select = {
  root,
  dropdown,
  overlay,
  list,
  option,
  optionGroup,
  clearIcon,
  checkmark,
  emptyMessage,
};
