const d3 = require('d3');
const $ = require('jquery');

const yearParse = d3.utcParse("%Y");

const cols = {
    green: '#00a650', 
    black: '#3c353f', 
    orange: '#f26522',
    bgcol: '#f7f7f7',
};

const svg_m = {
    top: 15,
    right: 15,
    bottom: 5,
    left: 15,
};

const numericalize = function (d) {
    for (const k in d) {
        if (d[k].search(/[^0-9\.]/) === -1) {
            d[k] = +d[k];
        }
    }
    return d;
};

const scaleYear = d3.scaleTime()
    .domain([new Date(2012, 0, 1), new Date(2050, 0, 1)]);

const scaleKTNE = d3.scaleLinear();

const area = d3.area()
    .x(d => scaleYear(d.x))
    .y1(d => scaleKTNE(d.y1))
    .y0(d => scaleKTNE(d.y0));

const id2year = ['2012', '2035', '2050'];

let reshapeD = function (d) {
    const reshaped = d.map(([y0, y1], i) => {
        return {y0: y0 || 0, y1: y1 || 0, x: yearParse(id2year[i])}
    });
    return area(reshaped);
};

Promise.all([
    d3.csv('data_by_sphere_wide.csv', numericalize),
    d3.json('measures.json'),
    d3.json('sources_order.json', numericalize),
]).then(function ([data, measures, sourcesOrder]) {
    const bySpheres = d3.nest()
        .key(d => d.sphere)
        .entries(data);
    
    let sphereLi = d3.select('#chart nav ul')
        .selectAll('li')
        .data(bySpheres.map(d => d.key))
        .enter()
        .append('li')
        .append('button')
        .text(d => d)
        .attr('class', d => { if (d === 'Всього') return 'active'});

    const svg = d3.select('main figure svg')
        .attr('width', function () { return $(this).parent().width(); })
        .attr('height', function () { return $(window).height()*0.7; });

    const sources = [...Object.keys(sourcesOrder)];

    const stack = d3.stack()
        .keys(sources)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    let svgOff = $(svg.node()).offset();

    scaleYear
        .range([0 + svg_m.left, +svg.attr('width') - svg_m.right]);

    scaleKTNE
        .domain([0, 75000])
        .range([+svg.attr('height') - svg_m.bottom, 0 + svg_m.top]);

    const xAxis = d3.axisTop(scaleYear)
        .tickValues([new Date(2012, 0, 1), new Date(2035, 0, 1), new Date(2050, 0, 1)]);

    const yAxis = d3.axisLeft(scaleKTNE);
    
    let activeSphere = $('#chart nav ul button.active').text();
    let activeData = bySpheres.filter(d => d.key === activeSphere)[0].values;
    
    const expl = d3.select('div#explanation')
        .append('ul');
    
    expl.selectAll('li')
        .data(measures[activeSphere])
        .enter()
        .append('li')
        .html(d => d.match(/:$/) ? d : `<i class="fas fa-check"></i> ${d}`)
        .classed('subsection', d => d.match(/:$/) ? true : false);
    
    const areaChart = svg.selectAll('path')
        .data(stack(activeData))
        .enter()
        .append('path')
        .attr('d', reshapeD)
        .style('fill', d => {
            return sourcesOrder[d.key].is_vde ? cols.green : cols.black;
        });

    const gXAxis = svg.append('g')
        .classed('x_axis', true)
        .attr('transform', `translate(0, ${svg_m.top * 1.5})`)
        .call(xAxis);

    const gYAxis = svg.append('g')
        .classed('y_axis', true)
        .attr('transform', `translate(${svg_m.left}, -3)`)
        .call(yAxis);
    
    d3.selectAll('path.domain')
        .remove();

    gXAxis.selectAll('.tick line')
        .attr('stroke', cols.bgcol)
        .attr('y2', scaleKTNE(0) - svg_m.top * 1.5)
        .style('stroke-dasharray', '2,2');

    gXAxis.selectAll('.tick text')
        .attr('y', '-5')
        .attr('fill', cols.black)
        .attr('text-anchor', function (d, i) {
            switch (i) {
                case 0: return 'start';
                case 1: return 'middle';
                case 2: return 'end';
            }
        });

    gYAxis.selectAll('.tick text')
        .attr('fill', cols.orange)
        .attr('x', 5)
        .attr('text-anchor', 'start');

    $('nav button').click(function () {
        console.log(scaleKTNE.domain());
        $('nav button').removeClass('active');
        const $t = $(this);
        $t.addClass('active');

        activeSphere = $t.text();
        activeData = bySpheres.filter(d => d.key === activeSphere)[0].values;
        const stackedActiveData = stack(activeData);
        
        // scaleKTNE
        //     .domain([0, d3.max(stackedActiveData, d => d[d.length-1][1])]);

        scaleKTNE
            .domain([0, d3.max(stackedActiveData, d => {
                return d3.max([].concat(...d));
            }) * 1.1]);
        
        console.log(scaleKTNE.domain());

        areaChart
            .data(stackedActiveData)
            .transition()
            .duration(1000)
            .attr('d', reshapeD);

        gYAxis.transition()
            .duration(1000)
            .call(yAxis);
    });




});






