export const root = {
  transitionDuration: '{transition.duration}',
};

export const panel = {
  background: 'var(--color-white-500)',
  borderColor: 'transparent',
  color: 'var(--color-grey-800)',
  borderRadius: '0.75rem',
  shadow: '0px 4px 15px 0px #0000001F',
  padding: '1.25rem',
};

export const header = {
  background: 'var(--color-white-500)',
  borderColor: 'var(--color-grey-100)',
  color: 'var(--color-grey-800)',
  padding: '0 0 0.75rem 0',
};

export const title = {
  gap: '0.5rem',
  fontWeight: '700',
};

export const dropdown = {
  width: '2.5rem',
  sm: {
    width: '2rem',
  },
  lg: {
    width: '3rem',
  },
  borderColor: '{form.field.border.color}',
  hoverBorderColor: '{form.field.border.color}',
  activeBorderColor: '{form.field.border.color}',
  borderRadius: '{form.field.border.radius}',
  focusRing: {
    width: '{form.field.focus.ring.width}',
    style: '{form.field.focus.ring.style}',
    color: '{form.field.focus.ring.color}',
    offset: '{form.field.focus.ring.offset}',
    shadow: '{form.field.focus.ring.shadow}',
  },
};

export const inputIcon = {
  color: 'var(--color-grey-300)',
};

export const selectMonth = {
  hoverBackground: 'var(--color-grey-50)',
  color: 'var(--color-grey-800)',
  hoverColor: 'var(--color-grey-800)',
  padding: '0.375rem 0.625rem',
  borderRadius: 'var(--radius-base)',
};

export const selectYear = {
  hoverBackground: 'var(--color-grey-50)',
  color: 'var(--color-grey-800)',
  hoverColor: 'var(--color-grey-800)',
  padding: '0.375rem 0.625rem',
  borderRadius: 'var(--radius-base)',
};

export const group = {
  borderColor: 'var(--color-grey-100)',
  gap: 'var(--radius-base)',
};

export const dayView = {
  margin: '0.75rem 0 0 0',
};

export const weekDay = {
  padding: '0.375rem',
  fontWeight: '600',
  color: 'var(--color-grey-800)',
};

export const date = {
  hoverBackground: 'var(--color-grey-50)',
  selectedBackground: 'var(--color-secondary-500)',
  rangeSelectedBackground: 'var(--color-secondary-500)',
  color: 'var(--color-grey-800)',
  hoverColor: 'var(--color-grey-800)',
  selectedColor: '{primary.contrast.color}',
  rangeSelectedColor: '{highlight.color}',
  width: '1.75rem',
  height: '1.75rem',
  borderRadius: '50%',
  padding: '0.375rem',
  focusRing: {
    width: '{form.field.focus.ring.width}',
    style: '{form.field.focus.ring.style}',
    color: '{form.field.focus.ring.color}',
    offset: '{form.field.focus.ring.offset}',
    shadow: '{form.field.focus.ring.shadow}',
  },
};

export const monthView = {
  margin: '0.75rem 0 0 0',
};

export const month = {
  padding: '0.5rem',
  borderRadius: 'var(--radius-base)',
};

export const yearView = {
  margin: '0.75rem 0 0 0',
};

export const year = {
  padding: '0.5rem',
  borderRadius: 'var(--radius-base)',
};

export const buttonbar = {
  padding: '0.75rem 0 0 0',
  borderColor: 'var(--color-grey-100)',
};

export const timePicker = {
  padding: '0.75rem 0 0 0',
  borderColor: 'var(--color-grey-100)',
  gap: '0.5rem',
  buttonGap: '0.25rem',
};

export const colorScheme = {
  light: {
    dropdown: {
      background: 'var(--color-white-500)',
      hoverBackground: 'var(--color-white-100)',
      activeBackground: 'var(--color-white-200)',
      color: 'var(--color-white-600)',
      hoverColor: 'var(--color-white-700)',
      activeColor: 'var(--color-white-800)',
    },
    today: {
      background: 'var(--color-grey-50)',
      color: 'var(--color-grey-800)',
    },
  },
  dark: {
    dropdown: {
      background: 'var(--color-white-800)',
      hoverBackground: 'var(--color-white-700)',
      activeBackground: 'var(--color-white-600)',
      color: 'var(--color-white-300)',
      hoverColor: 'var(--color-white-200)',
      activeColor: 'var(--color-white-100)',
    },
    today: {
      background: 'var(--color-grey-50)',
      color: 'var(--color-grey-800)',
    },
  },
};

export default {
  root,
  panel,
  header,
  title,
  dropdown,
  inputIcon,
  selectMonth,
  selectYear,
  group,
  dayView,
  weekDay,
  date,
  monthView,
  month,
  yearView,
  year,
  buttonbar,
  timePicker,
  colorScheme,
};
