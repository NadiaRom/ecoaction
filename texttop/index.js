const scrollama = require('scrollama');
const $ = require('jquery');
const d3 = require('d3');
const chroma = require('chroma-js');
const tippy = require('tippy.js');
// const labella = require('labella');


const cols = {
    green: '#658b5b',
    black: '#3c353f',
    orange: '#f16f39',
    bgcol: '#f7f7f7',
    lightblack: '#464646',
};

const nform = d => d3.format(',.5r')(d).replace(/\..*/, '');


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
    d3.xml('../drag.svg'),
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
        let datLines = nest_vde[scenario];

        const gXAxis = linesSvg.append('g')
            .attr('id', 'x_axis')
            .attr('transform', `translate(0 ${scaleKTNE(0)})`)
            .call(xAxis);

        gXAxis.selectAll('.tick text')
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
            .attr('transform', `translate(0 -${fontSize})`)
            .append('text')
            .append('textPath')
            .attr('href', d => `#line_${d.key}`)
            .text(d => (d.key === 'vde') ? '    Зелена енергія' : '    Невідновлювані джерела');

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

        const dotsG = linesSvg.selectAll('g.circle_g')
            .data(datLines)
            .enter()
            .append('g')
            .classed('circle_g', true);
        
        const dots = dotsG.selectAll('circle')
            .data(d => d.values.slice(1))
            .enter()
            .append('circle')
            .attr('cx', d => scaleYear(d.year))
            .attr('cy', d => scaleKTNE(0))
            .attr('r', 5)
            .attr('class', d => d.by_vde)
            .style('fill', d => (d.by_vde === 'vde') ? cols.green : cols.orange);
        

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
            appendTo: document.querySelector('main'),
            onShow: function (tip) {
                const d = tip.reference.__data__;
                const is_vde = d.by_vde || (sourcesOrder[d.source].is_vde) ? 'vde' : 'dirt'
                tip.setContent(`
            <p class="small"><span class="${is_vde}">${d3.format(",.2r")(d[activeSphere])} тис. т н.е.</span></p>
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
                Math.ceil(d3.max(datLines[0].values.concat(datLines[1].values),
                        d => d[activeSphere]) / 1000
                ) * 1000
            ]);

            gYAxis.transition()
                .duration(500)
                .call(yAxis);

            sourceLine.data(datLines)
                .transition()
                .duration(500)
                .attr('d', d => line(d.values.slice(1)))
                .on('end', function () {
                    textPath
                        .attr('href', null)
                        .attr('href', d => `#line_${d.key}`);
                });
            
            dotsG.data(datLines);
            
            dots.data(d => d.values.slice(1))
                .transition()
                .duration(500)
                .attr('cx', d => scaleYear(d.year))
                .attr('cy', d => scaleKTNE(d[activeSphere]));

            // dragYear = 2015;
            // dragEnd();
        };

        // SCROLLAMA -----------------------------------------------------------------------------------------

        const dragMeTip = tippy(document.querySelectorAll('#lines #year_dragger'), {
            trigger: 'manual',
            appendTo: document.querySelector('main'),
            animation: 'fade',
            placement: 'top',
            content: `
        <p>Потягніть лінію, щоб побачити детальні зміни</p>
        `,
        })

        const scroller = scrollama();

        scroller.setup({
            step: '#consumption article .text',
            container: '#consumption',
            graphic: '#consumption .fig_container',
            offset: 0.8,
        })
            .onContainerEnter(function (r) {
                updateLines();
                updateBar();
            })
            .onStepEnter(function (r) {
                if (r.element.id !== 'phantom') {
                    activeSphere = r.element.getAttribute('data-sphere');
                    $('#consumption .h3 h3 span').text(activeSphere.toLowerCase());
                    updateLines();
                    updateBar();
                }
            })
            .onContainerExit(function (r) {
                $('#consumption').removeClass('dark');
                $('main').removeClass('dark');
                scenario = 'Революційний';
                datYear = nest_year[scenario];
                datLines = nest_vde[scenario];
                $('#consumption #switch_scenario').text('Революційний');

            });
        
        $('#consumption #switch_scenario').click(function (e) {
            const $t = $(this);
            $('#consumption').toggleClass('dark');
            $('main').toggleClass('dark');
            scenario = ($t.text() === 'Революційний') ? 'Базовий' : 'Революційний';
            datYear = nest_year[scenario];
            datLines = nest_vde[scenario];
            updateLines();
            updateBar();
            $t.text(scenario);
        })
        
    });

