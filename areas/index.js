const d3 = require('d3');
const $ = require('jquery');
const tippy = require('tippy.js');
const chroma = require('chroma-js');

const cols = {
    green: '#00a650',
    black: '#3c353f',
    orange: '#f26522',
    bgcol: '#f7f7f7',
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

const scaleKTNE = d3.scalePow()
    .exponent(0.5)
    .domain([0, 26000])
    .range([0, 47.5]);

Promise.all([
    d3.csv('../data/data_report_wide.csv', numericalize),
    d3.json('../data/measures.json'),
    d3.json('../data/sources_order.json', numericalize),
]).then(function ([data, measures, sourcesOrder]) {
    
    const nested = d3.nest()
        .key(d => d.scenario)
        .key(d => d.source)
        .entries(data)
        .reduce((res, d) => {
            res[d.key] = d.values;
            return res;
        }, {});

    const sphereButtons = d3.select('#chart nav ')
        .selectAll('button')
        .data(Object.keys(data[0]).slice(3))
        .enter()
        .append('button')
        .text(d => d)
        .attr('class', d => { if (d === 'Загалом') return 'active'});

    const sources = [...Object.keys(sourcesOrder)];

    const chart = d3.select('#chart figure');

    const svgW = parseFloat($(chart.node()).width()),
        svgH = parseFloat($(chart.node()).height());

    const svgM = {
        top: svgH * 0.1,
        right: svgW * 0.05,
        bottom: svgW * 0.05,
        left: svgW * 0.05,
    };
    
    const dirtySvg = chart
        .append('svg')
        .attr('id', 'dirt')
        .attr('width', svgW)
        .attr('height', svgH);

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

    let activeSphere = $('#chart button.active').text();

    const scaleSm = d3.scaleBand()
        .domain(sources)
        .range([svgH - svgM.bottom, svgM.top]);

    const scaleYear = d3.scaleLinear()
        .domain([2015, 2050])
        .range([svgM.left, svgW - svgM.right]);
    
    const scaleKTNE = d3.scaleLinear()
        .domain([0, 10000])
        .range([scaleSm.step(), 0]);
    
    const area = d3.area()
        .x(d => scaleYear(d.year))
        .y0(d => scaleSm(d.source) + scaleSm.bandwidth() )
        .y1(d => scaleSm(d.source) + scaleKTNE(d[activeSphere]))
        .curve(d3.curveCatmullRom);

    const line = d3.line()
        .x(d => scaleYear(d.year))
        .y(d => scaleSm(d.source) + scaleKTNE(d[activeSphere]))
        .curve(d3.curveCatmullRom);

    const xAxis = d3.axisBottom()
        .scale(scaleYear)
        .ticks(8)
        .tickFormat(d => '`' + d.toString().slice(2));

    const yAxis = d3.axisLeft()
        .scale(scaleKTNE)
        .ticks(2);
    
    const drawChart = function (svg, scenario) {
        const dat = nested[scenario];

        svg.selectAll('line.smline')
            .data(dat)
            .enter()
            .append('line')
            .classed('smline', true)
            .attr('y1', d => scaleSm(d.key) + scaleSm.bandwidth())
            .attr('y2', d => scaleSm(d.key) + scaleSm.bandwidth())
            .attr('x1', scaleYear(2015))
            .attr('x2', scaleYear(2050));

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

        const sourceAreas = svg.selectAll('path.sm')
            .data(dat)
            .enter()
            .append('path')
            .classed('sm', true)
            .attr('d', d => area(d.values.slice(1)))
            .style('fill', d => (sourcesOrder[d.key].is_vde) ? cols.green : cols.orange)
            .style('fill-opacity', 0.5);

        const sourceLine = svg.selectAll('path.sl')
            .data(dat)
            .enter()
            .append('path')
            .classed('sl', true)
            .attr('d', d => line(d.values.slice(1)))
            .style('fill', 'none')
            .style('stroke-width', 2)
            .style('stroke', d => (sourcesOrder[d.key].is_vde) ? cols.green : cols.orange);

        const textLabs = svg.selectAll('text.lab')
            .data(dat)
            .enter()
            .append('text')
            .classed('lab', true)
            .attr('y', d => scaleSm(d.key) + scaleSm.bandwidth() - fontSize)
            .attr('x', svgM.left)
            .text(d => d.key);

        const gYAxis = svg.append('g')
            .attr('transform', `translate(${svgW - svgM.left} ${scaleSm('Газ')})`)
            .call(yAxis);
    };

    const dragLineW = 3;
    const maxDrag = svgW - dragLineW;

    const dragStart = function(d) {
        d3.select(this).raise().classed('active', true);
    };

    const dragged = function(d) {
        const dragTo = d3.max([dragLineW, d3.min([d3.event.x, maxDrag])]);

        d3.select(this)
            .attr('transform', `translate(${dragTo} 0)`);
        
        transSvg.attr('width', dragTo)
    };

    const dragEnd = function(d) {
        d3.select(this).classed('active', false);
    };


    drawChart(dirtySvg, 'Базовий');
    drawChart(transSvg, 'Революційний');

    const dragLine = draggingSvg.append('g')
        .style('pointer-events', 'auto')
        .attr('transform', `translate(${svgW - dragLineW} 0)`)
        .call(d3.drag()
            .on('start', dragStart)
            .on('drag', dragged)
            .on('end', dragEnd));

    dragLine.append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', 0)
        .attr('y2', svgH)
        .style('stroke-width', 3);
    
    // const dirtyLine = svg.selectAll('path.dirty')
    //     .data(nested)
    //     .enter()
    //     .append('path')
    //     .classed('dirty', true)
    //     .attr('d', function (d) {
    //         const dat = d.values
    //             .filter(v => v.key === 'Базовий');
    //
    //         if (dat.length > 0) {
    //             return line(dat[0].values.slice(1));
    //         }
    //     })
    //     .style('fill', 'none')
    //     // .style('stroke', chroma(cols.black).alpha(0.6))
    //     .style('stroke', 'none')
    //     .style('stroke-width', 2);

    const expl = d3.select('div#explanation')
        .append('ul');

    let explLi = expl.selectAll('li')
        .data(measures[activeSphere])
        .enter()
        .append('li')
        .html(d => d.match(/:$/) ? d : `<i class="fas fa-check"></i> ${d}`)
        .classed('subsection', d => d.match(/:$/) ? true : false);
    
    const updateSvg = function (svg) {
        svg.selectAll('path.sm')
            .transition()
            .duration(1000)
            .attr('d', d => area(d.values.slice(1)));

        svg.selectAll('path.sl')
            .transition()
            .duration(1000)
            .attr('d', d => line(d.values.slice(1)));
    };

    $('nav button').click(function () {
        $('nav button').removeClass('active');
        const $t = $(this);
        $t.addClass('active');
    
        activeSphere = $t.text();
    
        updateSvg(transSvg);
        updateSvg(dirtySvg);
    
        explLi = expl.selectAll('li')
            .data(measures[activeSphere]);
    
        explLi.enter()
            .append('li')
            .merge(explLi)
            .html(d => d.match(/:$/) ? d : `<i class="fas fa-check"></i> ${d}`)
            .classed('subsection', d => d.match(/:$/) ? true : false);
    
        explLi
            .exit()
            .remove();
    
    });
    
});

d3.csv('../data/costs.csv', numericalize).then(function (data) {
    const byType = d3.nest()
        .key(d => d.action)
        .key(d => d.scenario)
        .entries(data);

    const chart = d3.select('#costs figure');

    const sms = chart.selectAll('div.sm')
        .data(byType)
        .enter()
        .append('div')
        .classed('byType', true);

    const smHeader = sms.append('p')
        .text(d => d.key);

    const maxHSize = d3.max(smHeader.nodes().map(n => n.offsetHeight));

    const svgs = sms.append('svg')
        .attr('width', function () {
            return $(this).parent().width();
        })
        .attr('height', function () {
            return $(this).parent().height() - maxHSize;
        });

    const svg_m = {
        top: 5,
        right: 5,
        bottom: 20,
        left: 20,
    };

    const svgH = parseFloat(svgs.attr('height')),
        svgW = parseFloat(svgs.attr('width'));

    const yearScale = d3.scalePoint()
        .domain(['2012', '2015', '2020', '2025', '2030', '2035', '2040', '2045', '2050'])
        .range([svg_m.left, svgW - svg_m.right]);

    const costScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.m_euro)])
        .range([svgH - svg_m.bottom, svg_m.top]);

    const xAxis = d3.axisBottom(yearScale);
    const yAxis = d3.axisLeft(costScale);

    const line = d3.line()
        .x(d => yearScale(d.year.toString()))
        .y(d => costScale(d.m_euro));

    const colScen = {
        Консервативний: cols.orange,
        Ліберальний: cols.black,
        Революційний: cols.green,
    };

    const scenLines = svgs.selectAll('path')
        .data(d => d.values)
        .enter()
        .append('path')
        .classed('line', true)
        .attr('d', d => line(d.values))
        .style('fill', 'none')
        .style('stroke', d => colScen[d.key]);

    const xGAxis = svgs.append('g')
        .classed('x_axis', true)
        .attr('transform', `translate(0 ${svgH - svg_m.bottom})`)
        .call(xAxis);

    const yGAxis = svgs.append('g')
        .classed('y_axis', true)
        .attr('transform', `translate(${svg_m.left} 0)`)
        .call(yAxis);

    yGAxis.selectAll('text')
        .attr('x', '5')
        .attr('text-anchor', 'start')

});

// $(document).ready(function () {
//     tippy('path.sl', {
//         animation: 'fade',
//         theme: 'light',
//         performance: true,
//         onShow(tip) {
//             tip.setContent(tip.reference.getAttribute('data-source'));
//         },
//     });
// });