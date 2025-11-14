export const root = {
  background: '{content.background}',
  borderColor: '{content.border.color}',
  color: '{content.color}',
  borderRadius: 'var(--radius-base)',
  shadow: '0 0.3rem 0.625rem 0 #0000001A',
  transitionDuration: '{transition.duration}',
};

export const list = {
  padding: '{navigation.list.padding}',
  gap: '1rem',
};

export const item = {
  focusBackground: 'transparent',
  color: 'var(--color-grey-500)',
  focusColor: '{navigation.item.focus.color}',
  padding: '{navigation.item.padding}',
  borderRadius: '{navigation.item.border.radius}',
  gap: '{navigation.item.gap}',
  icon: {
    color: '{navigation.item.icon.color}',
    focusColor: '{navigation.item.icon.focus.color}',
  },
};

export const submenuLabel = {
  padding: '{navigation.submenu.label.padding}',
  fontWeight: '{navigation.submenu.label.font.weight}',
  background: '{navigation.submenu.label.background.}',
  color: 'var(--color-grey-800)',
};

export const separator = {
  borderColor: 'var(--color-grey-50)',
};

export const menu = {
  root,
  list,
  item,
  submenuLabel,
  separator,
};