Promise.all([
    d3.csv('data/costs_agg_wide.csv', numericalize)
])
    .then(function ([data]) {
        const nested = d3.nest()
            .key(d => d.action)
            .key(d => d.scenario)
            .entries(data);
        
        // const scaleColor = d3.scaleOrdinal()
        //     .domain(['Вартість палива', 'Транспортування, постачання та проміжні технології', 'Експлуатаційні витрати', 'Капітальні інвестиції', 'Субсидії («зелений» тариф)'])
        //     .range(['#e7298a','#d95f02','#7570b3','#1b9e77','#66a61e']);

        const scaleColor = d3.scaleOrdinal()
            .domain(['Вартість палива', 'Транспортування, постачання та проміжні технології', 'Експлуатаційні витрати', 'Капітальні інвестиції', 'Субсидії («зелений» тариф)'])
            .range(['#ee4d30','#241d58','#f69a33','#1dada6','#81b652']);

        let activeYear = '2050';
        
        const svg = d3.select('#costs figure svg')
            .attr('height', function () {
                return $(this).parent().height();
            })
            .attr('width', function () {
                return $(this).parent().width();
            });

        const circleR = 5;
        
        const svgW = parseInt(svg.attr('width'));
        const svgH = parseInt(svg.attr('height'));
        const svgM = {
            top: fontSize * 2.5,
            right: circleR + 1,
            bottom: fontSize * 1,
            left: 1,
        };

        const scaleExpence = d3.scaleLinear()
            .domain([0, 60000])
            .range([svgH - svgM.bottom, svgH * 0.33 + svgM.top]);

        const getTextLen = function () {
            const t = svg.append('text')
                .text('Енергоспоживання');
            const w = t.node().getComputedTextLength();
            t.remove();
            return w;
        };
        
        const labW = getTextLen();

        const labs = svg.append('g')
            .attr('id', 'labels')
            .selectAll('text.lab')
            .data(nested)
            .enter()
            .append('text')
            .classed('lab', true)
            .text(d => d.key)
            .attr('data-cost', d => d.key)
            .style('fill', d => chroma(scaleColor(d.key)).darken(2))
            .each(function () {
                const text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    lineH = 1.1;

                let word = null,
                    line=[],
                    tspan = text.text(null)
                        .append('tspan')
                        .attr('x', 0)
                        .attr('dy', 0);

                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(' '));
                    if (tspan.node().getComputedTextLength() > labW) {
                        line.pop();
                        tspan.text(line.join(' '));
                        line = [word];
                        tspan = text.append('tspan')
                            .attr('x', 0)
                            .attr('dy', `${lineH}em`)
                            .text(word);
                    }
                }
            });
        
        const checkOverlap = function () {
            labs.sort((a, b) => {
                return scaleExpence(a.values[0].values[0][activeYear]) < scaleExpence(b.values[0].values[0][activeYear])
                ? 1 : -1;
            })
                .transition()
                .duration(200)
                .attr('y', function (d) {
                    const h0 = this.getBBox().height,
                        y0 = scaleExpence(d.values[0].values[0][activeYear]);
                    if (! this.previousSibling) {
                        this.__data__['y'] = y0;
                        return y0;
                    }
                    const y1 = this.previousSibling.__data__.y;
                    if (y0 + h0 + fontSize*0.375 <= y1) {
                        this.__data__['y'] = y0;
                        return y0;
                    }
                    this.__data__['y'] = y1 - fontSize*0.375 - h0;
                    return d.y;
                })
        };

        checkOverlap();

        const textX = svg.select('#labels').node().getBBox().width;

        svgM.left = textX + fontSize * 0.5 + circleR * 2;
        labs.style('text-anchor', 'start')
            .attr('x', svgM.left - fontSize*0.5 - circleR * 2);
        
        labs.selectAll('tspan')
            .attr('x', function() { return textX - this.getComputedTextLength(); });
        
        const scaleScen = d3.scalePoint()
            .domain(['Консервативний', 'Революційний'])
            .range([svgM.left, svgW - svgM.right]);
        
        const [x1, x2] = scaleScen.range();

        const xAxis = d3.axisTop(scaleScen);
            // .tickValues([2015, 2050])

        const rectSepJchart = svg.append('path')
            .attr('id', 'jsep')
            // .attr('d', `M${scaleScen.range()[0]} ${scaleExpence.range()[1] - circleR*0.7}
            //             L${scaleScen.range()[1]} ${scaleExpence.range()[1] - circleR*0.7}`);
            .attr('d', `M${scaleScen.range()[0]} ${scaleExpence.range()[1]}
                        L${scaleScen.range()[1]} ${scaleExpence.range()[1]}
                        L${scaleScen.range()[1]} ${fontSize}
                        L${scaleScen.range()[0]} ${fontSize}
                        `);

        const gXAxis = svg.append('g')
            .attr('id', 'cost_ax_x')
            .call(xAxis)
            .attr('transform', `translate(0 ${svgM.bottom})`);
        //
        gXAxis.selectAll('.tick line')
            .attr('y1', (scaleExpence.range()[0]))
            .attr('y2', 0);

        gXAxis.selectAll('path').remove();
        
        const yLabs = svg.selectAll('text.y_lab')
            .data(scaleExpence.domain())
            .enter()
            .append('text')
            .classed('y_lab', true)
            .text(d => nform(d))
            .attr('y', d => scaleExpence(d))
            .attr('x', x1 + 2);

        const slopeGs = svg.selectAll('g.slope')
            .data(nested)
            .enter()
            .append('g')
            .classed('slope', true)
            .attr('data-cost', d => d.key);
        
        $('#costs [data-cost]')
            .css('cursor', 'pointer')
            .on('mouseover', function () {
                const c = $(this).data('cost');
                $(`g.slope[data-cost="${c}"] circle`)
                    .each(function() {this._tippy.show(500)});
                $('#costs svg [data-cost]')
                    .not(`[data-cost="${c}"]`)
                    .addClass('blured');
            })
            .on('mouseout', function () {
                tippy.hideAllPoppers();
                $('.blured').removeClass('blured');
            });

        const slopeLines = slopeGs
            .append('path')
            .attr('d', d => `M ${x1} ${scaleExpence(d.values[0].values[0][activeYear])} L${x2} ${scaleExpence(d.values[1].values[0][activeYear])}`)
            .style('stroke', d => scaleColor(d.key));
        
        const slopeCircles = slopeGs.selectAll('circle')
            .data(d => d.values)
            .enter()
            .append('circle')
            .attr('cx', d => scaleScen(d.key))
            .attr('cy', d => scaleExpence(d.values[0][activeYear]))
            .attr('r', circleR)
            .style('fill', d => scaleColor(d.values[0].action));

        const slopeHelpers = slopeLines.clone()
            .style('stroke-opacity', 0)
            .style('stroke-width', 10)
            .style('fill', 'none');

        const bubleH = scaleExpence.range()[1] - fontSize;

        const scaleR = d3.scaleLinear()
            .domain([0, 116000])
            .range([0, d3.min([
                rectSepJchart.node().getBBox().width,
                bubleH - fontSize*3
            ])]);

        const totalBubbles = svg.selectAll('path.t_bubble')
            .data(d3.nest()
                .key(d => d.scenario)
                .entries(data)
            )
            .enter()
            .append('path')
            .classed('t_bubble', true)
            .attr('d', function (d) {
                const r = scaleR(d3.sum(d.values, a => a[activeYear])),
                    my = d.key === 'Консервативний'
                        ? r + (bubleH - r) / 2 + fontSize
                        : (bubleH - r) / 2 + fontSize,
                    ar = d.key === 'Консервативний' ? -r : r;

                return `M ${scaleScen(d.key)} ${my}
                        a1,1 0 0,0 0,
                        ${ar}`
            })
            .style('fill', d => d.key === 'Консервативний' ? cols.orange : cols.green)
            .style('stroke', d => d.key === 'Консервативний' ? cols.orange : cols.green);

        const totalBLab = svg.append('text')
            .attr('id', 't_bubble_lab')
            .text('Загалом')
            .attr('x', textX)
            .attr('y', bubleH / 2 + fontSize)
            .style('dominant-baseline', 'middle')
            .style('text-anchor', 'end');

        const totalBVal = svg.selectAll('text.t_bubble_val')
            .data(totalBubbles.data())
            .enter()
            .append('text')
            .classed('t_bubble_val', true)
            .text(d => nform(d3.sum(d.values, a => a[activeYear])))
            .attr('x', d => scaleScen(d.key))
            .attr('y', function (_, i) {
                return totalBubbles.nodes()[i].getBBox().y - fontSize*0.3;
            })
            .style('fill', d => d.key === 'Консервативний'
                ? chroma(cols.orange).darken()
                : chroma(cols.green).darken()
            )
            .style('text-anchor', d => d.key === 'Консервативний' ? 'start' : 'end');
        
        const updSlopes = function () {
            slopeGs.selectAll('path')
                .transition()
                .duration(600)
                .attr('d', d => `M ${x1} ${scaleExpence(d.values[0].values[0][activeYear])}
                                 L${x2} ${scaleExpence(d.values[1].values[0][activeYear])}`);

            slopeCircles
                .transition()
                .duration(600)
                .attr('cx', d => scaleScen(d.key))
                .attr('cy', d => scaleExpence(d.values[0][activeYear]));

            totalBubbles
                .transition()
                .duration(600)
                .attr('d', function (d) {
                    const r = scaleR(d3.sum(d.values, a => a[activeYear])),
                        my = d.key === 'Консервативний'
                            ? r + (bubleH - r) / 2 + fontSize
                            : (bubleH - r) / 2 + fontSize,
                        ar = d.key === 'Консервативний' ? -r : r;
                    
                    return `M ${scaleScen(d.key)} ${my}
                        a1,1 0 0,0 0,
                        ${ar}`
                });

            totalBVal
                .transition()
                .duration(600)
                .text(d => nform(d3.sum(d.values, a => a[activeYear])))
                .attr('y', function (d) {
                    const r = scaleR(d3.sum(d.values, a => a[activeYear]));
                    return (bubleH - r) / 2 + fontSize*0.7;
                });

            checkOverlap();
        };

        $('#costs .h3 i').click(function () {
            const $t = $(this);
            if ($t.hasClass('active')) {
                const $sp = $t.siblings('span'),
                    dir = $t.hasClass('fa-caret-left') ? -1 : 1;
                activeYear = (parseInt($sp.text()) + 5 * dir).toString();
                if (activeYear === '2050' || activeYear === '2015') {
                    $t.removeClass('active');
                } else if (activeYear === '2045' || activeYear === '2020') {
                    $t.siblings('i').addClass('active');
                }

                $sp.text(activeYear);
                updSlopes();
            }
        });
        
        const slopeTippy = tippy(document.querySelectorAll('#costs g.slope circle'), {
            animation: 'fade',
            onShow(tip) {
                tip.setContent(`
                <p class="sm">${nform(tip.reference.__data__.values[0][activeYear])} млн. €</p>
                `)
            },
            trigger: 'manual',
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