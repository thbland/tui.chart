import {
  Axes,
  AxisData,
  CenterYAxisData,
  Options,
  RadialAxisData,
  ScaleData,
  Series,
  StoreModule,
  ValueEdge,
  ChartOptionsUsingYAxis,
  ChartState,
  LabelAxisData,
  ValueAxisData,
  InitAxisData,
  Layout,
  Categories,
} from '@t/store/store';
import {
  getAxisName,
  getSizeKey,
  hasBoxTypeSeries,
  isLabelAxisOnYAxis,
  isPointOnColumn,
  getYAxisOption,
  getAutoAdjustingInterval,
  getAxisTheme,
  getViewAxisLabels,
  hasAxesLayoutChanged,
  getRotatableOption,
  makeFormattedCategory,
  getMaxLabelSize,
  makeTitleOption,
  makeRotationData,
  getLabelXMargin,
} from '@src/helpers/axes';
import { makeLabelsFromLimit, getAxisLabelAnchorPoint } from '@src/helpers/calculator';
import {
  BaseAxisOptions,
  BarTypeYAxisOption,
  BaseXAxisOptions,
  LineTypeXAxisOptions,
  BoxSeriesOptions,
  RangeDataType,
  Rect,
  LineTypeSeriesOptions,
  RadarChartOptions,
} from '@t/options';
import { deepMergedCopy, hasNegativeOnly, isNumber, pickProperty } from '@src/helpers/utils';
import { isZooming } from '@src/helpers/range';
import { isCoordinateSeries } from '@src/helpers/coordinate';
import { AxisTheme } from '@t/theme';
import { AxisType } from '@src/component/axis';
import { getTitleFontString } from '@src/helpers/style';

interface StateProp {
  scale: ScaleData;
  axisSize: number;
  options: Options;
  series: Series;
  theme: Required<AxisTheme>;
  centerYAxis?: Pick<CenterYAxisData, 'xAxisHalfSize'> | null;
  zoomRange?: RangeDataType<number>;
  initialAxisData: InitAxisData;
  labelOnYAxis?: boolean;
  axisName: string;
}

type ValueStateProp = StateProp & {
  categories: string[];
  rawCategories: string[];
  isCoordinateTypeChart: boolean;
};

type LabelAxisState = Omit<LabelAxisData, 'tickInterval' | 'labelInterval'>;
type ValueAxisState = Omit<ValueAxisData, 'tickInterval' | 'labelInterval'>;

type SecondaryYAxisParam = {
  state: ChartState<Options>;
  labelOnYAxis: boolean;
  valueAxisSize: number;
  labelAxisSize: number;
  labelAxisName: string;
  valueAxisName: string;
  initialAxisData: InitAxisData;
  isCoordinateTypeChart: boolean;
};

interface AxisDataParams {
  axis?: BaseAxisOptions | BaseXAxisOptions | LineTypeXAxisOptions;
  categories?: string[];
  layout?: Layout;
  shift?: boolean;
  isCoordinateTypeChart?: boolean;
}

export function isCenterYAxis(options: ChartOptionsUsingYAxis, isBar: boolean) {
  const diverging = !!pickProperty(options, ['series', 'diverging']);
  const alignCenter = (options.yAxis as BarTypeYAxisOption)?.align === 'center';

  return isBar && diverging && alignCenter;
}

function isDivergingBoxSeries(series: Series, options: Options) {
  return hasBoxTypeSeries(series) && !!(options.series as BoxSeriesOptions)?.diverging;
}

function getZeroPosition(
  limit: ValueEdge,
  axisSize: number,
  labelAxisOnYAxis: boolean,
  isDivergingSeries: boolean
) {
  const { min, max } = limit;
  const hasZeroValue = min <= 0 && max >= 0;

  if (!hasZeroValue || isDivergingSeries) {
    return null;
  }

  const position = ((0 - min) / (max - min)) * axisSize;

  return labelAxisOnYAxis ? position : axisSize - position;
}

function getAxisFormatter(options: Options, axisName: string) {
  const axisOptions = {
    ...getYAxisOption(options),
    xAxis: options.xAxis,
  };

  return axisOptions[axisName]?.label?.formatter ?? ((value) => value);
}

