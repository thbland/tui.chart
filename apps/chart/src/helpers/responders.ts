import {
  BoxPlotResponderModel,
  BulletResponderModel,
  CircleModel,
  CircleResponderModel,
  HeatmapRectResponderModel,
  SectorResponderModel,
  RectResponderModel,
  TreemapRectResponderModel,
  ResponderModel,
} from '@t/components/series';
import { LineTypeEventDetectType, Point, Rect } from '@t/options';
import { getDistance } from '@src/helpers/calculator';
import { AxisData } from '@t/store/store';
import { range } from '@src/helpers/utils';
import { TooltipData } from '@t/components/tooltip';

export type RespondersThemeType = 'select' | 'hover';
export interface SelectedSeriesEventModel {
  models: ResponderModel[];
  comparisonModel: ResponderModel[];
  name: string;
  eventDetectType?: LineTypeEventDetectType;
  alias?: string;
}

// eslint-disable-next-line complexity
export function isSameSeriesResponder({
  models,
  comparisonModel,
  name,
  eventDetectType,
}: SelectedSeriesEventModel) {
  switch (name) {
    case 'heatmap':
      return isClickSameNameResponder<HeatmapRectResponderModel>(
        models as HeatmapRectResponderModel[],
        comparisonModel as HeatmapRectResponderModel[]
      );
    case 'bullet':
      return eventDetectType === 'grouped'
        ? isClickSameGroupedRectResponder(
            models as RectResponderModel[],
            comparisonModel as RectResponderModel[]
          )
        : isClickSameNameResponder<BulletResponderModel>(
            models as BulletResponderModel[],
            comparisonModel as BulletResponderModel[]
          );
    case 'radar':
    case 'bubble':
    case 'scatter':
    case 'area':
    case 'line':
      return isClickSameCircleResponder(
        models as CircleResponderModel[],
        comparisonModel as CircleResponderModel[]
      );
    case 'pie':
      return isClickSameDataResponder<SectorResponderModel>(
        models as SectorResponderModel[],
        comparisonModel as SectorResponderModel[]
      );
    case 'column':
    case 'bar':
      return eventDetectType === 'grouped'
        ? isClickSameGroupedRectResponder(
            models as RectResponderModel[],
            comparisonModel as RectResponderModel[]
          )
        : isClickSameDataResponder<RectResponderModel>(
            models as RectResponderModel[],
            comparisonModel as RectResponderModel[]
          );
    case 'boxPlot':
      return eventDetectType === 'grouped'
        ? isClickSameDataResponder<BoxPlotResponderModel>(
            models as BoxPlotResponderModel[],
            comparisonModel as BoxPlotResponderModel[]
          )
        : isClickSameBoxPlotDataResponder(
            models as BoxPlotResponderModel[],
            comparisonModel as BoxPlotResponderModel[]
          );
    case 'treemap':
      return isClickSameLabelResponder(
        models as TreemapRectResponderModel[],
        comparisonModel as TreemapRectResponderModel[]
      );
    default:
      return false;
  }
}

export function getNearestResponder(
  responders: CircleResponderModel[],
  mousePosition: Point,
  rect: Rect
) {
  let minDistance = Infinity;
  let result: CircleResponderModel[] = [];

  responders.forEach((responder) => {
    const { x, y, radius } = responder;
    const responderPoint = { x: x + rect.x, y: y + rect.y };
    const distance = getDistance(responderPoint, mousePosition);

    if (minDistance > distance) {
      minDistance = distance;
      result = [responder];
    } else if (minDistance === distance) {
      if (result.length && result[0].radius > radius) {
        result = [responder];
      } else {
        result.push(responder);
      }
    }
  });

  return result;
}

