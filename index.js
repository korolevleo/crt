const LINEAR_SCALE_ANIMATION_DURATION = 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SECONDS_IN_DAY = 1000 * 60 * 60 * 24;
const ANIMATION_DEBOUNCE = 200;
const THEME = {
    dark: 'rgba(180, 180, 180, 0.5)',
    weakDark: 'rgba(180, 180, 180, 0.3)',
    light: 'rgba(180, 180, 180, 0.2)'
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

class BaseChart {

    constructor(chartContainer) {
        this.hiddenLines = [];
        this.scaleX = 1;
        this.scaleY = -1;
        this.translateX = this.translateY = 0;
        this.chartContainer = chartContainer;
        this.chartContainer.style.overflow = 'hidden';
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        this.svg.setAttribute('width', chartContainer.offsetWidth);
        this.svg.setAttribute('height', chartContainer.offsetHeight);
        this.chartContainer.appendChild(this.svg);
        this.width = chartContainer.offsetWidth;
        this.height = chartContainer.offsetHeight;
        this.minX = this.minY = Infinity;
        this.maxX = this.maxY = -Infinity;
    }

    drawChart(valsX, valsYArr, colors) {
        this.valsX = valsX;
        this.valsYArr = valsYArr;
        this.normalize(valsX, valsYArr);
        this.lines = [];
        let i = 0;
        for (let valsY of valsYArr) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", 'polyline');
            line.setAttribute('stroke', colors[i]);
            line.setAttribute('stroke-width', '1');
            let lineVertices = '';
            for (let i = 0; i < valsX.length; i++) {
                lineVertices += `${this.normalizeX(valsX[i])},${this.normalizeY(valsY[i])} `;
            }
            line.setAttribute('points', lineVertices);
            line.setAttribute('fill', 'none');
            this.svg.appendChild(line);
            this.lines.push(line);
            i++;
        }
        this.transform();
    }

    extrude(x, y) {
        this.scaleX = x === undefined ? this.scaleX : x;
        this.scaleY = y === undefined ? this.scaleY : y;
        this.transform();
    }

    translate(x, y) {
        this.translateX = x === undefined ? this.translateX : x;
        this.translateY = y === undefined ? this.translateY : y;
        this.transform();
    }

    transform() {
        this.svg.setAttribute('transform',
            `scale(${this.scaleX}, ${this.scaleY}), translate(${this.translateX}, ${this.translateY})`);
    }

    normalize(valsX, valsYArr) {
        this.minX = Math.min(this.minX, Math.min(...valsX));
        this.minY = Math.min(this.minY, ...valsYArr.map((valsY) => Math.min(...valsY)));
        this.maxX = Math.max(this.maxX, Math.max(...valsX));
        this.maxY = Math.max(this.maxY, ...valsYArr.map((valsY) => Math.max(...valsY)));
        this.rateX = this.width / (this.maxX - this.minX);
        this.rateY = this.height / this.maxY;
    }

    normalizeX(x) {
        return (x - this.minX) * this.rateX;
    }

    normalizeY(y) {
        return y * this.rateY;
    }

    changeHidden(n) {
        if (this.hiddenLines.indexOf(n) < 0) {
            this.hiddenLines.push(n);
        } else {
            this.hiddenLines = this.hiddenLines.filter(l => l !== n);
        }
        if (this.redraw) {
            this.redraw();
        }
    }
}

class LeveledChart extends BaseChart {

    constructor (chartContainer) {
        super(chartContainer);
    }

    destroy() {
        while (this.linesSvg.firstChild()) {
            this.linesSvg.firstChild().remove();
        }
        this.linesSvg.remove();
        this.linesSvg = undefined;
        this.svgContainer.remove();
        this.linesSvgContainer = undefined;
        this.destroyBase;
    }