export function getLabelAxisData(stateProp: ValueStateProp): LabelAxisState {
  const {
    axisSize,
    categories,
    series,
    options,
    theme,
    scale,
    zoomRange,
    rawCategories,
    initialAxisData,
    isCoordinateTypeChart,
    axisName,
  } = stateProp;
  const pointOnColumn = isPointOnColumn(series, options);
  const labelsBeforeFormatting =
    !isZooming(rawCategories, zoomRange) && isCoordinateTypeChart
      ? makeLabelsFromLimit(scale.limit, scale.stepSize, options)
      : makeFormattedCategory(categories, options?.xAxis?.date);
  const formatter = getAxisFormatter(options, axisName);
  // @TODO: regenerate label when exceeding max width
  const labels = labelsBeforeFormatting.map((label, index) =>
    formatter(label, { index, labels: labelsBeforeFormatting, axisName })
  );

  const tickIntervalCount = categories.length - (pointOnColumn ? 0 : 1);
  const tickDistance = tickIntervalCount ? axisSize / tickIntervalCount : axisSize;
  const labelDistance = axisSize / (labels.length - (pointOnColumn ? 0 : 1));
  const tickCount = labels.length + (pointOnColumn ? 1 : 0);
  const viewLabels = getViewAxisLabels(
    {
      labels,
      pointOnColumn,
      tickDistance,
      tickCount,
      ...initialAxisData,
    },
    axisSize
  );
  const axisLabelMargin = getLabelXMargin(axisName, options);

  return {
    labels,
    viewLabels,
    pointOnColumn,
    labelDistance,
    tickDistance,
    tickCount,
    isLabelAxis: true,
    ...initialAxisData,
    ...getMaxLabelSize(labels, axisLabelMargin, getTitleFontString(theme.label)),
  };
}

function getValueAxisData(stateProp: StateProp): ValueAxisState {
  const {
    scale,
    axisSize,
    series,
    options,
    centerYAxis,
    initialAxisData,
    theme,
    labelOnYAxis,
    axisName,
  } = stateProp;

  const { limit, stepSize } = scale;
  const size = centerYAxis ? centerYAxis?.xAxisHalfSize : axisSize;
  const divergingBoxSeries = isDivergingBoxSeries(series, options);
  const formatter = getAxisFormatter(options, axisName);
  const zeroPosition = getZeroPosition(
    limit,
    axisSize,
    isLabelAxisOnYAxis(series, options),
    divergingBoxSeries
  );
  let valueLabels = makeLabelsFromLimit(limit, stepSize);

  if (!centerYAxis && divergingBoxSeries) {
    valueLabels = getDivergingValues(valueLabels);
  }
  const labels = valueLabels.map((label, index) =>
    formatter(label, { index, labels: valueLabels, axisName })
  );

  const tickDistance = size / Math.max(valueLabels.length, 1);
  const tickCount = valueLabels.length;
  const pointOnColumn = false;
  const viewLabels = getViewAxisLabels(
    {
      labels: labelOnYAxis ? labels : [...labels].reverse(),
      pointOnColumn,
      tickDistance,
      tickCount,
      ...initialAxisData,
    },
    size
  );
  const axisLabelMargin = getLabelXMargin(axisName, options);

  const axisData: ValueAxisState = {
    labels,
    viewLabels,
    pointOnColumn,
    isLabelAxis: false,
    tickCount,
    tickDistance,
    ...initialAxisData,
    ...getMaxLabelSize(labels, axisLabelMargin, getTitleFontString(theme.label)),
  };

  if (isNumber(zeroPosition)) {
    axisData.zeroPosition = zeroPosition;
  }

  return axisData;
}

function getDivergingValues(valueLabels) {
  return hasNegativeOnly(valueLabels)
    ? valueLabels.reverse().slice(1).concat(valueLabels)
    : valueLabels.slice(1).reverse().concat(valueLabels);
}

function getRadialAxis(
  scale: ScaleData,
  plot: Rect,
  theme: Required<AxisTheme>,
  { labelInterval }: InitAxisData,
  options: RadarChartOptions
): RadialAxisData {
  const { limit, stepSize } = scale;
  const { width, height } = plot;
  const valueLabels = makeLabelsFromLimit(limit, stepSize);
  const formatter = getAxisFormatter(options, 'yAxis');
  const labels = valueLabels.map((label) => formatter(label));
  const axisSize = Math.min(width, height) / 2 - 50;

  return {
    labels,
    axisSize,
    centerX: width / 2,
    centerY: height / 2,
    labelInterval,
    ...getMaxLabelSize(labels, 0, getTitleFontString(theme.label)),
  };
}

function getInitTickInterval(categories?: string[], layout?: Layout) {
  if (!categories || !layout) {
    return 1;
  }

  const { width } = layout.xAxis;
  const count = categories.length;

  return getAutoAdjustingInterval(count, width, categories);
}

