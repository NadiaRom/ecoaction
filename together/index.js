const scrollama = require('scrollama');
const $ = require('jquery');
const d3 = require('d3');
const chroma = require('chroma-js');

$('#consumption .h3').prependTo('#consumption figure');

const cols = {
    green: '#00a650',
    black: '#3c353f',
    orange: '#f26522',
    bgcol: '#f7f7f7',
    lightblack: '#464646',

    'Теплова енергія': '#e41a1c',
    'Газ': '#377eb8',
    'Електроенергія з ВДЕ': '#4daf4a',
    'Біопаливо та відходи': '#984ea3',
    'Електроенергія': '#ff7f00',
    'Сонячна енергія': '#ffff33',
    'Вугілля': '#a65628',
    'Теплова енергія з ВДЕ': '#f781bf',
    'Нафта та нафтопродукти': '#999999',
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
    d3.csv('../data/data_report_wide.csv', numericalize),
    d3.json('../data/sources_order.json', numericalize),
    d3.xml('drag.svg'),
]).then(function ([data, sourcesOrder, dragPointer]) {

    const nested = d3.nest()
        .key(d => d.scenario)
        .key(d => d.source)
        .entries(data)
        .reduce((res, d) => {
            res[d.key] = d.values;
            return res;
        }, {});

    const sources = [...Object.keys(sourcesOrder)];

    const chart = d3.select('#consumption figure .chart');

    const svgW = parseFloat($(chart.node()).width()),
        svgH = parseFloat($(chart.node()).height());

    const svgM = {
        top: svgH * 0.1,
        right: 75,
        bottom: svgW * 0.05,
        left: svgW * 0.1,
    };

    const dirtySvg = chart
        .append('svg')
        .attr('id', 'dirt')
        .attr('width', svgW - 1)
        .attr('height', svgH - 1);

    const draggingSvg = chart
        .append('svg')
        .attr('id', 'dragme')
        .attr('width', svgW)
        .attr('height', svgH);

    const transSvg = chart
        .append('svg')
        .attr('id', 'trans')
        .attr('width', svgW)
        .attr('height', svgH);

    let activeSphere = 'Загалом';

    const scaleYear = d3.scaleLinear()
        .domain([2015, 2050])
        .range([svgM.left, svgW - svgM.right]);

    const scaleKTNE = d3.scaleLinear()
        .domain([0, 25000])
        .range([svgH - svgM.top, svgM.bottom]);

    // const area = d3.area()
    //     .x(d => scaleYear(d.year))
    //     .y0(d => scaleSm(d.source) + scaleSm.bandwidth() )
    //     .y1(d => scaleSm(d.source) + scaleKTNE(d[activeSphere]))
    //     .curve(d3.curveStepBefore);
        // .curve(d3.curveCatmullRom);

    const line = d3.line()
        .x(d => scaleYear(d.year))
        .y(d => scaleKTNE(d[activeSphere]))
        .curve(d3.curveCatmullRom);

    const xAxis = d3.axisBottom()
        .scale(scaleYear)
        .ticks(8)
        .tickFormat(d => '`' + d.toString().slice(2));

    const yAxis = d3.axisRight()
        .scale(scaleKTNE)
        .ticks(10);

    const drawChart = function (svg, scenario) {
        const dat = nested[scenario];

        const gXAxis = svg.append('g')
            .attr('transform', `translate(0 ${svgH - svgM.bottom})`)
            .call(xAxis);

        gXAxis.selectAll('.tick text')
            .attr('fill', cols.black)
            .attr('font-size', '0.85rem');

        gXAxis.selectAll('.tick line')
            .attr('y1', -1 * (svgH - svgM.bottom))
            .attr('stroke', chroma(cols.black).alpha(0.4))
            .attr('stroke-dasharray', '2 2');

        const sourceLine = svg.selectAll('path.sl')
            .data(dat)
            .enter()
            .append('path')
            .classed('sl', true)
            .attr('d', d => line(d.values.slice(1)))
            .style('fill', 'none')
            .style('stroke-width', 2)
            .style('stroke', d => cols[d.key]);

        const gYAxis = svg.append('g')
            .attr('id', 'y_axis')
            .attr('transform', `translate(${svgW - svgM.right} 0)`)
            .call(yAxis);
    };

    const dragStart = function(d) {
        d3.select(this).raise().classed('active', true);
    };

    const dragged = function(d) {
        const dragTo = d3.max([0, d3.min([d3.event.x, svgW])]);
        let dragPers = (dragTo / svgW) * 100;
        if (dragPers >= 50) {
            d3.select('#consumption figure')
                .style('background-image',
                    `linear-gradient(0.25turn, ${cols.bgcol} ${dragPers}%, ${cols.lightblack} ${100 - dragPers}%)`);
        } else {
            d3.select('#consumption figure')
                .style('background-image',
                    `linear-gradient(0.75turn, ${cols.lightblack} ${100 - dragPers}%, ${cols.bgcol} ${dragPers}%)`);
        };

        d3.select(this)
            .attr('transform', `translate(${dragTo} 0)`);

        transSvg.attr('width', dragTo);


    };

    const dragEnd = function(d) {
        d3.select(this).classed('active', false);
    };


    drawChart(dirtySvg, 'Базовий');
    drawChart(transSvg, 'Революційний');

    const dragLine = draggingSvg.append('g')
        .style('pointer-events', 'auto')
        .attr('transform', `translate(${svgW} 0)`)
        .call(d3.drag()
            .on('start', dragStart)
            .on('drag', dragged)
            .on('end', dragEnd));

    dragLine.node().appendChild(dragPointer.documentElement.getElementsByTagName('g')[0]);
    
    dragLine.select('#dragger')
        .attr('transform', function (d) {
            const scale = 7,
                bbox = this.getBBox();
            return `translate(-${bbox.width * scale} ${svgH / 2 - (bbox.height * scale) / 2})
                    scale(${scale})`
        })
        .select('#pipchyk')
        .style('fill', $('#consumption article').css('background-color'));

    const scroller = scrollama();

    scroller.setup({
        step: '#consumption article .text',
        container: '#consumption',
        graphic: '#consumption .fig_container figure',
        offset: 0.5,
    })
        .onStepEnter(function (r) {
            activeSphere = r.element.getAttribute('data-sphere');
            updateSvg(transSvg);
            updateSvg(dirtySvg);
        });

    const updateSvg = function (svg) {
        if (activeSphere === 'Загалом') {
            scaleKTNE.domain([0, 20000]);
        } else {
            scaleKTNE.domain([0, 10000]);
        }

        svg.selectAll('path.sm')
            .transition()
            .duration(1000)
            .attr('d', d => area(d.values.slice(1)));

        svg.selectAll('path.sl')
            .transition()
            .duration(1000)
            .attr('d', d => line(d.values.slice(1)));

        svg.select('g#y_axis')
            .transition()
            .duration(1000)
            .call(yAxis);
    };

});