    animateLinesFade(linesSvg, linesSvgContainer, up) {
        linesSvg.animate(
            [
                { transform: 'scale(1, 1)', opacity: 1 }, 
                { transform: `scale(1, ${up ? 1.5 : 0.75})`, opacity: 0.3, offset: 0.5 },
                { transform: `scale(1, ${up ? 1.5 : 0.75})`, opacity: 0 }
            ],
            { duration: LINEAR_SCALE_ANIMATION_DURATION },
        );
        linesSvgContainer.animate(
            [
                { transform: 'translateY(0px)', opacity: 1 }, 
                { transform: `translateY(${up ? -chartContainer.offsetHeight / 4 : chartContainer.offsetHeight / 8}px)`, opacity: 0.1, offset: 0.5 },
                { transform: `translateY(${up ? -chartContainer.offsetHeight / 4 : chartContainer.offsetHeight / 8}px)`, opacity: 0 }
            ],
            { duration: LINEAR_SCALE_ANIMATION_DURATION },
        )
        setTimeout(() => {
            linesSvg.remove();
            linesSvgContainer.remove();
        }, LINEAR_SCALE_ANIMATION_DURATION);
    }

    redraw(coords) {
        if (!coords) {
            coords = this.coords;
        } else {
            this.coords = coords;
        }
        const extrudeRatio = (coords.l + coords.c + coords.r) / coords.c;
        this.translate(coords.r - (coords.l + coords.r) / 2);
        this.extrude(extrudeRatio);
        this.lines.forEach((line, i) => {
            if (this.hiddenLines.indexOf(i) < 0) {
                line.setAttribute('stroke-width', (extrudeRatio < 3 ? 1 / extrudeRatio : 0.33) + '');
                line.setAttribute('opacity', '1');
            } else {
                line.setAttribute('opacity', '0');
            }
        });
        const coordsLength = coords.l + coords.c + coords.r;
        const currentVisibleVertices = this.valsYArr.map(arr => arr.slice(
            (coords.l / coordsLength) * arr.length >= 1
                ? (coords.l / coordsLength) * arr.length - 1
                : 0,
            ((coords.l + coords.c) / coordsLength) * arr.length + 1
        ));
        const visibleMaxY = Math.max(...currentVisibleVertices.map((arr, i) => this.hiddenLines.indexOf(i) < 0 ? Math.max(...arr) : 0));
        if (this.visibleMaxY === visibleMaxY) {
            return;
        }
        if (this.linesSvg && this.linesSvgContainer) {
            this.animateLinesFade(this.linesSvg, this.linesSvgContainer, this.visibleMaxY < visibleMaxY);
        }
        this.visibleMaxY = visibleMaxY;
        this.linesSvgContainer = document.createElement('div');
        this.linesSvgContainer.style.position = 'relative';
        this.chartContainer.appendChild(this.linesSvgContainer);
        this.linesSvg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        this.linesSvg.setAttribute('width', chartContainer.offsetWidth);
        this.linesSvg.setAttribute('height', chartContainer.offsetHeight);
        this.linesSvg.style.position = 'relative';
        this.linesSvg.style.bottom = chartContainer.offsetHeight + 'px';
        this.linesSvgContainer.appendChild(this.linesSvg);
        for (let i = 0; i < 7; i++) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
            line.setAttribute('stroke', THEME.dark);
            line.setAttribute('stroke-width', '1');
            line.setAttribute('x1', '0');
            line.setAttribute('x2', chartContainer.offsetWidth + '');
            line.setAttribute('y1', (chartContainer.offsetHeight * i / 6) + '');
            line.setAttribute('y2', (chartContainer.offsetHeight * i / 6) + '');
            this.linesSvg.appendChild(line);
            const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
            text.setAttribute('fill', 'rgb(180, 180, 180)');
            text.setAttribute('x', 5 + '');
            text.setAttribute('y', (chartContainer.offsetHeight * i / 6) - 5 + '');
            text.innerHTML = Math.round((6 - i) / 6 * visibleMaxY) + '';
            this.linesSvg.appendChild(text);
        }
        const aspect = this.maxY / visibleMaxY;
        this.extrude(undefined, -aspect);
        this.translate(undefined, this.height * ((aspect - 1) / (2 * aspect)));
    }
}

class ChartScroller extends BaseChart {
    constructor(chartContainer) {
        super(chartContainer);
        this.scrollControl = new ScrollControl(chartContainer);
    }

