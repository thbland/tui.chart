import { getPercentageValue, isString, isNull } from './utils';
import { Rect, PieSeriesType, NestedPieSeriesType, PieDataLabels } from '@t/options';
import { TooltipData } from '@t/components/tooltip';
import { RawSeries, OptionsWithDataLabels } from '@t/store/store';

const semiCircleCenterYRatio = {
  COUNTER_CLOCKWISE: 0.1,
  CLOCKWISE: 1,
};

const MINIMUM_RADIUS = 10;

export function hasClockwiseSemiCircle(clockwise: boolean, startAngle: number, endAngle: number) {
  return (
    clockwise && ((startAngle >= -90 && endAngle <= 90) || (startAngle >= 90 && endAngle <= 180))
  );
}

export function hasCounterClockwiseSemiCircle(
  clockwise: boolean,
  startAngle: number,
  endAngle: number
) {
  return (
    !clockwise && ((startAngle >= -180 && endAngle <= 90) || (startAngle <= 90 && endAngle >= -90))
  );
}

export function getRadius(defaultRadius: number, radius: string | number): number {
  return isString(radius)
    ? Number(((defaultRadius * getPercentageValue(radius)) / 100).toFixed(2))
    : radius;
}

export function getTotalAngle(clockwise: boolean, startAngle: number, endAngle: number) {
  const totalAngle = Math.abs(endAngle - startAngle);

  return totalAngle !== 360 && !clockwise ? 360 - totalAngle : totalAngle;
}

export function isSemiCircle(clockwise: boolean, startAngle: number, endAngle: number) {
  return (
    getTotalAngle(clockwise, startAngle, endAngle) <= 180 &&
    (hasClockwiseSemiCircle(clockwise, startAngle, endAngle) ||
      hasCounterClockwiseSemiCircle(clockwise, startAngle, endAngle))
  );
}

export function getDefaultRadius(
  { width, height }: Rect,
  isSemiCircular = false,
  maxDataLabelWidth = 0,
  maxDataLabelHeight = 0
) {
  let result;

  if (isSemiCircular) {
    result = Math.min(width / 2, height) - maxDataLabelHeight;
  } else if (width > height) {
    result = height / 2 - maxDataLabelHeight;
  } else {
    result = width / 2 - maxDataLabelWidth;
  }

  return Math.max(result, MINIMUM_RADIUS);
}

export function getSemiCircleCenterY(rectHeight: number, clockwise: boolean) {
  return clockwise
    ? rectHeight * semiCircleCenterYRatio.CLOCKWISE
    : rectHeight * semiCircleCenterYRatio.COUNTER_CLOCKWISE;
}

export function makePieTooltipData(seriesRawData: PieSeriesType[], category = ''): TooltipData[] {
  return seriesRawData
    .filter(({ data }) => !isNull(data))
    .map<TooltipData>(({ data, name, color, rootParentName }) => ({
      label: name,
      color: color!,
      value: data!,
      category,
      rootParentName,
      templateType: 'pie',
    }));
}

export function hasNestedPieSeries(series: RawSeries) {
  return !!(series.pie && Array.isArray(series.pie[0].data));
}

export function getNestedPieChartAliasNames(series: RawSeries) {
  return (series.pie as NestedPieSeriesType[]).map(({ name }) => name);
}

export function pieTooltipLabelFormatter(percentValue: number) {
  const percentageString = percentValue.toFixed(2);
  const percent = parseFloat(percentageString);
  const needSlice = percentageString.length > 5;

  return `${needSlice ? parseFloat(percentageString.substr(0, 4)) : String(percent)}%`;
}

export function hasOuterDataLabel(options: OptionsWithDataLabels, series: RawSeries) {
  return !!series.pie && (options?.series?.dataLabels as PieDataLabels)?.anchor === 'outer';
}

export function hasOuterPieSeriesName(options: OptionsWithDataLabels, series: RawSeries) {
  return (
    !!series.pie &&
    (options?.series?.dataLabels as PieDataLabels)?.pieSeriesName?.anchor === 'outer'
  );
}
