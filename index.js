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

const svg_m = {
    top: 25,
    right: 15,
    bottom: 5,
    left: 15,
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

const scaleYear = d3.scalePoint()
    .domain([2012, 2035, 2050]);

const scaleSource = d3.scalePoint();

const scaleKTNE = d3.scaleLinear()
    .domain([0, 67000]);

const id2year = [2012, 2035, 2050];

let reshapeD = function (d) {
    const reshaped = d.map(([y0, y1], i) => {
        return {y0: y0 || 0, y1: y1 || 0, x: yearParse(id2year[i])}
    });
    return area(reshaped);
};

Promise.all([
    d3.csv('data_by_sphere.csv', numericalize),
    d3.json('measures.json'),
    d3.json('sources_order.json', numericalize),
]).then(function ([data, measures, sourcesOrder]) {
   
    const bySpheres = d3.nest()
        .key(d => d.sphere)
        .entries(data);
    
    let sphereLi = d3.select('#chart nav ')
        .selectAll('button')
        .data(bySpheres.map(d => d.key))
        .enter()
        .append('button')
        .text(d => d)
        .attr('class', d => { if (d === 'Всього') return 'active'});

    const svg = d3.select('main figure svg')
        .attr('width', function () { return $(this).parent().width(); })
        .attr('height', function () { return $(window).height()*0.7; });

    const sources = [...Object.keys(sourcesOrder)];

    scaleSource
        .domain(sources)
        .range([+svg.attr('height') - svg_m.bottom, 0 + svg_m.top]);

    const yAxis = d3.axisLeft(scaleSource);

    const gYAxis = svg.append('g')
        .attr('id', 'y_axis')
        .attr('transform', `translate(${svg_m.left}, -3)`)
        .call(yAxis);
    
    gYAxis.selectAll('path, line')
        .remove();

    gYAxis.selectAll('text')
        .attr('text-anchor', 'start')
        .attr('x', 0)
        .attr('fill', cols.black);

    const getCircleStart = function () {
        const bbox = (gYAxis).node().getBBox();
        return bbox.x + bbox.width + fontSize*2;
    };
    
    const getYearWidth = function () {
        return d3.min([
            ((+svg.attr('width') - getCircleStart()) / 3) * 0.85,
            scaleSource(sources[0]) - scaleSource(sources[1]) - fontSize/2
        ]);
    };

    let circleStart = getCircleStart(),
        yearWidth = getYearWidth();

    scaleYear
        .range([svg_m.left + circleStart, svg_m.left + circleStart + yearWidth*3 + fontSize*4])
        .padding(fontSize / (yearWidth*3 + fontSize*4));
    
    scaleKTNE
        .range([5, yearWidth]);

    svg.attr('width', scaleYear.range()[1]);

    let svgOff = $(svg.node()).offset();

    const xAxis = d3.axisTop(scaleYear)
        .tickValues([2012, 2035, 2050]);

    const gXAxis = svg.append('g')
        .attr('id', 'x_axis')
        .attr('transform', `translate(0, ${svg_m.top * 1.5})`)
        .call(xAxis);

    gXAxis.selectAll('path, line')
        .remove();

    gXAxis.selectAll('text')
        .attr('text-anchor', 'start')
        .attr('x', 0)
        .attr('fill', cols.black);
    
    let activeSphere = $('#chart button.active').text();
    let activeData = bySpheres.filter(d => d.key === activeSphere)[0].values;
    
    const expl = d3.select('div#explanation')
        .append('ul');
    
    let explLi = expl.selectAll('li')
        .data(measures[activeSphere])
        .enter()
        .append('li')
        .html(d => d.match(/:$/) ? d : `<i class="fas fa-check"></i> ${d}`)
        .classed('subsection', d => d.match(/:$/) ? true : false);
    
    const totalCircles = svg.selectAll('circle')
        .data(activeData)
        .enter()
        .append('circle')
        .attr('cx', function (d) {
            debugger;
        })
        .attr('cy', function (d) {
            
        })
        .attr('r', d => d)

    // const areaLines = svg.selectAll('path.area_line')
    //     .data(stackedActiveData)
    //     .enter()
    //     .append('path')
    //     .classed('area_line', true)
    //     .attr('d', (d) => {
    //         const coords = d3.select(`path.area_path[data-source="${d.key}"]`)
    //             .attr('d')
    //             .split(/[MLZ]/)
    //             .filter(v => v)
    //             .map(v => JSON.parse(`[${v}]`));
    //        
    //         const maxSpace = [...new Array(3)].reduce(function (total=[0, 0], v, i) {
    //             const diff = coords[coords.length - 1 -i][1] - coords[i][1];
    //             return (diff > total[0]) 
    //                 ? [diff, i]
    //                 : total;
    //         });
    //        
    //         debugger;
    //     });

    // const gXAxis = svg.append('g')
    //     .classed('x_axis', true)
    //     .attr('transform', `translate(0, ${svg_m.top * 1.5})`)
    //     .call(xAxis);
    //
    // const gYAxis = svg.append('g')
    //     .classed('y_axis', true)
    //     .attr('transform', `translate(${svg_m.left}, -3)`)
    //     .call(yAxis);
    
    d3.selectAll('path.domain')
        .remove();

    gXAxis.selectAll('.tick line')
        .attr('stroke', chroma(cols.bgcol).darken(2).hex())
        .attr('y2', scaleKTNE(0) - svg_m.top * 1.5)
        .style('stroke-dasharray', '2,2');

    gXAxis.selectAll('.tick text')
        .attr('y', '-15')
        .attr('fill', cols.black)
        .attr('text-anchor', function (d, i) {
            switch (i) {
                case 0: return 'start';
                case 1: return 'middle';
                case 2: return 'end';
            }
        });

    gYAxis.selectAll('.tick text')
        .attr('fill', cols.black)
        .attr('x', 5)
        .attr('text-anchor', 'start');

    $('nav button').click(function () {
        $('nav button').removeClass('active');
        const $t = $(this);
        $t.addClass('active');

        activeSphere = $t.text();
        activeData = bySpheres.filter(d => d.key === activeSphere)[0].values;
        stackedActiveData = stack(activeData);

        scaleKTNE
            .domain([0, d3.max(stackedActiveData, d => {
                return d3.max([].concat(...d));
            }) * 1.1]);

        areaChart
            .data(stackedActiveData)
            .transition()
            .duration(1000)
            .attr('d', reshapeD);

        gYAxis.transition()
            .duration(1000)
            .call(yAxis)
            .selectAll('.tick text')
            .attr('fill', cols.orange)
            .attr('x', 5)
            .attr('text-anchor', 'start');

        d3.selectAll('path.domain')
            .remove();

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

    $(document).ready(function () {
        tippy('.area_path', {
            followCursor: true,
            animation: 'perspective',
            arrow: true,
            performance: true,
            arrowType: 'round',
            onShow(tip) {
                tip.setContent(tip.reference.getAttribute('data-source'));
            },
        });
    });
    
});