    redraw() {
        this.lines.forEach((line, i) => {
            line.setAttribute('opacity', this.hiddenLines.indexOf(i) < 0 ? '1' : '0');
        });
        const visibleMaxY = Math.max(...this.valsYArr.map((arr, i) => this.hiddenLines.indexOf(i) < 0 ? Math.max(...arr) : 0));
        if (this.visibleMaxY === visibleMaxY) {
            return;
        }
        const aspect = this.maxY / visibleMaxY;
        this.extrude(undefined, -aspect);
        this.translate(undefined, this.height * ((aspect - 1) / (2 * aspect)));
    }

    destroy() {
        this.scrollControl.destroy();
    }
}

class ScrollControl {
    constructor(chartContainer) {
        this.subscriptions = [];
        this.h = chartContainer.clientHeight;
        this.fullWidth = chartContainer.offsetWidth;
        this.chartContainer = chartContainer;
        this.chartContainer.style.overflow = 'visible';
        this.scrollWindow = document.createElement('div');
        this.scrollWindow.style.height = this.h + 'px';
        this.scrollWindow.style.position = 'relative';
        this.scrollWindow.style.bottom = this.h + 'px';
        this.scrollWindow.style.display = 'flex';
        this.chartContainer.appendChild(this.scrollWindow);

        this.winL = this.createSideControl();

        this.winR = this.createSideControl();

        this.win = this.createWindowControl();

        this.grayR = document.createElement('div');
        this.grayR.style.height = this.h + 'px';
        this.grayR.style.width = this.chartContainer.offsetWidth - this.h + 'px';
        this.grayR.style.backgroundColor = THEME.light;

        this.grayL = document.createElement('div');
        this.grayL.style.height = this.h + 'px';
        this.grayL.style.width = '0px';
        this.grayL.style.backgroundColor = THEME.light;

        this.scrollWindow.appendChild(this.grayL);
        this.scrollWindow.appendChild(this.winL.control);
        this.scrollWindow.appendChild(this.win.control);
        this.scrollWindow.appendChild(this.winR.control);
        this.scrollWindow.appendChild(this.grayR);

        this.WW = this.win.control.offsetWidth;
        this.LW = 0;
        this.RW = this.fullWidth - this.WW;

        this.scrollWindow.ondragstart = () => false;
        this.winL.control.ondragstart = () => false;
        this.win.control.ondragstart = () => false;
        this.winR.control.ondragstart = () => false;
    
        this.win.control.onmousedown = (ev) => {
            this.winX = ev.clientX;
            this.moveWin = true;
        };

        this.win.control.ontouchstart = (ev) => {
            this.winX = ev.touches[0].clientX;
            this.win.circle.style.left = (this.win.control.offsetWidth / 2) - this.h * 0.75;
            this.win.circle.style.display = 'block';
            this.moveWin = true;
        }

        this.winR.control.onmousedown = (ev) => {
            this.winX = ev.clientX;
            this.moveWinR = true;
        };

        this.winR.control.ontouchstart = (ev) => {
            this.winX = ev.touches[0].clientX;
            this.winR.circle.style.display = 'block';
            this.moveWinR = true;
        }

        this.winL.control.onmousedown = (ev) => {
            this.winX = ev.clientX;
            this.moveWinL = true;
        };

        this.winL.control.ontouchstart = (ev) => {
            this.winX = ev.touches[0].clientX;
            this.winL.circle.style.display = 'block';
            this.moveWinL = true;
        }

        if (isMobile()) {
            this.grayL.ontouchstart = (ev) => {
                this.winX = ev.touches[0].clientX;
                this.winL.circle.style.display = 'block';
                this.moveWinL = true;
            }
            this.grayR.ontouchstart = (ev) => {
                this.winX = ev.touches[0].clientX;
                this.winR.circle.style.display = 'block';
                this.moveWinR = true;
            }
        }

        this.clearMovesHandler = () => this.clearMoves();

        this.chartContainer.ontouchend = this.clearMovesHandler;
        this.chartContainer.ontouchcancel = this.clearMovesHandler;
        this.chartContainer.onmouseup = this.clearMovesHandler;
        this.chartContainer.onmouseleave = this.clearMovesHandler;

        this.handleMove = (ev) => {
            const clientX = ev instanceof TouchEvent ? ev.touches[0].clientX : ev.clientX;
            if (this.moveWin) {
                let distance = clientX - this.winX;
                if (distance > 0 && this.RW < distance) {
                    distance = this.RW;
                    this.winX = this.winX + distance;
                } else if (distance < 0 && this.LW < -distance) {
                    distance = -this.LW;
                    this.winX = this.winX + distance;
                } else {
                    this.winX = clientX;
                }
                this.LW = this.LW + distance;
                this.RW = this.RW - distance;
                this.grayL.style.width = this.LW + 'px';
                this.grayR.style.width = this.RW + 'px';
                this.notify();
            }
            if (this.moveWinL) {
                let distance = clientX - this.winX;
                if (this.WW - distance < this.h) {
                    distance = this.WW - this.h;
                    this.winX = this.winX + distance;
                } else {
                    this.winX = clientX;
                }
                this.LW = this.LW + distance;
                this.WW = this.WW - distance;
                this.grayL.style.width = this.LW + 'px';
                this.win.control.style.width = this.WW + 'px';
                this.notify();
            }
            if (this.moveWinR) {
                let distance = clientX - this.winX;
                if (this.WW + distance < this.h) {
                    distance = -this.WW + this.h;
                    this.winX = this.winX + distance;
                } else {
                    this.winX = clientX;
                }
                this.RW = this.RW - distance;
                this.WW = this.WW + distance
                this.grayR.style.width = this.RW + 'px';
                this.win.control.style.width = this.WW + 'px';
                this.notify();
            }
        };

        this.chartContainer.onmousemove = this.handleMove;
        this.chartContainer.ontouchmove = this.handleMove;
    }

