import { FormBuilder, FormGroup } from '@angular/forms';
import { dateRangeValidator } from '../date-range.validator';

describe('dateRangeValidator', () => {
  let formGroup: FormGroup;
  const formBuilder = new FormBuilder();

  const createFormGroup = (startDate: string | Date | null, endDate: string | Date | null): FormGroup => {
    return formBuilder.group(
      {
        startDate: [startDate],
        endDate: [endDate],
      },
      { validators: [dateRangeValidator] }
    );
  };

  it('should return null when startDate is before endDate', () => {
    const startDate = new Date('2024-01-15T10:00:00');
    const endDate = new Date('2024-01-15T12:00:00');
    formGroup = createFormGroup(startDate, endDate);

    const result = dateRangeValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should return validation error when startDate is after endDate', () => {
    const startDate = new Date('2024-01-15T12:00:00');
    const endDate = new Date('2024-01-15T10:00:00');
    formGroup = createFormGroup(startDate, endDate);

    const result = dateRangeValidator(formGroup);

    expect(result).toEqual({ dateRange: true });
    expect(formGroup.valid).toBeFalsy();
  });

  it('should return validation error when startDate equals endDate', () => {
    const sameDate = new Date('2024-01-15T10:00:00');
    formGroup = createFormGroup(sameDate, sameDate);

    const result = dateRangeValidator(formGroup);

    expect(result).toEqual({ dateRange: true });
    expect(formGroup.valid).toBeFalsy();
  });

  it('should return null when both date fields are empty', () => {
    formGroup = createFormGroup(null, null);

    const result = dateRangeValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should return null when one date field is empty', () => {
    const date = new Date('2024-01-15T10:00:00');
    
    formGroup = createFormGroup(date, null);
    expect(dateRangeValidator(formGroup)).toBeNull();
    expect(formGroup.valid).toBeTruthy();

    formGroup = createFormGroup(null, date);
    expect(dateRangeValidator(formGroup)).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should work with string date formats', () => {
    formGroup = createFormGroup('2024-01-15T10:00:00', '2024-01-15T12:00:00');
    expect(dateRangeValidator(formGroup)).toBeNull();
    expect(formGroup.valid).toBeTruthy();

    formGroup = createFormGroup('2024-01-15T12:00:00', '2024-01-15T10:00:00');
    expect(dateRangeValidator(formGroup)).toEqual({ dateRange: true });
    expect(formGroup.valid).toBeFalsy();
  });

  it('should return null when dates are invalid', () => {
    formGroup = createFormGroup('invalid-date', 'another-invalid-date');

    const result = dateRangeValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should handle different date formats correctly', () => {
    // ISO string format
    formGroup = createFormGroup('2024-01-15T10:00:00.000Z', '2024-01-15T12:00:00.000Z');
    expect(dateRangeValidator(formGroup)).toBeNull();

    // Date string format
    formGroup = createFormGroup('January 15, 2024 10:00:00', 'January 15, 2024 12:00:00');
    expect(dateRangeValidator(formGroup)).toBeNull();

    // Timestamp format (as Date objects)
    const startTimestamp = new Date(new Date('2024-01-15T10:00:00').getTime());
    const endTimestamp = new Date(new Date('2024-01-15T12:00:00').getTime());
    formGroup = createFormGroup(startTimestamp, endTimestamp);
    expect(dateRangeValidator(formGroup)).toBeNull();
  });

  it('should validate across different days', () => {
    const startDate = new Date('2024-01-15T23:00:00');
    const endDate = new Date('2024-01-16T01:00:00');
    formGroup = createFormGroup(startDate, endDate);

    const result = dateRangeValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should validate with millisecond precision', () => {
    const startDate = new Date('2024-01-15T10:00:00.100');
    const endDate = new Date('2024-01-15T10:00:00.200');
    formGroup = createFormGroup(startDate, endDate);

    const result = dateRangeValidator(formGroup);

    expect(result).toBeNull();
    expect(formGroup.valid).toBeTruthy();
  });

  it('should handle edge case where form controls do not exist', () => {
    const emptyFormGroup = formBuilder.group({});

    const result = dateRangeValidator(emptyFormGroup);

    expect(result).toBeNull();
  });
});
