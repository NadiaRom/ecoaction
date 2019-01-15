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
]).then(function ([data_vde, data_year, sourcesOrder, dragPointer]) {

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
    
    const barSpans = bars.append('p')
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
        .domain([0, 55000])
        .range([linesH - linesM.top, linesM.bottom]);

    const line = d3.line()
        .x(d => scaleYear(d.year))
        .y(d => scaleKTNE(d[activeSphere]))
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


    const sourceLine = linesSvg.selectAll('path.sl')
        .data(datLines)
        .enter()
        .append('path')
        .classed('sl', true)
        .attr('d', d => line(d.values.slice(1)))
        .style('fill', 'none')
        .style('stroke', d => (d.key === 'vde') ? cols.green : cols.orange);

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
        .attr('cy', d => scaleKTNE(d[activeSphere]))
        .attr('r', 5)
        .attr('class', d => d.by_vde)
        .style('fill', d => (d.by_vde === 'vde') ? cols.green : cols.orange);


    const gYAxis = linesSvg.append('g')
        .attr('id', 'y_axis')
        .attr('transform', `translate(${linesW - linesM.right}, 0)`)
        .call(yAxis);

    const $xAxisTexts = $('#x_axis .tick text');
    
    $xAxisTexts.first().addClass('active');
    
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

    const dragger = linesSvg.append('g')
        .attr('id', 'year_dragger');
    
    dragger.append('line')
        .attr('x1', scaleYear(2015))
        .attr('x2', scaleYear(2015))
        .attr('y1', scaleKTNE(0))
        .attr('y2', document.getElementById('y_axis').getBBox().y);
    

    const dragStart = function() {
        d3.select(this).classed('active', true);
    };
    
    const dragged = function() {
        const dragTo = d3.min([scaleYear(2050), d3.max([scaleYear(2015), d3.event.x])]);
        dragYear = Math.round(scaleYear.invert(dragTo) / 5) * 5;
        
        d3.select(this).select('line')
            .attr('x1', dragTo)
            .attr('x2', dragTo);
    };
    
    const dragEnd = function() {
        d3.select(this)
            .classed('active', false)
            .select('line')
            .transition()
            .duration(500)
            .attr('x1', scaleYear(dragYear))
            .attr('x2', scaleYear(dragYear));

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

    // const scroller = scrollama();
    //
    // scroller.setup({
    //     step: '#consumption article .text',
    //     container: '#consumption',
    //     graphic: '#consumption .fig_container figure',
    //     offset: 0.5,
    // })
    //     .onStepEnter(function (r) {
    //         activeSphere = r.element.getAttribute('data-sphere');
    //         updateSvg(transSvg);
    //         updateSvg(dirtySvg);
    //     });
    //
    // const updateSvg = function (svg) {
    //     if (activeSphere === 'Загалом') {
    //         scaleKTNE.domain([0, 8000]);
    //     } else {
    //         scaleKTNE.domain([0, 4000]);
    //     }
    //
    //     svg.selectAll('path.sm')
    //         .transition()
    //         .duration(1000)
    //         .attr('d', d => area(d.values.slice(1)));
    //
    //     svg.selectAll('path.sl')
    //         .transition()
    //         .duration(1000)
    //         .attr('d', d => line(d.values.slice(1)));
    //
    //     svg.select('g#y_axis')
    //         .transition()
    //         .duration(1000)
    //         .call(yAxis);
    // };

});