    createCircle() {
        const circle = document.createElement('div');
        circle.style.width = this.h * 1.5 + 'px';
        circle.style.height = this.h * 1.5 + 'px';
        circle.style.backgroundColor = THEME.weakDark;
        circle.style.borderRadius = this.h * 0.75 + 'px';
        circle.style.position = 'relative';
        circle.style.right = this.h * 0.7 + 'px';
        circle.style.bottom = this.h * 0.25 + 'px';
        circle.style.display = 'none';
        return circle;
    }

    createSideControl() {
        const control = document.createElement('div');
        control.style.width = this.h * 0.1 + 'px';
        control.style.height = this.h + 'px';
        control.style.backgroundColor = THEME.dark;
        control.style.overflow = 'visible';

        const circle = this.createCircle();
        
        control.appendChild(circle);

        return {control, circle};
    }

    createWindowControl() {
        const control = document.createElement('div');
        control.style.width = '20vw';
        control.style.height = this.h * 0.95 + 'px';
        control.style.borderTop = control.style.borderBottom = `${0.025 * this.h}px solid ` + THEME.dark;

        const circle = this.createCircle();

        control.appendChild(circle);

        return {control, circle}

    }

    destroy() {
        this.chartContainer.removeEventListener('mousemove', this.handleMove, false);
        this.chartContainer.removeEventListener('touchmove', this.handleMove, false);
        this.chartContainer.removeEventListener('touchend', this.clearMovesHandler, false);
        this.chartContainer.removeEventListener('touchcancel', this.clearMovesHandler, false);
        this.chartContainer.removeEventListener('mouseup', this.clearMovesHandler, false);
        this.chartContainer.removeEventListener('mouseleave', this.clearMovesHandler, false);
    }

    clearMoves() {
        this.moveWinL = false;
        this.moveWinR = false;
        this.moveWin = false;
        this.winL.circle.style.display = 'none';
        this.winR.circle.style.display = 'none';
        this.win.circle.style.display = 'none';
    }

    subscribe(fn) {
        this.subscriptions.push(fn);
        fn({l: this.LW, c: this.WW, r: this.RW});
        if (!this.notificationInterval) {
            this.notificationInterval = setInterval(() => this.notify(), ANIMATION_DEBOUNCE);
        }
    }

    notify() {
        if (this.oldLW !== this.LW || this.oldRW !== this.RW) {
            this.oldLW = this.LW;
            this.oldRW = this.RW;
            for (let s of this.subscriptions) {
                s({l: this.LW, c: this.WW, r: this.RW});
            }
        }
    }
}