export function makeRectResponderModel(
  rect: Rect,
  axis: AxisData,
  categories: string[],
  vertical = true
): RectResponderModel[] {
  const { pointOnColumn, tickCount, tickDistance } = axis;
  const { width, height } = rect;
  const halfDetectAreaIndex = pointOnColumn ? [] : [0, tickCount - 1];
  const halfSize = tickDistance / 2;

  return range(0, tickCount).map((index) => {
    const half = halfDetectAreaIndex.includes(index);
    const size = half ? halfSize : tickDistance;
    let startPos = 0;

    if (index !== 0) {
      startPos += pointOnColumn ? tickDistance * index : halfSize + tickDistance * (index - 1);
    }

    return {
      type: 'rect',
      y: vertical ? 0 : startPos,
      height: vertical ? height : size,
      x: vertical ? startPos : 0,
      width: vertical ? size : width,
      index,
      label: categories[index],
    };
  });
}

export function makeTooltipCircleMap(
  seriesCircleModel: CircleModel[],
  tooltipDataArr: TooltipData[]
) {
  const dataMap = tooltipDataArr.reduce<TooltipData[][]>((acc, cur) => {
    const { index, seriesIndex } = cur;

    if (!acc[seriesIndex!]) {
      acc[seriesIndex!] = [];
    }
    acc[seriesIndex!][index!] = cur;

    return acc;
  }, []);

  return seriesCircleModel.reduce<Record<string, CircleResponderModel[]>>((acc, model) => {
    const { seriesIndex, index } = model;
    const data = dataMap[seriesIndex!][index!];

    const { category } = data;
    if (!category) {
      return acc;
    }

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ ...model, data });

    return acc;
  }, {});
}

export function getDeepestNode(responders: TreemapRectResponderModel[]) {
  return responders.reduce<TreemapRectResponderModel[]>((acc, responder) => {
    if (!acc.length || responder.depth > acc[0].depth) {
      return [responder];
    }

    return acc;
  }, []);
}

export function isClickSameNameResponder<
  T extends HeatmapRectResponderModel | BulletResponderModel
>(responders: T[], selectedSeries?: T[]) {
  return (
    responders.length && selectedSeries?.length && responders[0].name === selectedSeries[0].name
  );
}

export function isClickSameCircleResponder(
  responders: CircleResponderModel[],
  selectedSeries?: CircleResponderModel[]
) {
  let same = false;
  if (responders.length && selectedSeries?.length && responders.length === selectedSeries.length) {
    same = responders.reduce<boolean>((acc, cur, idx) => {
      return (
        acc &&
        cur.seriesIndex === selectedSeries[idx].seriesIndex &&
        cur.index === selectedSeries[idx].index
      );
    }, true);
  }

  return same;
}

export function isClickSameDataResponder<
  T extends RectResponderModel | BoxPlotResponderModel | SectorResponderModel
>(responders: T[], selectedSeries?: T[]) {
  let same = false;
  if (responders.length && selectedSeries?.length && responders.length === selectedSeries.length) {
    same = responders.reduce<boolean>((acc, cur, idx) => {
      return (
        acc &&
        cur.data?.label === selectedSeries[idx].data?.label &&
        cur.data?.category === selectedSeries[idx].data?.category
      );
    }, true);
  }

  return same;
}

export function isClickSameLabelResponder(
  responders: TreemapRectResponderModel[],
  selectedSeries?: TreemapRectResponderModel[]
) {
  return (
    responders.length && selectedSeries?.length && responders[0].label === selectedSeries[0].label
  );
}

export function isClickSameGroupedRectResponder(
  responders: RectResponderModel[],
  selectedSeries?: RectResponderModel[]
) {
  return (
    responders.length && selectedSeries?.length && responders[0].index === selectedSeries[0].index
  );
}

export function isClickSameBoxPlotDataResponder(
  responders: BoxPlotResponderModel[],
  selectedSeries?: BoxPlotResponderModel[]
) {
  let same = false;
  if (responders.length && selectedSeries?.length) {
    const { type, data } = responders[0];
    same =
      type === selectedSeries[0].type &&
      data?.label === selectedSeries[0].data?.label &&
      data?.category === selectedSeries[0].data?.category;
  }

  return same;
}
