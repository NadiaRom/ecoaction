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
    d3.csv('data_by_source.csv', numericalize),
    d3.json('measures.json'),
    d3.json('sources_order.json', numericalize),
]).then(function ([data, measures, sourcesOrder]) {
    
    const sphereButtons = d3.select('#chart nav ')
        .selectAll('button')
        .data(Object.keys(data[0]).slice(3))
        .enter()
        .append('button')
        .text(d => d)
        .attr('class', d => { if (d === 'Всього') return 'active'});
    
    const sources = [...Object.keys(sourcesOrder)];
    
    const chart = d3.select('#chart figure');
    
    const yearHeader = chart.selectAll('div.year')
        .data(['', '2012', '2035', '2050'])
        .enter()
        .append('div')
        .classed('year', true)
        .text(d => d);

    let activeSphere = $('#chart button.active').text();
    
    const sourceAxis = chart.selectAll('div.source_name')
        .data(sources)
        .enter()
        .append('div')
        .classed('source_name', true)
        .text(d => d);
    
    const yearCols = {
        2012: '2 / 3',
        2035: '3 / 4',
        2050: '4 / 5',
    };

    const sourceCharts = chart.selectAll('div.source_value')
        .data(data)
        .enter()
        .append('div')
        .classed('source_value', true)
        .style('grid-row', function (d) {
            const r = sources.indexOf(d.source) + 2;
            return `${r} / ${r + 1}`
        })
        .style('grid-column', d => yearCols[d.year.toString()]);
    
    let svgH = d3.min([
        $('.source_value').height(),
        $('.source_value').width(),
    ]);

    const ktneSvg = sourceCharts
        .append('svg')
        .attr('viewBox', '-50 -50 100 100')
        .attr('width', svgH)
        .attr('height', svgH)
        .attr('data-source', d => `${d[activeSphere]} тис. тон н.е.`);
    
    $('#chart').css('grid-template-columns', 'auto 1fr');
    
    const ktneCircles = ktneSvg.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', d => scaleKTNE(d[activeSphere]))
        .style('fill', d => (d.is_vde > 0) ? cols.green : cols.black);
    
    const totalCircles = ktneCircles.clone()
        .style('fill', 'none')
        .style('stroke', chroma(cols.black).alpha(0.3))
        .style('stroke-width', '2px')
        .style('stroke-dasharray', '2 3')
        .style('opacity', 0);
    
    const expl = d3.select('div#explanation')
        .append('ul');
    
    let explLi = expl.selectAll('li')
        .data(measures[activeSphere])
        .enter()
        .append('li')
        .html(d => d.match(/:$/) ? d : `<i class="fas fa-check"></i> ${d}`)
        .classed('subsection', d => d.match(/:$/) ? true : false);

    $('nav button').click(function () {
        $('nav button').removeClass('active');
        const $t = $(this);
        $t.addClass('active');

        activeSphere = $t.text();

        ktneSvg
            .attr('data-source', d => `${d[activeSphere]} тис. тон н.е.`);

        ktneCircles
            .transition()
            .duration(1000)
            .attr('r', d => scaleKTNE(d[activeSphere]));

        totalCircles.transition()
            .duration(1000)
            .style('opacity', (activeSphere === 'Всього') ? 0 : 1);

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
        tippy('.source_value svg', {
            animation: 'fade',
            theme: 'light',
            performance: true,
            onShow(tip) {
                tip.setContent(tip.reference.getAttribute('data-source'));
            },
        });
    });
});

d3.csv('costs.csv', numericalize).then(function (data) {
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
        .domain(['2012', '2015', '2020', '2025', '2030', '2035', '2040', '2050'])
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
        .call(yAxis)
    
});






