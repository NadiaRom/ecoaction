const scrollama = require('scrollama');
const $ = require('jquery');
const d3 = require('d3');
const chroma = require('chroma-js');
const tippy = require('tippy.js');

$('#consumption .h3').prependTo('#consumption figure');

const cols = {
    green: '#00a650',
    black: '#3c353f',
    orange: '#f26522',
    bgcol: '#f7f7f7',
    lightblack: '#464646',
};

const fontSize = parseInt($('body').css('font-size'));

const numericalize = function (d) {
    for (const k in d) {
        if (d[k].search(/[^0-9\.]/) === -1) {
            d[k] = +d[k];
        }
    }
    return d;
};

Promise.all([
    d3.csv('data/by_vde_wide.csv', numericalize),
    d3.csv('data/data_report_wide.csv', numericalize),
    d3.json('data/sources_order.json', numericalize),
    d3.xml('drag.svg'),
])
    .then(function ([data_vde, data_year, sourcesOrder, dragPointer]) {
        const nest_vde = d3.nest()
            .key(d => d.scenario)
            .key(d => d.by_vde)
            .entries(data_vde)
            .reduce((res, d) => {
                res[d.key] = d.values;
                return res;
            }, {});

        let nest_year = d3.nest()
            .key(d => d.scenario)
            .key(d => d.year)
            .entries(data_year);

        nest_year.map((val, i) => {
            nest_year[i].values = val.values.reduce((res, d) => {
                res[d.key] = d.values;
                return res;
            }, {});
        });

        nest_year = nest_year.reduce((res, d) => {
            res[d.key] = d.values;
            return res;
        }, {});

        const sources = [...Object.keys(sourcesOrder)];

        let activeSphere = 'Загалом',
            scenario = 'Революційний',
            dragYear = 2015;

        d3.select('#consumption figure #bars')
            .append('div')
            .classed('bar_vde', true)
            .attr('data-vde', 'dirt');

        d3.select('#consumption figure #bars')
            .append('div')
            .classed('bar_vde', true)
            .attr('data-vde', 'vde');

        d3.select('#consumption figure #bars div[data-vde="dirt"]')
            .selectAll('div.e-source')
            .data(nest_year[scenario][dragYear].filter(d => !sourcesOrder[d.source].is_vde))
            .enter()
            .append('div')
            .classed('e-source', true);

        d3.select('#consumption figure #bars div[data-vde="vde"]')
            .selectAll('div.e-source')
            .data(nest_year[scenario][dragYear].filter(d => sourcesOrder[d.source].is_vde))
            .enter()
            .append('div')
            .classed('e-source', true);

        const bars = d3.selectAll('#consumption figure #bars div.e-source');

        const barSpans = bars
            .append('p')
            .text(d => d.source + ' ')
            .append('span')
            .classed('ktne', true);

        const barW = $('.e-source').width();

        const barsSvg = bars.append('svg')
            .attr('height', '4px')
            .attr('width', barW);

        const linesW = $('#consumption figure .chart#lines').width();
        const linesH = $('#consumption figure .chart#lines').height();

        const linesSvg = d3.select('#consumption figure .chart#lines')
            .append('svg')
            .attr('width', linesW)
            .attr('height', linesH);

        const linesM = {
            top: linesH * 0.1,
            right: linesW * 0.1,
            bottom: linesW * 0.05,
            left: linesH * 0,
        };

        const scaleYear = d3.scaleLinear()
            .domain([2015, 2050])
            .range([linesM.left, linesW - linesM.right]);

        const scaleKTNE = d3.scaleLinear()
            .domain([0, 0])
            .range([linesH - linesM.top, linesM.bottom]);

        let isFirstDrawLine = true;

        const line = d3.line()
            .x(d => scaleYear(d.year))
            .y(d => (isFirstDrawLine) ? scaleKTNE(0) : scaleKTNE(d[activeSphere]))
            .curve(d3.curveCatmullRom);

        const xAxis = d3.axisBottom()
            .scale(scaleYear)
            .ticks(8)
            .tickFormat(d => d.toString());

        const yAxis = d3.axisRight()
            .scale(scaleKTNE);


        // DRAW CHART------------------------------------------------------------------------------------------
        let datLines= nest_vde[scenario];

        const gXAxis = linesSvg.append('g')
            .attr('id', 'x_axis')
            .attr('transform', `translate(0 ${scaleKTNE(0)})`)
            .call(xAxis);

        gXAxis.selectAll('.tick text')
            .attr('fill', cols.black)
            .attr('font-size', '0.85rem');

        gXAxis.selectAll('.tick line')
            .attr('y1', -1 * (linesH - linesM.top - linesM.bottom))
            .attr('y2', 0)
            .attr('stroke', chroma(cols.black).alpha(0.4))
            .attr('stroke-dasharray', '2 2');

        const gYAxis = linesSvg.append('g')
            .attr('id', 'y_axis')
            .attr('transform', `translate(${linesW - linesM.right}, 0)`)
            .call(yAxis);

        const $xAxisTexts = $('#x_axis .tick text');

        $xAxisTexts.first().addClass('active');


        const sourceLine = linesSvg.selectAll('path.sl')
            .data(datLines)
            .enter()
            .append('path')
            .classed('sl', true)
            .attr('id', d => `line_${d.key}`)
            .attr('d', d => line(d.values.slice(1)))
            .style('fill', 'none')
            .style('stroke', d => (d.key === 'vde') ? cols.green : cols.orange);

        const textPath = linesSvg.selectAll('g.follow-path')
            .data(datLines)
            .enter()
            .append('g')
            .attr('transform', `translate(${fontSize / 2} -${fontSize})`)
            .append('text')
            .style('fill', cols.black)
            .append('textPath')
            .attr('href', d => `#line_${d.key}`)
            .text(d => (d.key === 'vde') ? 'Зелена енергія' : 'Невідновлювані джерела')

        // Dragger created here, to be before dots
        const dragger = linesSvg.append('g')
            .attr('id', 'year_dragger')
            .attr('transform', `translate(${scaleYear(2015)} 0)`);

        const dragHelperW = d3.max([linesW*0.05, 10]);
        const linesTopY = document.getElementById('y_axis').getBBox().y;

        dragger.append('line')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', scaleKTNE(0))
            .attr('y2', linesTopY);



        dragger.append('rect')
            .attr('x', dragHelperW / 2 * (-1))
            .attr('y', linesTopY)
            .attr('height', scaleKTNE.range()[0])
            .attr('width', dragHelperW)
            .style('stroke', 'none')
            .style('fill', cols.bgcol)
            .style('opacity', 0);

        dragger.append('line')
            .attr('x1', -5)
            .attr('x2', 5)
            .attr('y1', linesTopY)
            .attr('y2', linesTopY);

        // continue dots

        const dots = linesSvg.selectAll('g.circle_g')
            .data(datLines)
            .enter()
            .append('g')
            .classed('circle_g', true)
            .selectAll('circle')
            .data(d => d.values.slice(1))
            .enter()
            .append('circle')
            .attr('cx', d => scaleYear(d.year))
            .attr('cy', d => scaleKTNE(0))
            .attr('r', 5)
            .attr('class', d => d.by_vde)
            .style('fill', d => (d.by_vde === 'vde') ? cols.green : cols.orange);

        isFirstDrawLine = false;

        // DRAW BARS ------------------------------------------------------------------------------------------
        let datYear = nest_year[scenario];
        const scaleBar = d3.scaleLinear()
            .range([0, barW]);

        const barsBar = barsSvg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 0)
            .attr('height', '4px');

        const barsCircle = barsSvg.append('circle')
            .attr('cx', 0)
            .attr('cy', 2)
            .attr('r', 5);


        const updateBar = function () {
            const dat = {};
            datYear[dragYear.toString()].map(function (d) {
                dat[d.source] = d;
            });

            scaleBar.domain([0, d3.max(datYear[dragYear.toString()], d => d[activeSphere])]);

            const datOrd = barsBar.data().map(d => dat[d.source]);

            barsBar
                .data(datOrd)
                .transition()
                .duration(500)
                .attr('width', d => scaleBar(d[activeSphere]));

            barsCircle
                .data(datOrd)
                .transition()
                .duration(500)
                .attr('cx', d => scaleBar(d[activeSphere]));

            barSpans.data(datOrd)
                .text(d => `${d3.format(",.2r")(d[activeSphere])} тис. т н.е.`);
        };

        updateBar();

        // DRAG YEAR ------------------------------------------------------------------------------------------
        const lineTipSelection = (window.innerHeight > 850)
            ? document.querySelectorAll('#lines circle.dirt, #lines circle.vde')
            : document.querySelectorAll('#lines circle.dirt, #lines circle.vde, .e-source circle');

        const lineTip = tippy(lineTipSelection, {
            animation: 'fade',
            onShow: function (tip) {
                const d = tip.reference.__data__;
                const is_vde = d.by_vde || (sourcesOrder[d.source].is_vde) ? 'vde' : 'dirt'
                tip.setContent(`
            <p><span class="${is_vde}">${d3.format(",.2r")(d[activeSphere])} тис. т н.е.</span></p>
            `);
            },
        });


        const dragStart = function() {
            d3.select(this).classed('active', true);
        };

        const dragged = function() {
            const dragTo = d3.min([scaleYear(2050), d3.max([scaleYear(2015), d3.event.x])]);
            dragYear = Math.round(scaleYear.invert(dragTo) / 5) * 5;

            dragger
                .attr('transform', `translate(${dragTo} 0)`);
        };

        const dragEnd = function() {
            const yearDragger = d3.select('#lines #year_dragger');
            yearDragger.transition()
                .duration(500)
                .attr('transform', `translate(${scaleYear(dragYear)} 0)`);

            yearDragger.classed('active', false);

            updateBar();

            $xAxisTexts.removeClass('active')
                .filter(function () {
                    return this.textContent === dragYear.toString();
                })
                .addClass('active');
        };

        dragger.call(d3.drag()
            .on('start', dragStart)
            .on('drag', dragged)
            .on('end', dragEnd));

        $xAxisTexts.click(function () {
            dragYear = this.__data__;
            dragEnd();
        });

        d3.selectAll('#lines circle.dirt, #lines circle.vde')
            .on('click', function (d) {
                dragYear = d.year;
                dragEnd();
            });


        // FUNC TO UPDATE LINES -----------------------------------------------------------------------------
        const updateLines = function () {
            scaleKTNE.domain([
                0,
                Math.round(d3.max(datLines[0].values.concat(datLines[1].values),
                        d => d[activeSphere]) / 5000
                ) * 5000
            ]);

            gYAxis.transition()
                .duration(500)
                .call(yAxis);

            sourceLine.data(datLines)
                .transition()
                .duration(500)
                .attr('d', d => line(d.values.slice(1)));

            // textPath.transition()
            //     .duration(500)
            //     .attr('href', d => `#line_${d.key}`)

            dots.transition()
                .duration(500)
                .attr('cx', d => scaleYear(d.year))
                .attr('cy', d => scaleKTNE(d[activeSphere]));
        };

        // SCROLLAMA -----------------------------------------------------------------------------------------

        const dragMeTip = tippy(document.querySelectorAll('#lines #year_dragger'), {
            trigger: 'manual',
            animation: 'fade',
            placement: 'top',
            content: `
        <p>Потягніть лінію, щоб побачити детальні зміни</p>
        `,
        })

        const scroller = scrollama();
        let isContainerEnter = true;

        scroller.setup({
            step: '#consumption article .text',
            container: '#consumption',
            graphic: '#consumption .fig_container figure',
            offset: 0.5,
        })
            .onStepEnter(function (r) {
                activeSphere = r.element.getAttribute('data-sphere');
                updateLines();
                updateBar()
            });
    });

$(document).ready(function () {
    $('#lines').one('mouseover', function () {
        const dragMeTipInstance = document.querySelector('#lines #year_dragger')._tippy;
        dragMeTipInstance.show();
        setTimeout(function() {
            dragMeTipInstance.hide();
            isContainerEnter = false;
        }, 7000);
    });

    window.addEventListener('scroll', function () {
        tippy.hideAllPoppers();
    });
});