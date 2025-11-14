import { UseCaseProgress } from './progress.model';

export class UseCaseProgressBuilder {
  private start = '';
  private complete: string | Error = '';

  public withStart(value: string): this {
    this.start = value;
    return this;
  }

  public withComplete(value: string | Error): this {
    this.complete = value;
    return this;
  }

  public build(): UseCaseProgress {
    return UseCaseProgress.from({ start: this.start, complete: this.complete });
  }
}
