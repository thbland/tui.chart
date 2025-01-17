import { StoreModule, RawSeries, Series, Categories } from '@t/store/store';
import { isNull, isNumber, sortCategories } from '@src/helpers/utils';
import { getCoordinateXValue } from '@src/helpers/coordinate';
import { getDataInRange } from '@src/helpers/range';

export function makeRawCategories(series: RawSeries | Series, categories?: Categories) {
  if (categories) {
    return categories;
  }

  const firstValues: Set<string | number> = new Set();

  Object.keys(series).forEach((key) => {
    if (key === 'pie') {
      return;
    }

    (series[key].data ?? series[key]).forEach(({ data, name }) => {
      if (Array.isArray(data)) {
        data.forEach((datum) => {
          if (!isNull(datum)) {
            const rawXValue = getCoordinateXValue(datum);

            firstValues.add(isNumber(rawXValue) ? rawXValue : rawXValue.toString());
          }
        });
      } else if (key === 'bullet') {
        firstValues.add(name);
      }
    });
  });

  return Array.from(firstValues)
    .sort(sortCategories)
    .map((category) => String(category));
}

const category: StoreModule = {
  name: 'category',
  state: ({ categories, series }) => ({
    categories: makeRawCategories(series, categories),
  }),
  action: {
    setCategory({ state, computed }) {
      const { viewRange } = computed;
      let categories = state.rawCategories;

      if (viewRange) {
        if (Array.isArray(categories)) {
          categories = getDataInRange(categories, viewRange);
        } else {
          categories = {
            ...categories,
            x: getDataInRange(categories.x, viewRange),
          };
        }
      }

      state.categories = categories;

      this.notify(state, 'categories');
    },
    initCategory({ initStoreState, state }) {
      const { zoomRange } = state;
      let categories = makeRawCategories(initStoreState.series);
      if (zoomRange && Array.isArray(categories)) {
        categories = getDataInRange(categories, zoomRange);
      }

      state.categories = categories;

      this.notify(state, 'categories');
    },
  },
  observe: {
    updateCategory() {
      this.dispatch('setCategory');
    },
  },
};

export default category;
