export interface TimeSeriesPoint {
  x: number; // timestamp ms
  y: number;
}

export interface ChartSeries {
  name: string;
  data: TimeSeriesPoint[] | number[];
}

export interface SparklineMetric {
  amount: number;
  labels: string[];
  series: ChartSeries[];
}

export interface DonutMetric {
  uniqueVisitors: number;
  series: number[];
  labels: string[];
}

export interface ActiveHoursData {
  /** 7×24 matrix — dayIndex: 0=Dom, 1=Lun, …, 6=Sáb; innerIndex: hour 0-23 */
  byPageViews: number[][];
  byUniqueUsers: number[][];
}

export type PageViewsPeriod = 'today' | 'one-month' | 'one-year';

export interface AnalyticsData {
  pageViews: {
    series: Record<PageViewsPeriod, ChartSeries[]>;
  };
  sessions: SparklineMetric;
  pageViewsMetric: SparklineMetric;
  users: SparklineMetric;
  activeHours: ActiveHoursData;
  browser: DonutMetric;
  os: DonutMetric;
  device: DonutMetric;
  language: DonutMetric;
}
