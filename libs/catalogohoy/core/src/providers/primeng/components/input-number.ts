export const root = {
  transitionDuration: '{transition.duration}',
};

export const button = {
  width: '2.25rem',
  borderRadius: '0.75rem',
  verticalPadding: '{form.field.padding.y}',
};

export const colorScheme = {
  light: {
    button: {
      background: 'var(--color-grey-50)',
      hoverBackground: 'var(--color-grey-100)',
      activeBackground: 'var(--color-grey-200)',
      borderColor: 'var(--color-grey-100)',
      hoverBorderColor: 'var(--color-grey-100)',
      activeBorderColor: 'var(--color-grey-100)',
      color: 'var(--color-grey-800)',
      hoverColor: 'var(--color-grey-800)',
      activeColor: 'var(--color-grey-800)',
    },
  },
  dark: {
    button: {
      background: 'var(--color-grey-50)',
      hoverBackground: 'var(--color-grey-100)',
      activeBackground: 'var(--color-grey-200)',
      borderColor: 'var(--color-grey-100)',
      hoverBorderColor: 'var(--color-grey-100)',
      activeBorderColor: 'var(--color-grey-100)',
      color: 'var(--color-grey-800)',
      hoverColor: 'var(--color-grey-800)',
      activeColor: 'var(--color-grey-800)',
    },
  },
};

export default {
  root,
  button,
  colorScheme,
};
