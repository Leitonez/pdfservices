// Conversions-per-day bar chart, plain SVG.
// Single series (no legend: the card title names it), thin bars with a 4px rounded top anchored to the
// baseline, a 2px surface gap between bars, hairline grid, per-bar tooltip with hit areas taller and wider
// than the bars, and keyboard navigation. Long ranges are grouped into weeks so bars never get thinner than 4px.

import { formatNumber, formatMoney, formatDayKey } from '../format.js';
import { weekdayOf } from './dates.js';

const HEIGHT = 260;
const PAD_TOP = 14;
const AXIS_BAND = 30;
const PAD_RIGHT = 4;
const MIN_BAND = 6;
const MAX_BAR = 24;
const GAP = 2;
const BUCKETS = [1, 7, 14, 30];

function niceStep(raw) {
  if (raw <= 1) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  const bottom = y + h;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${bottom}Z`;
}

function plural(count) {
  return `${formatNumber(count)} ${count === 1 ? 'conversão' : 'conversões'}`;
}

export const UsageChart = {
  name: 'UsageChart',
  props: {
    series: { type: Array, required: true },
    refetching: { type: Boolean, default: false }
  },
  emits: ['unit'],
  data() {
    return { width: 0, active: -1, live: '', HEIGHT, PAD_TOP };
  },
  mounted() {
    this.width = Math.floor(this.$refs.wrap.clientWidth);
    this.observer = new ResizeObserver((entries) => {
      this.width = Math.floor(entries[0].contentRect.width);
    });
    this.observer.observe(this.$refs.wrap);
  },
  beforeUnmount() {
    this.observer.disconnect();
  },
  watch: {
    unit: {
      immediate: true,
      handler(value) {
        this.$emit('unit', value);
      }
    },
    series() {
      this.active = -1;
    }
  },
  computed: {
    bucketSize() {
      const n = this.series.length;
      if (!n || !this.width) {
        return 1;
      }
      const dayBand = (this.width - 48) / n;
      return BUCKETS.find((size) => dayBand * size >= MIN_BAND) || BUCKETS[BUCKETS.length - 1];
    },
    unit() {
      return this.bucketSize === 1 ? 'dia' : this.bucketSize === 7 ? 'semana' : `período de ${this.bucketSize} dias`;
    },
    buckets() {
      const size = this.bucketSize;
      const result = [];
      for (let i = 0; i < this.series.length; i += size) {
        const slice = this.series.slice(i, i + size);
        result.push({
          start: slice[0].date,
          end: slice[slice.length - 1].date,
          count: slice.reduce((sum, d) => sum + d.count, 0),
          amount: slice.reduce((sum, d) => sum + d.amount, 0)
        });
      }
      return result;
    },
    maxCount() {
      return this.buckets.reduce((max, b) => Math.max(max, b.count), 0);
    },
    scale() {
      const max = this.maxCount;
      if (max === 0) {
        return { step: 1, top: 4 };
      }
      const step = niceStep(max / 4);
      return { step, top: step * Math.ceil(max / step) };
    },
    padLeft() {
      return Math.max(28, formatNumber(this.scale.top).length * 7 + 14);
    },
    plotW() {
      return Math.max(0, this.width - this.padLeft - PAD_RIGHT);
    },
    plotH() {
      return HEIGHT - PAD_TOP - AXIS_BAND;
    },
    band() {
      return this.buckets.length ? this.plotW / this.buckets.length : 0;
    },
    barWidth() {
      return Math.min(MAX_BAR, Math.max(1, this.band - GAP));
    },
    ticks() {
      const { step, top } = this.scale;
      const ticks = [];
      for (let value = 0; value <= top; value += step) {
        ticks.push({ value, label: formatNumber(value), y: Math.round(PAD_TOP + this.plotH - (value / top) * this.plotH) + 0.5 });
      }
      return ticks;
    },
    bars() {
      const { top } = this.scale;
      return this.buckets.map((bucket, i) => {
        const h = bucket.count > 0 ? Math.max(2, (bucket.count / top) * this.plotH) : 0;
        const x = this.padLeft + i * this.band + (this.band - this.barWidth) / 2;
        const y = PAD_TOP + this.plotH - h;
        return { ...bucket, x, y, h, cx: x + this.barWidth / 2, path: h > 0 ? barPath(x, y, this.barWidth, h) : '' };
      });
    },
    xLabels() {
      if (!this.band) {
        return [];
      }
      const every = Math.max(1, Math.ceil(54 / this.band));
      const labels = [];
      this.bars.forEach((bar, i) => {
        if (i % every === 0) {
          labels.push({ key: bar.start, x: bar.cx, label: formatDayKey(bar.start) });
        }
      });
      return labels;
    },
    activeBar() {
      return this.active >= 0 ? this.bars[this.active] : null;
    },
    tooltipStyle() {
      const bar = this.activeBar;
      if (!bar) {
        return {};
      }
      const left = Math.min(Math.max(bar.cx, 80), this.width - 80);
      const top = Math.max(bar.y - 10, 64);
      return { left: left + 'px', top: top + 'px', transform: 'translate(-50%, -100%)' };
    },
    ariaLabel() {
      if (!this.series.length) {
        return 'Gráfico de conversões sem dados.';
      }
      const first = formatDayKey(this.series[0].date, true);
      const last = formatDayKey(this.series[this.series.length - 1].date, true);
      const total = this.buckets.reduce((sum, b) => sum + b.count, 0);
      return `Gráfico de barras: conversões por ${this.unit}, de ${first} a ${last}. Total: ${plural(total)}. `
        + 'Use as setas para a esquerda e para a direita para percorrer as barras. A visualização em tabela traz todos os valores.';
    }
  },
  methods: {
    dateLabel(bar) {
      if (bar.start === bar.end) {
        return `${weekdayOf(bar.start)}, ${formatDayKey(bar.start, true)}`;
      }
      return `${formatDayKey(bar.start)} a ${formatDayKey(bar.end, true)}`;
    },
    plural,
    formatMoney,
    announce() {
      const bar = this.activeBar;
      this.live = bar ? `${this.dateLabel(bar)}: ${plural(bar.count)}, ${formatMoney(bar.amount)}.` : '';
    },
    onKey(event) {
      const last = this.bars.length - 1;
      let next = this.active;
      if (event.key === 'ArrowRight') {
        next = Math.min(last, this.active + 1);
      } else if (event.key === 'ArrowLeft') {
        next = Math.max(0, this.active - 1);
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = last;
      } else {
        return;
      }
      event.preventDefault();
      this.active = next;
      this.announce();
    },
    onFocus() {
      if (this.active < 0 && this.bars.length) {
        this.active = this.bars.length - 1;
        this.announce();
      }
    },
    onBlur() {
      this.active = -1;
    }
  },
  template: `
    <div ref="wrap" class="chart-wrap" :class="{ 'is-refetching': refetching }" :style="{ minHeight: HEIGHT + 'px' }" @pointerleave="active = -1">
      <svg v-if="width" class="chart-svg" :width="width" :height="HEIGHT" :viewBox="'0 0 ' + width + ' ' + HEIGHT"
        role="img" :aria-label="ariaLabel" tabindex="0" @keydown="onKey" @focus="onFocus" @blur="onBlur">
        <g class="chart-grid" aria-hidden="true">
          <line v-for="t in ticks" :key="'g' + t.value" :x1="padLeft" :x2="width - 4" :y1="t.y" :y2="t.y"
            :class="{ 'chart-baseline': t.value === 0 }"></line>
        </g>
        <g aria-hidden="true">
          <text v-for="t in ticks" :key="'y' + t.value" class="chart-tick" :x="padLeft - 8" :y="t.y" text-anchor="end" dominant-baseline="middle">{{ t.label }}</text>
          <text v-for="l in xLabels" :key="'x' + l.key" class="chart-tick" :x="l.x" :y="HEIGHT - 9" text-anchor="middle">{{ l.label }}</text>
        </g>
        <rect v-if="activeBar" class="chart-band" aria-hidden="true" :x="padLeft + active * band" :y="PAD_TOP" :width="band" :height="plotH"></rect>
        <g aria-hidden="true">
          <template v-for="(bar, i) in bars" :key="'b' + bar.start">
            <path v-if="bar.h > 0" :d="bar.path" class="chart-bar" :class="{ 'is-active': i === active }"></path>
          </template>
        </g>
        <g aria-hidden="true">
          <rect v-for="(bar, i) in bars" :key="'h' + bar.start" class="chart-hit" :x="padLeft + i * band" :y="PAD_TOP - 6"
            :width="band" :height="plotH + 12" @pointerenter="active = i" @pointermove="active = i" @pointerdown="active = i"></rect>
        </g>
      </svg>
      <div v-if="width && maxCount === 0" class="chart-empty">Nenhuma conversão no período.</div>
      <div v-if="activeBar" class="chart-tooltip" :style="tooltipStyle" aria-hidden="true">
        <div class="tt-date">{{ dateLabel(activeBar) }}</div>
        <div class="tt-row"><span class="tt-key"></span><strong>{{ plural(activeBar.count) }}</strong></div>
        <div class="tt-amount">{{ formatMoney(activeBar.amount) }}</div>
      </div>
      <p class="sr-only" aria-live="polite">{{ live }}</p>
    </div>`
};
