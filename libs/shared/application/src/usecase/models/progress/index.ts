import { UseCaseProgressBuilder } from './builder.model';

export * from './progress.model';
export const progressBuilder = () => new UseCaseProgressBuilder();