class Legend {
    constructor(legendContainer) {
        this.legendContainer = legendContainer;
        this.legendContainer.style.overflow = 'hidden';
        this.legendContainer.style.whiteSpace = 'nowrap';
        this.width = this.legendContainer.offsetWidth;
        this.timeouts = [];
        this.animations = [];
        this.updateInterval = setInterval(() => this.legendContainer.scrollLeft = this.scrollLeft, ANIMATION_DEBOUNCE);
    }

    destroy() {
        clearInterval(this.updateInterval);
    }

    drawLegend(valsX) {
        this.days = [];
        const minY = Math.min(...valsX);
        const maxY = Math.max(...valsX);
        for (let i = minY; i < maxY; i += SECONDS_IN_DAY) {
            const el = document.createElement('div');
            this.days.push({el, displayed: true});
            el.style.display = 'inline-block';
            el.style.width = '20%';
            el.style.color = 'rgb(180, 180, 180)';
            const date = new Date(i);
            el.innerText = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
            this.legendContainer.appendChild(el);
        }
        this.visibleDays = this.days.length;
        this.totalDays = this.days.length;
    }

    redrawDays(coords) {
        const visibleDays = 5 * (coords.c + coords.l + coords.r) / coords.c;
        const evenDays = this.totalDays / visibleDays;
        if (this.evenDays !== evenDays) {
            this.visibleDays = 0;
            const shouldBeVisible = [];
            for (let j = 0; j < visibleDays; j++) {
                shouldBeVisible.push(Math.round(evenDays * j));
            }
            this.evenDays = evenDays;
            this.timeouts.forEach(tout => clearTimeout(tout));
            for (let i in this.days) {
                if (shouldBeVisible.indexOf(Number(i)) === -1) {
                    this.days[i].displayed = false;
                    this.animateDay(this.days[i].el, false);
                } else if (shouldBeVisible.indexOf(Number(i)) !== -1) {
                    this.days[i].displayed = true;
                    this.animateDay(this.days[i].el, true);
                    this.visibleDays++;
                }
            }
        }
        this.scrollLeft = this.visibleDays * (this.width / 5) * coords.l / (coords.c + coords.l + coords.r);
        this.legendContainer.scrollLeft = this.scrollLeft;
    }

    animateDay(el, appearance) {
        if (appearance) {
            el.style.display = 'inline-block';
            el.animate([
                    {width: '0'},
                    {width: '20%', offset: 0.5},
                    {width: '20%'}
            ], ANIMATION_DEBOUNCE * 2);
            this.timeouts.push(setTimeout(() => {el.style.width = '20%'}, ANIMATION_DEBOUNCE));
        } else {
            el.animate([
                    {width: '20%'},
                    {width: '0%', offset: 0.5},
                    {width: '0%'}
            ], ANIMATION_DEBOUNCE * 2);
            this.timeouts.push(setTimeout(() => {el.style.display = 'none'}, ANIMATION_DEBOUNCE));
        }
    }
}

class FullChart {
    constructor(chartContainer, scrollContainer, legenContainer, buttonContainer, chartInfo) {
        this.nodes = [chartContainer, scrollContainer, legenContainer, buttonContainer];
        const lineNames = [];
        const lineLegendNames = [];
        let x;
        for (let type in chartInfo.types) {
            if (chartInfo.types[type] === 'x') {
                x = type;
            } else {
                lineNames.push(type);
                lineLegendNames.push(chartInfo.names[type]);
            }
        }

        const xArr = chartInfo.columns.filter(col => col[0] === x)[0].slice(1);

        const lines = [];
        const colors = [];
        for (let name of lineNames) {
            lines.push(chartInfo.columns.filter(col => col[0] === name)[0].slice(1));
            colors.push(chartInfo.colors[name]);
        }

        this.chart = new LeveledChart(chartContainer);
        this.chart.drawChart(xArr, lines, colors);

        this.chartScroll = new ChartScroller(scrollContainer);
        this.chartScroll.drawChart(xArr, lines, colors); 
    
        this.chartLegend = new Legend(legenContainer);
        this.chartLegend.drawLegend(xArr);

        this.chartScroll.scrollControl.subscribe((coords) => {
            this.chart.redraw(coords);
            this.chartLegend.redrawDays(coords);
        });

        for (let i = 0; i < lineLegendNames.length; i++) {
            this.addButton(buttonContainer, () => {
                this.chart.changeHidden(i);
                this.chartScroll.changeHidden(i);
            }, colors[i], lineLegendNames[i], 100 / lineLegendNames.length);
        }
    }

