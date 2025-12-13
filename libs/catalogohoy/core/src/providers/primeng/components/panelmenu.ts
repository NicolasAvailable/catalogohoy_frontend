import type {
  PanelMenuDesignTokens,
  PanelMenuTokenSections,
} from '@primeuix/themes/types/panelmenu';

export const root: PanelMenuTokenSections.Root = {
  gap: '0',
  transitionDuration: '{transition.duration}',
};

export const panel: PanelMenuTokenSections.Panel = {
  background: 'transparent',
  borderColor: 'none',
  borderWidth: '',
  color: '{content.color}',
  padding: '0.25rem 0.25rem',
  borderRadius: '0',
  first: {
    borderWidth: '0px',
    topBorderRadius: '0',
  },
  last: {
    borderWidth: '0px',
    bottomBorderRadius: '0',
  },
};

export const item: PanelMenuTokenSections.Item = {
  focusBackground: '{navigation.item.focus.background}',
  color: '{navigation.item.color}',
  focusColor: '{navigation.item.focus.color}',
  gap: '0.5rem',
  padding: '{navigation.item.padding}',
  borderRadius: '{content.border.radius}',
  icon: {
    color: '{navigation.item.icon.color}',
    focusColor: '{navigation.item.icon.focus.color}',
  },
};

export const submenu: PanelMenuTokenSections.Submenu = {
  indent: '1rem',
};

export const submenuIcon: PanelMenuTokenSections.SubmenuIcon = {
  color: '{navigation.submenu.icon.color}',
  focusColor: '{navigation.submenu.icon.focus.color}',
};

export default {
  root,
  panel,
  item,
  submenu,
  submenuIcon,
} satisfies PanelMenuDesignTokens;