function getInitAxisIntervalData(isLabelAxis: boolean, params: AxisDataParams) {
  const { axis, categories, layout, isCoordinateTypeChart } = params;

  const tickInterval = axis?.tick?.interval;
  const labelInterval = axis?.label?.interval;
  const existIntervalOptions = isNumber(tickInterval) || isNumber(labelInterval);

  const needAdjustInterval =
    isLabelAxis &&
    !isNumber(axis?.scale?.stepSize) &&
    !params.shift &&
    !existIntervalOptions &&
    !isCoordinateTypeChart;

  const initTickInterval = needAdjustInterval ? getInitTickInterval(categories, layout) : 1;
  const initLabelInterval = needAdjustInterval ? initTickInterval : 1;

  const axisData: InitAxisData = {
    tickInterval: tickInterval ?? initTickInterval,
    labelInterval: labelInterval ?? initLabelInterval,
  };

  return axisData;
}

function makeDefaultAxisData(isLabelAxis: boolean, params: AxisDataParams): InitAxisData {
  const axisData = getInitAxisIntervalData(isLabelAxis, params);
  const title = makeTitleOption(params?.axis?.title);

  if (title) {
    axisData.title = title;
  }

  return axisData;
}

function getInitialAxisData(
  options: Options,
  labelOnYAxis: boolean,
  categories: string[],
  layout: Layout,
  isCoordinateTypeChart: boolean
) {
  const { yAxis, secondaryYAxis } = getYAxisOption(options);
  const shift = (options?.series as LineTypeSeriesOptions)?.shift;

  return {
    xAxis: makeDefaultAxisData(!labelOnYAxis, {
      categories,
      axis: options?.xAxis,
      layout,
      shift,
      isCoordinateTypeChart,
    }),
    yAxis: makeDefaultAxisData(labelOnYAxis, { axis: yAxis }),
    secondaryYAxis: secondaryYAxis
      ? makeDefaultAxisData(labelOnYAxis, { axis: secondaryYAxis })
      : null,
  };
}

function getSecondaryYAxisData({
  state,
  labelOnYAxis,
  valueAxisSize,
  labelAxisSize,
  initialAxisData,
  isCoordinateTypeChart,
}: SecondaryYAxisParam): LabelAxisState | ValueAxisState {
  const { scale, options, series, zoomRange, theme } = state;
  const categories = state.categories as string[];
  const rawCategories = state.rawCategories as string[];

  return labelOnYAxis
    ? getLabelAxisData({
        scale: scale.secondaryYAxis!,
        axisSize: labelAxisSize,
        categories: getYAxisOption(options).secondaryYAxis?.categories ?? categories,
        rawCategories,
        options,
        series,
        theme: getAxisTheme(theme, AxisType.SECONDARY_Y),
        zoomRange,
        initialAxisData,
        isCoordinateTypeChart,
        axisName: AxisType.SECONDARY_Y,
      })
    : getValueAxisData({
        scale: scale.secondaryYAxis!,
        axisSize: valueAxisSize,
        options,
        series,
        theme: getAxisTheme(theme, AxisType.SECONDARY_Y),
        centerYAxis: null,
        initialAxisData,
        axisName: AxisType.SECONDARY_Y,
      });
}

function makeXAxisData({ axisData, axisSize, centerYAxis, rotatable, labelMargin = 0 }): AxisData {
  const { viewLabels, pointOnColumn, maxLabelWidth, maxLabelHeight } = axisData;
  const offsetY = getAxisLabelAnchorPoint(maxLabelHeight) + labelMargin;
  const size = centerYAxis ? centerYAxis.xAxisHalfSize : axisSize;
  const distance = size / (viewLabels.length - (pointOnColumn ? 0 : 1));
  const rotationData = makeRotationData(maxLabelWidth, maxLabelHeight, distance, rotatable);
  const { needRotateLabel, rotationHeight } = rotationData;
  const maxHeight = (needRotateLabel ? rotationHeight : maxLabelHeight) + offsetY;

  return {
    ...axisData,
    ...rotationData,
    maxHeight,
    offsetY,
  };
}

function getAxisInfo(labelOnYAxis: boolean, plot: Rect) {
  const { valueAxisName, labelAxisName } = getAxisName(labelOnYAxis);
  const { valueSizeKey, labelSizeKey } = getSizeKey(labelOnYAxis);
  const valueAxisSize = plot[valueSizeKey];
  const labelAxisSize = plot[labelSizeKey];

  return { valueAxisName, valueAxisSize, labelAxisName, labelAxisSize };
}

