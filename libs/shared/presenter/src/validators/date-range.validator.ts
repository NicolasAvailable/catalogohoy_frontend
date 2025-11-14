import { FormGroup, ValidationErrors } from '@angular/forms';

export const dateRangeValidator = (formGroup: FormGroup): ValidationErrors | null => {
  const startDate = formGroup.get('startDate');
  const endDate = formGroup.get('endDate');

  if (!startDate || !endDate || !startDate.value || !endDate.value) return null;

  const startDateValue = new Date(startDate.value);
  const endDateValue = new Date(endDate.value);

  if (isNaN(startDateValue.getTime()) || isNaN(endDateValue.getTime())) return null;

  return startDateValue >= endDateValue ? { dateRange: true } : null;
};
