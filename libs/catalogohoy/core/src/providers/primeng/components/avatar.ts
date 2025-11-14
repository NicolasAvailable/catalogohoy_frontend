export const root = {
  width: '1.625rem',
  height: '1.625rem',
  fontSize: '1rem',
  background: '{content.border.color}',
  color: 'var(--color-grey-800)',
  borderRadius: '{content.border.radius}',
};

export const icon = {
  size: '1rem',
};

export const group = {
  borderColor: '{content.background}',
  offset: '-0.75rem',
};

export const lg = {
  width: '2.25rem',
  height: '2.25rem',
  fontSize: '1.5rem',
  icon: {
    size: '1.5rem',
  },
  group: {
    offset: '-1rem',
  },
};

export const xl = {
  width: '3.125rem',
  height: '3.125rem',
  fontSize: '2rem',
  icon: {
    size: '2rem',
  },
  group: {
    offset: '-1.5rem',
  },
};

export const avatar = {
  root,
  icon,
  group,
  lg,
  xl,
};
