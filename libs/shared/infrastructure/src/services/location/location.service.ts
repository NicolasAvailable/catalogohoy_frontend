import { Injectable, signal } from '@angular/core';
import { euCountries } from '@ui';

@Injectable({ providedIn: 'root' })
export class LocationService {
  public readonly location = signal<Location | undefined>(undefined);

  public get values() {
    return this.location() as Location;
  }

  public get countryCode() {
    return this.values?.countryCode ?? '';
  }

  public get isEu(): boolean {
    return euCountries.includes(this.values.country);
  }

  public async init() {
    const url = `https://api-serverless.socialgest.net/sg_user/geo`;
    const response = await fetch(url);
    const result = await response.json();
    this.location.set(result.data as Location);
  }
}

export type Location = {
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  timezone: string;
};
