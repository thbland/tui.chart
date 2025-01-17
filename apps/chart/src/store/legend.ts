import {
  LegendIconType,
  Options,
  RawSeries,
  StoreModule,
  ChartType,
  Series,
  Legend,
  CircleLegend,
  LegendDataList,
} from '@t/store/store';
import { Align, BubbleChartOptions, TreemapChartSeriesOptions } from '@t/options';
import { isUndefined, sum, includes, deepMergedCopy, isNumber } from '@src/helpers/utils';

import {
  LEGEND_CHECKBOX_SIZE,
  LEGEND_ICON_SIZE,
  LEGEND_ITEM_MARGIN_X,
  LEGEND_MARGIN_X,
} from '@src/brushes/legend';
import { getTextWidth } from '@src/helpers/calculator';
import { isVerticalAlign, padding } from '@src/store/layout';
import { spectrumLegendBar, spectrumLegendTooltip } from '@src/brushes/spectrumLegend';
import { hasNestedPieSeries } from '@src/helpers/pieSeries';
import { extend } from '@src/store/store';
import { getTitleFontString } from '@src/helpers/style';
import { makeDefaultTheme } from '@src/helpers/theme';

type LegendLabels = {
  label: string;
  type: ChartType;
}[];

type LegendWidthParam = {
  defaultWidth: number;
  legendWidths: number[];
  useSpectrumLegend: boolean;
  options: Options;
  align: Align;
  visible: boolean;
  checkbox: boolean;
};

function calculateLegendWidth({
  defaultWidth,
  legendWidths,
  useSpectrumLegend,
  options,
  align,
  visible,
  checkbox,
}: LegendWidthParam) {
  const verticalAlign = isVerticalAlign(align);
  const legendOptions = options?.legend;
  let legendWidth = defaultWidth;

  if (!visible) {
    return 0;
  }

  if (legendOptions?.width) {
    return legendOptions.width;
  }

  if (useSpectrumLegend && verticalAlign) {
    const labelAreaWidth = sum(legendWidths);
    legendWidth = Math.max(getInitialWidth(options) / 4, labelAreaWidth);
  } else if (useSpectrumLegend && !verticalAlign) {
    const spectrumAreaWidth =
      spectrumLegendTooltip.PADDING * 2 +
      spectrumLegendBar.PADDING * 2 +
      spectrumLegendTooltip.POINT_HEIGHT +
      spectrumLegendBar.HEIGHT +
      padding.X * 2;

    legendWidth = Math.max(...legendWidths) + spectrumAreaWidth;
  } else if (!useSpectrumLegend && verticalAlign) {
    legendWidth = sum(legendWidths) + LEGEND_ITEM_MARGIN_X * (legendWidths.length - 1);
  } else {
    const labelAreaWidth = Math.max(...legendWidths);
    legendWidth =
      (checkbox ? LEGEND_CHECKBOX_SIZE + LEGEND_MARGIN_X : 0) +
      LEGEND_ICON_SIZE +
      LEGEND_MARGIN_X +
      Math.max(labelAreaWidth, legendWidth);
  }

  return legendWidth;
}

export function showCircleLegend(options: BubbleChartOptions) {
  return isUndefined(options?.circleLegend?.visible) ? true : !!options?.circleLegend?.visible;
}

function showLegend(options: Options, series: Series | RawSeries) {
  if (series.treemap && !(options.series as TreemapChartSeriesOptions)?.useColorValue) {
    return false;
  }

  return isUndefined(options.legend?.visible) ? true : !!options.legend?.visible;
}

function showCheckbox(options: Options) {
  return isUndefined(options.legend?.showCheckbox) ? true : !!options.legend?.showCheckbox;
}

function getNestedPieLegendLabels(series: RawSeries) {
  const result: LegendLabels = [];

  series.pie!.forEach(({ data }) => {
    data.forEach(({ name, parentName }) => {
      if (!parentName) {
        result.push({
          label: name,
          type: 'pie',
        });
      }
    });
  });

  return result;
}

function getLegendLabels(series: RawSeries): LegendLabels {
  return Object.keys(series).flatMap((type) =>
    series[type].map(({ name, colorValue }) => ({
      label: colorValue ? colorValue : name,
      type,
    }))
  );
}

function useRectIcon(type: ChartType) {
  return includes(['bar', 'column', 'area', 'pie', 'boxPlot', 'bullet'], type);
}

function useCircleIcon(type: ChartType) {
  return includes(['bubble', 'scatter'], type);
}

function useLineIcon(type: ChartType) {
  return includes(['line', 'radar'], type);
}

function getIconType(type: ChartType): LegendIconType {
  let iconType: LegendIconType = 'spectrum';

  if (useCircleIcon(type)) {
    iconType = 'circle';
  } else if (useRectIcon(type)) {
    iconType = 'rect';
  } else if (useLineIcon(type)) {
    iconType = 'line';
  }

  return iconType;
}

function getAlign(options: Options) {
  return isUndefined(options.legend?.align) ? 'right' : (options.legend?.align as Align);
}

function getItemWidth(
  label: string,
  checkboxVisible: boolean,
  useSpectrumLegend: boolean,
  font: string
) {
  return (
    (useSpectrumLegend
      ? 0
      : (checkboxVisible ? LEGEND_CHECKBOX_SIZE + LEGEND_MARGIN_X : 0) +
        LEGEND_ICON_SIZE +
        LEGEND_MARGIN_X) + getTextWidth(label, font)
  );
}