    destroy() {
        this.chartScroll.destroy();
        this.chartLegend.destroy();
        this.nodes.forEach((node) => {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
        });
    }

    addButton(buttonContainer, onclick, color, name, width) {
        let show = true;
        const btn = document.createElement('div');
        const nameContainer = document.createElement('div');
        nameContainer.textContent = name;
        nameContainer.style.color = 'rgb(180, 180, 180)';
        nameContainer.style.display = 'inline-block';
        btn.style.display = 'inline-block';
        btn.style.userSelect = 'none';
        btn.style.marginLeft = '10px';
        btn.style.marginRight = '10px';
        btn.style.width = width + '%';
        btn.style.fontSize = '20px';

        const svgContainer = document.createElement('div');
        svgContainer.style.margin = '10px';
        svgContainer.style.display = 'inline-block';

        const svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        svg.setAttribute('width', '20px');
        svg.setAttribute('height', '20px');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('fill', color);
        circle.setAttribute('cx', '10');
        circle.setAttribute('cy', '10');
        circle.setAttribute('r', '10');
        svg.appendChild(circle);
    
        const bird = document.createElementNS("http://www.w3.org/2000/svg", 'polyline');
        bird.setAttribute('points', '4,12 8,16 16,8 14,6 8,12 6,10 4,12');
        bird.setAttribute('fill', 'white');
        svg.appendChild(bird);

        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('fill', 'white');
        innerCircle.setAttribute('cx', '10');
        innerCircle.setAttribute('cy', '10');
        innerCircle.setAttribute('r', '7');
        innerCircle.setAttribute('opacity', '0');
        svg.appendChild(innerCircle);

        svgContainer.appendChild(svg);

        btn.appendChild(svgContainer);
        btn.appendChild(nameContainer);
        btn.style.border = THEME.dark + ' 1px solid';
        btn.onclick = () => {
            onclick();
            show = !show;
            innerCircle.setAttribute('opacity', show ? '0' : '1');
            bird.setAttribute('opacity', show ? '1' : '0');
        };
        btn.style.height = '40px';
        btn.style.borderRadius = '25px';
        buttonContainer.appendChild(btn);
    }
}

(() => {
    const dayModeColor = 'white';
    const nightModeColor = '#223';
    let mode = true;
    const buildChart = (n) => {
        const chart = new FullChart(
            document.getElementById('chartContainer'),
            document.getElementById('scrollContainer'),
            document.getElementById('chartLegend'),
            document.getElementById('buttonContainer'),
            chartData[n])
        return chart;
    }
    let chartDataNumber = 0;
    let currentChart = buildChart(chartDataNumber);
    const redrawChart = () => {
        currentChart.destroy();
        currentChart = buildChart(chartDataNumber);
    }
    window.onresize = redrawChart;
    window.onorientationchange = redrawChart;
    document.getElementById('nextChart').onclick = () => {
        chartDataNumber = (chartDataNumber + 1) % chartData.length;
        redrawChart();
    };
    document.getElementById('previousChart').onclick = () => {
        chartDataNumber = (chartDataNumber + chartData.length - 1) % chartData.length;
        redrawChart();
    }
    const switchModeButton = document.getElementById('switchMode');
    const switchModeText = document.getElementById('switchModeText');
    switchModeButton.onclick = () => {
        mode = !mode;
        if (mode) {
            switchModeText.innerText = 'Switch to Night Mode'
            document.body.style.backgroundColor = dayModeColor;
        } else {
            switchModeText.innerText = 'Switch to Day Mode'
            document.body.style.backgroundColor = nightModeColor;
        }
        document.body.style.color = mode ? nightModeColor : dayModeColor;
    }
})()