function getCategoriesWithTypes(categories?: Categories, rawCategories?: Categories) {
  return {
    categories: (categories as string[]) ?? [],
    rawCategories: (rawCategories as string[]) ?? [],
  };
}

const axes: StoreModule = {
  name: 'axes',
  state: ({ series, options }) => {
    const { secondaryYAxis } = getYAxisOption(options);
    const axesState: Axes = {
      xAxis: {} as AxisData,
      yAxis: {} as AxisData,
    };

    if (isCenterYAxis(options, !!series.bar)) {
      axesState.centerYAxis = {} as CenterYAxisData;
    }

    if (series.radar) {
      axesState.radialAxis = {} as RadialAxisData;
    }

    if (secondaryYAxis) {
      axesState.secondaryYAxis = {} as AxisData;
    }

    return {
      axes: axesState,
    };
  },
  action: {
    setAxesData({ state }) {
      const { scale, options, series, layout, zoomRange, theme } = state;
      const { xAxis, yAxis, plot } = layout;

      const labelOnYAxis = isLabelAxisOnYAxis(series, options);
      const { categories, rawCategories } = getCategoriesWithTypes(
        state.categories,
        state.rawCategories
      );
      const { valueAxisName, valueAxisSize, labelAxisName, labelAxisSize } = getAxisInfo(
        labelOnYAxis,
        plot
      );
      const hasCenterYAxis = state.axes.centerYAxis;
      const isCoordinateTypeChart = isCoordinateSeries(series);

      const initialAxisData = getInitialAxisData(
        options,
        labelOnYAxis,
        categories as string[],
        layout,
        isCoordinateTypeChart
      );

      const valueAxisData = getValueAxisData({
        scale: scale[valueAxisName],
        axisSize: valueAxisSize,
        options,
        series,
        theme: getAxisTheme(theme, valueAxisName),
        centerYAxis: hasCenterYAxis
          ? {
              xAxisHalfSize: (xAxis.width - yAxis.width) / 2,
            }
          : null,
        initialAxisData: initialAxisData[valueAxisName],
        labelOnYAxis,
        axisName: valueAxisName,
      });

      const labelAxisData = getLabelAxisData({
        scale: scale[labelAxisName],
        axisSize: labelAxisSize,
        categories,
        rawCategories,
        options,
        series,
        theme: getAxisTheme(theme, labelAxisName),
        zoomRange,
        initialAxisData: initialAxisData[labelAxisName],
        isCoordinateTypeChart,
        labelOnYAxis,
        axisName: labelAxisName,
      });

      let secondaryYAxis, centerYAxis, radialAxis;

      if (state.axes.secondaryYAxis) {
        secondaryYAxis = getSecondaryYAxisData({
          state,
          labelOnYAxis,
          valueAxisSize,
          labelAxisSize,
          labelAxisName,
          valueAxisName,
          initialAxisData: initialAxisData.secondaryYAxis!,
          isCoordinateTypeChart,
        }) as AxisData;
      }

      if (hasCenterYAxis) {
        const xAxisHalfSize = (xAxis.width - yAxis.width) / 2;
        centerYAxis = deepMergedCopy(valueAxisData, {
          x: xAxis.x + xAxisHalfSize,
          xAxisHalfSize,
          secondStartX: (xAxis.width + yAxis.width) / 2,
          yAxisLabelAnchorPoint: yAxis.width / 2,
          yAxisHeight: yAxis.height,
        }) as CenterYAxisData;
      }

      if (state.axes.radialAxis) {
        radialAxis = getRadialAxis(
          scale[valueAxisName],
          plot,
          getAxisTheme(theme, valueAxisName),
          initialAxisData.yAxis,
          options as RadarChartOptions
        );
      }
      const axesState = {
        xAxis: makeXAxisData({
          axisData: labelOnYAxis ? valueAxisData : labelAxisData,
          axisSize: labelOnYAxis ? valueAxisSize : labelAxisSize,
          centerYAxis,
          rotatable: getRotatableOption(options),
          labelMargin: options.xAxis?.label?.margin,
        }),
        yAxis: labelOnYAxis ? labelAxisData : valueAxisData,
        secondaryYAxis,
        centerYAxis,
        radialAxis,
      } as Axes;

      if (hasAxesLayoutChanged(state.axes, axesState)) {
        this.notify(state, 'layout');
      }

      state.axes = axesState;
    },
  },
  computed: {},
  observe: {
    updateAxes() {
      this.dispatch('setAxesData');
    },
  },
};

export default axes;