function getInitialWidth(options: Options) {
  return isNumber(options.chart?.width) ? options.chart!.width : 0;
}

function getLegendDataAppliedTheme(data: LegendDataList, series: Series) {
  const colors = Object.values(series).reduce<string[]>(
    (acc, cur) => (cur && cur.colors ? [...acc, ...cur.colors] : acc),
    []
  );

  return data.map((datum, idx) => ({
    ...datum,
    color: colors[idx],
  }));
}

function getLegendState(options: Options, series: RawSeries): Legend {
  const checkboxVisible = showCheckbox(options);
  const useSpectrumLegend =
    (options?.series as TreemapChartSeriesOptions)?.useColorValue ?? !!series.heatmap;
  const useScatterChartIcon = !!series?.scatter;
  const defaultTheme = makeDefaultTheme(options?.theme?.chart?.fontFamily);
  const font = getTitleFontString(
    deepMergedCopy(defaultTheme.legend.label!, { ...options.theme?.legend?.label })
  );

  const legendLabels = hasNestedPieSeries(series)
    ? getNestedPieLegendLabels(series)
    : getLegendLabels(series);

  const data = legendLabels.map(({ label, type }) => ({
    label,
    active: true,
    checked: true,
    width: getItemWidth(label, checkboxVisible, useSpectrumLegend, font),
    iconType: getIconType(type),
    chartType: type,
  }));

  return {
    useSpectrumLegend,
    useScatterChartIcon,
    data,
  } as Legend;
}

const legend: StoreModule = {
  name: 'legend',
  state: ({ options, series }) => {
    return {
      legend: getLegendState(options, series) as Legend,
      circleLegend: {} as CircleLegend,
    };
  },
  action: {
    initLegendState({ state, initStoreState }) {
      extend(state.legend, getLegendState(initStoreState.options, initStoreState.series));
    },
    setLegendLayout({ state, initStoreState }) {
      const {
        legend: { data: legendData, useSpectrumLegend },
        series,
        options,
      } = state;
      const align = getAlign(options);
      const visible = showLegend(options, series);
      const checkbox = showCheckbox(options);
      const initialWidth = Math.min(getInitialWidth(options) / 10, 150);
      const legendWidths = legendData.map(({ width }) => width);
      const legendWidth = calculateLegendWidth({
        defaultWidth: initialWidth,
        legendWidths,
        useSpectrumLegend,
        options,
        align,
        visible,
        checkbox,
      });

      const isNestedPieChart = hasNestedPieSeries(initStoreState.series);
      const isScatterChart = !!series.scatter;

      const circleLegendWidth = isVerticalAlign(align)
        ? initialWidth
        : Math.max(initialWidth, legendWidth);
      const circleLegendVisible = series.bubble
        ? showCircleLegend(options as BubbleChartOptions)
        : false;

      extend(state.legend, {
        visible,
        align,
        showCheckbox: checkbox,
        width: legendWidth,
      });

      extend(state.circleLegend, {
        visible: circleLegendVisible,
        width: circleLegendVisible ? circleLegendWidth : 0,
        radius: circleLegendVisible ? Math.max((circleLegendWidth - LEGEND_MARGIN_X) / 2, 0) : 0,
      });

      if (!isNestedPieChart) {
        this.dispatch('updateLegendColor');
      }
      if (isScatterChart) {
        this.dispatch('updateLegendIcon');
      }
    },
    setLegendActiveState({ state }, { name, active }) {
      const { data } = state.legend;
      const model = data.find(({ label }) => label === name)!;
      model.active = active;
      this.notify(state, 'legend');
    },
    setAllLegendActiveState({ state }, active: boolean) {
      state.legend.data.forEach((datum) => {
        datum.active = active;
      });
      this.notify(state, 'legend');
    },
    setLegendCheckedState({ state }, { name, checked }) {
      const model = state.legend.data.find(({ label }) => label === name)!;
      model.checked = checked;
      this.notify(state, 'legend');
    },
    updateLegendColor({ state }) {
      const { legend: legendData, series, options } = state;
      const useSpectrumLegend =
        (options?.series as TreemapChartSeriesOptions)?.useColorValue ?? !!series.heatmap;

      const data = useSpectrumLegend
        ? legendData.data
        : getLegendDataAppliedTheme(legendData.data, series);
      extend(state.legend, { data });
    },
    updateLegendIcon({ state }) {
      const { legend: legendData, series } = state;

      const data = legendData.data.reduce<LegendDataList>((acc, cur) => {
        if (cur.chartType === 'scatter' && series.scatter?.data) {
          const model = series.scatter.data.find(({ name }) => name === cur.label);
          const iconType = model ? model.iconType : cur.iconType;

          return [...acc, { ...cur, iconType }];
        }

        return [...acc, cur];
      }, []);

      extend(state.legend, { data });
    },
    updateNestedPieChartLegend({ state }) {
      const { legend: legendData, nestedPieSeries } = state;
      extend(state.legend, {
        data: getLegendDataAppliedTheme(legendData.data, nestedPieSeries),
      });
    },
  },
  observe: {
    updateLegendLayout() {
      this.dispatch('setLegendLayout');
    },
  },
};

export default legend;
