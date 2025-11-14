export const root = {
  borderRadius: '{border.radius.md}',
  padding: '0 0.5rem',
  fontSize: '0.75rem',
  fontWeight: '700',
  minWidth: '1.5rem',
  height: '1.5rem',
};

export const dot = {
  size: '0.5rem',
};

export const sm = {
  fontSize: '0.625rem',
  minWidth: '1rem',
  height: '1rem',
};

export const lg = {
  fontSize: '0.875rem',
  minWidth: '1.55rem',
  height: '1.75rem',
};

export const xl = {
  fontSize: '1rem',
  minWidth: '2rem',
  height: '2rem',
};

export const colorScheme = {
  light: {
    primary: {
      background: '{primary.color}',
      color: '{primary.contrast.color}',
    },
    secondary: {
      background: '{surface.100}',
      color: '{surface.600}',
    },
    success: {
      background: 'var(--color-green-500)',
      color: '#fff',
    },
    info: {
      background: 'var(--color-blue-500)',
      color: '#fff',
    },
    warn: {
      background: 'var(--color-orange-500)',
      color: '#fff',
    },
    danger: {
      background: 'var(--color-red-500)',
      color: '#fff',
    },
    contrast: {
      background: '{surface.950}',
      color: '{surface.0}',
    },
  },
  dark: {
    primary: {
      background: '{primary.color}',
      color: '{primary.contrast.color}',
    },
    secondary: {
      background: '{surface.800}',
      color: '{surface.300}',
    },
    success: {
      background: 'var(--color-green-500)',
      color: '#fff',
    },
    info: {
      background: 'var(--color-blue-400)',
      color: '#fff',
    },
    warn: {
      background: 'var(--color-orange-500)',
      color: '#fff',
    },
    danger: {
      background: 'var(--color-red-500)',
      color: '#fff',
    },
    contrast: {
      background: '{surface.0}',
      color: '{surface.950}',
    },
  },
};

export const badge = {
  root,
  dot,
  sm,
  lg,
  xl,
  colorScheme,
};
