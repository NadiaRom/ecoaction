const $ = require('jquery');
const d3 = require('d3');
const chroma = require('chroma-js');
const tippy = require('tippy.js');
require('intersection-observer');
const scrollama = require('scrollama');

const cols = {
    green: '#3bdf14',
    black: 'rgb(51, 51, 51)',
    orange: '#ce73e9',
    bgcol: '#f7f7f7',
    blue: '#608cc4',
    lightblack: '#787878f',
};

const nform = d => d3.format(',.6r')(d).replace(/\..*/, '');
const mobW = 577;

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
])
    .then(function ([data_vde, data_year, sourcesOrder]) {
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

        // DRAW BARS ------------------------------------------------------------------------------------------
        const $hYear = $('#consumption #bar_year')
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
            .attr('r', (window.innerWidth < mobW) ? 3 : 5);
        
        // Lines mobile height

        const linesW = $('#consumption figure .chart#lines').width();
        const linesH = $('#consumption figure .chart#lines').height();

        const linesSvg = d3.select('#consumption figure .chart#lines')
            .append('svg')
            .attr('width', linesW)
            .attr('height', linesH);

        const linesM = {
            top: fontSize*0.25,
            right: linesW * 0.1,
            bottom: linesW * 0.05,
            left: linesH * 0,
        };

        const scaleYear = d3.scaleLinear()
            .domain([2015, 2050])
            .range([linesM.left, linesW - linesM.right]);

        const scaleKTNE = d3.scaleLinear()
            .domain([0, 0])
            .range([linesH - linesM.bottom, linesM.top]);

        const line = d3.line()
            .x(d => scaleYear(d.year))
            .y(d => scaleKTNE(d[activeSphere]))
            .curve(d3.curveCatmullRom);

        const xAxis = d3.axisBottom()
            .scale(scaleYear)
            .ticks(8)
            .tickFormat(d => d.toString());

        const yAxis = d3.axisRight()
            .scale(scaleKTNE)
            .tickFormat(nform);


        // DRAW CHART------------------------------------------------------------------------------------------
        let datLines = nest_vde[scenario];

        const gXAxis = linesSvg.append('g')
            .attr('id', 'x_axis')
            .attr('transform', `translate(0 ${scaleKTNE.range()[0]})`)
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

        const dragHelperW = d3.max([linesW * 0.05, 10]);

        dragger.append('line')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', scaleKTNE.range()[1])
            .attr('y2', scaleKTNE.range()[0]);

        dragger.append('rect')
            .attr('x', dragHelperW / 2 * (-1))
            .attr('y', scaleKTNE.range()[1])
            .attr('height', scaleKTNE.range()[0])
            .attr('width', dragHelperW)
            .style('stroke', 'none')
            .style('fill', cols.bgcol)
            .style('opacity', 0);

        dragger.append('line')
            .attr('x1', -5)
            .attr('x2', 5)
            .attr('y1', scaleKTNE.range()[1])
            .attr('y2', scaleKTNE.range()[1]);

        // USER TIPS TO NAVIGATE ----------------------------------------------------------------------------
        const navigation = linesSvg.append('g')
            .attr('id', 'consumption_nav');

        const dragBBox = dragger.node().getBBox();

        const navigationText = navigation.append('text')
            .text('Потягніть за лінію, щоб переключити рік')
            .attr('x', dragBBox.x + dragBBox.width / 2 + fontSize * 2);

        const navigationArrow = navigation.append('path')
            .attr('id', 'drag_nav');
        
        if (window.innerWidth < mobW) {
            navigationText
                .attr('y', dragBBox.y + fontSize / 2);
            
            navigationArrow
                .attr('d', `
                M${dragBBox.x + dragBBox.width / 1.9} ${dragBBox.y}
                Q${dragBBox.x + dragBBox.width / 1.9} ${dragBBox.y + fontSize * 0.25}
                 ${dragBBox.x + dragBBox.width / 1.9 + fontSize * 1.9} ${dragBBox.y + fontSize * 0.5}
                        `);
        } else {
            navigationText
                .attr('y', dragBBox.y + fontSize*2);
            
            navigationArrow
                .attr('d', `
                M${dragBBox.x + dragBBox.width / 1.9} ${dragBBox.y}
                Q${dragBBox.x + dragBBox.width / 1.9} ${dragBBox.y + fontSize}
                 ${dragBBox.x + dragBBox.width / 1.9 + fontSize * 1.9} ${dragBBox.y + fontSize*1.9}
                        `)
        }

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
            .attr('r', (window.innerWidth < mobW) ? 3 : 5)
            .attr('class', d => d.by_vde)
            .style('fill', d => (d.by_vde === 'vde') ? cols.green : cols.orange);

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
                .text(d => `${nform(d[activeSphere])} тис. т н.е.`);
            
            $hYear.text(dragYear);
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
                const is_vde = (d.source) 
                    ? ((sourcesOrder[d.source].is_vde) ? 'vde' : 'dirt')
                    : d.by_vde;
                tip.setContent(`
            <p class="small"><span class="${is_vde}">${nform(d[activeSphere])} тис. т н.е.</span></p>
            `);
            },
        });

        const dragStart = function() {
            $('#consumption #consumption_nav').css('opacity', 0);
            d3.select(this).classed('active', true);
        };

        const dragged = function() {
            const dragTo = d3.min([scaleYear(2050), d3.max([scaleYear(2015), d3.event.x])]);
            dragYear = Math.round(scaleYear.invert(dragTo) / 5) * 5;
            dragger.attr('transform', `translate(${dragTo} 0)`);
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
        const scaleColor = d3.scaleOrdinal()
            .domain(['загалом', 'населення', 'промисловість', 'сільське господарство', 'транспорт', 'сфера послуг'])
            .range([cols.lightblack, '#ff554e','#ff7bac','#ffa25c','#00afc9','#3EEC15']);
        
        const $textLiMarks = $('#consumption .text li i');

        const scroller = scrollama();

        scroller.setup({
            step: '#consumption .text_cont',
            container: '#consumption',
            graphic: '#consumption .fig_container',
            offset: 0.85,
        })
            .onContainerEnter(function (r) {
                updateLines();
                updateBar();
            })
            .onStepEnter(function (r) {
                if (r.element.id !== 'phantom') {
                    activeSphere = r.element.getAttribute('data-sphere');
                    const $h3Span = $('#consumption .h3 #h3_sphere');
                    if ((window.innerWidth < mobW) && ($h3Span.text() !== activeSphere.toLowerCase())) {
                        $h3Span.text(activeSphere.toLowerCase());
                    } else if ($h3Span.text() !== activeSphere.toLowerCase()) {
                        $h3Span.css('height', '0');
                        setTimeout(function () {
                            $h3Span.text(activeSphere.toLowerCase())
                                .css('height', '');
                        }, 375)
                    }
                    // $h3Span.css('color', scaleColor(activeSphere));
                    
                    updateLines();
                    updateBar();
                }
                // if (r.index === 0) {
                //     navigation.style('opacity', 1)
                // } else if (r.index === 1) {
                //     navigation.style('opacity', 0)
                // }
            })
            .onContainerExit(function (r) {
                $('#consumption').removeClass('dark');
                $('main').removeClass('dark');
                scenario = 'Революційний';
                datYear = nest_year[scenario];
                datLines = nest_vde[scenario];
                $('#consumption .switch_scenario').removeClass('active')
                    .first()
                    .addClass('active');

                $textLiMarks.removeClass('fa-times').addClass('fa-check')
            });


        
        $('#consumption .switch_scenario').click(function (e) {
            const $t = $(this);
            if ($t.hasClass('active')) { return; }
            $('#consumption').toggleClass('dark');
            $('main').toggleClass('dark');
            $('#consumption .switch_scenario').removeClass('active');
            $t.addClass('active');
            scenario = $.trim($t.text());
            datYear = nest_year[scenario];
            datLines = nest_vde[scenario];
            updateLines();
            updateBar();
            const markClasses = (scenario === 'Революційний')
                ? ['fa-check', 'fa-times']
                : ['fa-times', 'fa-check'];
            $textLiMarks.removeClass(markClasses[1]).addClass(markClasses[0])
        });
        
    });

Promise.all([
    d3.csv('data/costs_agg_wide.csv', numericalize)
])
    .then(function ([data]) {
        const nested = d3.nest()
            .key(d => d.action)
            .key(d => d.scenario)
            .entries(data);
        
        const scaleColor = d3.scaleOrdinal()
            .domain(['Вартість палива', 'Транспортування, постачання та проміжні технології', 'Експлуатаційні витрати', 'Капітальні інвестиції', 'Субсидії («зелений» тариф)'])
            .range(['#ff554e','#ff7bac','#ffa25c','#00afc9','#3EEC15']);

        // const scaleColor = d3.scaleOrdinal()
        //     .domain(['Вартість палива', 'Транспортування, постачання та проміжні технології', 'Експлуатаційні витрати', 'Капітальні інвестиції', 'Субсидії («зелений» тариф)'])
        //     .range(['#ee4d30','#241d58','#f69a33','#1dada6','#81b652']);

        let activeYear = '2050';
        
        const svg = d3.select('#costs figure svg')
            .attr('height', function () {
                return $(this).parent().height();
            })
            .attr('width', function () {
                return $(this).parent().width();
            });

        const circleR = (window.innerWidth < mobW) ? 3 : 5;
        
        const svgW = parseInt(svg.attr('width'));
        const svgH = parseInt(svg.attr('height'));
        const svgM = {
            top: fontSize * 0.5,
            right: (window.innerWidth < mobW) ? fontSize * 3 : circleR + 1 + fontSize,
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
            // .style('fill', d => chroma(scaleColor(d.key)).darken(2))
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
            .domain(['Базовий', 'Революційний'])
            .range([svgM.left, svgW - svgM.right]);
        
        const [x1, x2] = scaleScen.range();

        const xAxis = d3.axisTop(scaleScen);
            // .tickValues(['Базовий', 'Революційний']);

        const gXAxis = svg.append('g')
            .attr('id', 'cost_ax_x')
            .call(xAxis);
        
        gXAxis.selectAll('.tick line')
            .attr('y1', scaleExpence.range()[0])
            .attr('y2', scaleExpence.range()[1]);

        gXAxis.selectAll('.tick text')
            .attr('y', scaleExpence.range()[1] - fontSize * 0.75);

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
        
        if (window.innerWidth < mobW) {
            $('#costs [data-cost]')
                .css('cursor', 'pointer')
                .on('click', function () {
                    const c = $(this).data('cost');
                    tippy.hideAllPoppers();
                    $('.blured').removeClass('blured');
                    $('#costs [data-cost].active').removeClass('active');
                    $(`g.slope[data-cost="${c}"]`)
                        .addClass('active')
                        .find('circle')
                        .each(function() {
                            this._tippy.show();
                        });
                    $('#costs svg [data-cost]')
                        .not(`[data-cost="${c}"]`)
                        .addClass('blured');
                    setTimeout(function () {
                        tippy.hideAllPoppers();
                        $('.blured').removeClass('blured');
                        $('#costs [data-cost].active').removeClass('active');
                    }, 7000)
                });
        } else {
            $('#costs [data-cost]')
                .css('cursor', 'pointer')
                .on('mouseover', function () {
                    const c = $(this).data('cost');
                    $(`g.slope[data-cost="${c}"]`)
                        .addClass('active')
                        .find('circle')
                        .each(function() {
                            this._tippy.show(500)
                        });
                    $('#costs svg [data-cost]')
                        .not(`[data-cost="${c}"]`)
                        .addClass('blured');
                })
                .on('mouseout', function () {
                    tippy.hideAllPoppers();
                    $('.blured').removeClass('blured');
                    $('#costs [data-cost].active').removeClass('active');
                });
        }

        const slopeLines = slopeGs
            .append('path')
            .attr('d', d => `M ${x1} ${scaleExpence(d.values[0].values[0][activeYear])} L${x2} ${scaleExpence(d.values[1].values[0][activeYear])}`);
            // .style('stroke', d => scaleColor(d.key));
        
        const slopeCircles = slopeGs.selectAll('circle')
            .data(d => d.values)
            .enter()
            .append('circle')
            .attr('cx', d => scaleScen(d.key))
            .attr('cy', d => scaleExpence(d.values[0][activeYear]))
            .attr('r', circleR);
            // .style('fill', d => scaleColor(d.values[0].action));

        const slopeHelpers = slopeLines.clone()
            .style('stroke-opacity', 0)
            .style('stroke-width', 10)
            .style('fill', 'none');

        const bubleH = scaleExpence.range()[1] - fontSize;

        const scaleR = d3.scaleLinear()
            .domain([0, 116000])
            .range([0, d3.min([
                slopeLines.node().getBBox().width,
                bubleH - fontSize*4
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
                    my = d.key === 'Базовий'
                        ? r + (bubleH - r) / 2 + fontSize
                        : (bubleH - r) / 2 + fontSize,
                    ar = d.key === 'Базовий' ? -r : r;

                return `M ${scaleScen(d.key)} ${my}
                        a1,1 0 0,0 0,
                        ${ar}`
            })
            .style('fill', d => d.key === 'Базовий' ? cols.orange : cols.green)
            .style('stroke', d => d.key === 'Базовий' ? cols.orange : cols.green);

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
            .style('fill', d => d.key === 'Базовий'
                ? chroma(cols.orange).darken()
                : chroma(cols.green).darken()
            )
            .style('text-anchor', d => d.key === 'Базовий' ? 'start' : 'end');
        
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
                        my = d.key === 'Базовий'
                            ? r + (bubleH - r) / 2 + fontSize
                            : (bubleH - r) / 2 + fontSize,
                        ar = d.key === 'Базовий' ? -r : r;
                    
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
                const $sp = $('#costs #costs_year'),
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


Promise.all([
    d3.csv('data/eresources_long.csv', numericalize),
])
    .then(function ([data]) {
        const sourcesList = [
            "Біопаливо та відходи",
            "Гідро",
            "Вітер",
            "Сонце",
            "Ресурс для АЕС",
            "Вугілля",
            "Газ",
            "Нафта",
        ]
        
        if (window.innerWidth < mobW) {
            data = data.filter(d => [2015, 2030, 2050].indexOf(d.year) > -1)
        }

        const nested = d3.nest()
            .key(d => d.year)
            .entries(data
                .filter(d => ['Всього', 'Імпорт'].indexOf(d.source) === -1)
                .sort((a, b) => (sourcesList.indexOf(a.source) > sourcesList.indexOf(b.source) ? 1 : -1))
            )
            .sort((a, b) => (parseInt(a.key) > parseInt(b.key)) ? 1 : -1);

        const svgW = $('#general figure').width(),
            svgH = $('#general figure').height(),
            svgM = {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1,
            };

        let scenario = 'Революційний';

        const svg = d3.select('#general figure svg')
            .attr('width', svgW)
            .attr('height', svgH);

        const scaleYear = d3.scaleBand()
            .domain(nested.map(d => d.key))
            .range([svgM.left, svgW - svgM.right])
            .padding((window.innerWidth < 100) ? 0.2 : 0.5);

        const scaleSource = d3.scaleBand()
            .domain(sourcesList)
            .range([0, scaleYear.bandwidth()])
            .padding(0.15);

        const strokeWidth = d3.min([scaleSource.bandwidth() / 3, 2.5]);

        const scaleKTNE = d3.scaleLinear()
            .domain([0, 50000])
            .range([0, svgH / 2 - svgM.top]);

        const area = d3.area()
            .x((d, i) => {
                if (i === 0) {
                    return scaleYear(d.year) - strokeWidth;
                } else if (i === 8) {
                    return scaleYear(d.year) + scaleSource(d.source) + scaleSource.bandwidth() / 2;
                } else {
                    return scaleYear(d.year) + scaleSource(d.source);
                }
            })
            .y1(d => svgH/2 + scaleKTNE(d[scenario]))
            .y0(d => svgH/2 - scaleKTNE(d[scenario]))
            .curve(d3.curveStep);

        const xAxis = d3.axisBottom(scaleYear)
            .ticks(8)
            .tickFormat(d => d.toString());

        const gXAxis = svg.append('g')
            .attr('id', 'x_ax_gen')
            .call(xAxis)
            .attr('transform', `translate(0 ${svgH - svgM.bottom})`);

        const scaleColor = d3.scaleOrdinal()
            .domain(['Вугілля', 'Газ', 'Ресурс для АЕС', 'Нафта', 'Біопаливо та відходи', 'Гідро', 'Вітер', 'Сонце',])
            .range(['#ce73e9','#ce73e9','#ff554e','#ce73e9','#3bdf14','#3bdf14', '#3bdf14', '#3bdf14',]);

        const areas = svg.append('defs')
            .selectAll('clipPath.clip_gen')
            .data(nested)
            .enter()
            .append('clipPath')
            .classed('clip_gen', true)
            .attr('id', d => `y${d.key}`)
            .append('path')
            .attr('d', d => area([d.values[0]].concat(d.values)));

        const linesG = svg.selectAll('g.year')
            .data(nested)
            .enter()
            .append('g')
            .classed('year', true)
            .style('clip-path', d => `url(#y${d.key})`);

        const nSteps = Math.floor((svgH - svgM.top - svgM.bottom) / (fontSize*3)) * 2 + 1;
        const step = (svgH - svgM.top - svgM.bottom) / nSteps;

        const lines = linesG.selectAll('path.source')
            .data(d => d.values)
            .enter()
            .append('path')
            .classed('source', true)
            .attr('d', function (d) {
                const x = scaleYear(d.year) + scaleSource(d.source),
                    dx = scaleSource.bandwidth() / 2 - strokeWidth / 1.5;
                let i = 0,
                    p = `M${x} ${svgM.top} `;
                while (i < nSteps) {
                    const dir = (i % 2) ? -1 : 1;
                    p += `q ${dir * dx} ${step / 2} 0 ${step}`;
                    i ++;
                }
                return p;
            })
            .style('stroke', d => scaleColor(d.source))
            .style('stroke-width', strokeWidth)
            .style('fill', 'none');

        const svgBCR = svg.node().getBoundingClientRect(),
            lineW = lines.node().getBoundingClientRect().width,
            linesGBCR = lines.nodes().map(e => {
                return {
                    x: e.getBoundingClientRect().left - svgBCR.left + lineW / 2,
                    e: e,
                }
            });
        const $nav = $("#general nav p");
        $nav.html(`${linesGBCR[0].e.__data__.year} рік<br/>
                   <strong>${linesGBCR[0].e.__data__.source}</strong>: ${nform(linesGBCR[0].e.__data__[scenario])} тис. т н.е.`);

        const navHelper = svg.append('path')
            .attr('id', 'nav_helper')
            .attr('d', `M${linesGBCR[0].e.getBoundingClientRect().x - svgBCR.x + lineW / 2}
                         ${svgH / 2 - scaleKTNE(linesGBCR[0].e.__data__[scenario]) - 2}
                        V 0
                         `);
        
        const transparentRect = svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', svgW)
            .attr('height', svgH)
            .style('opacity', 0)
            .on('mousemove', function () {
                const eX = d3.event.clientX - svgBCR.left;
                const lineDist = linesGBCR.map(d => Math.abs(d.x - eX));
                const closestLine = linesGBCR[lineDist.indexOf(d3.min(lineDist))];

                $nav.html(`${closestLine.e.__data__.year}  рік<br/>
                   <strong>${closestLine.e.__data__.source}</strong>: ${nform(closestLine.e.__data__[scenario])} тис. т н.е.`);

                const navBCR = $nav.get(0).getBoundingClientRect(),
                    maxMargin = svgBCR.right - navBCR.width / 2 - svgBCR.left;

                let perfectMargin = closestLine.x + lineW/2 - navBCR.width / 2;
                perfectMargin = (perfectMargin < 0) ? 0 : perfectMargin;
                perfectMargin = (perfectMargin > maxMargin) ? maxMargin : perfectMargin;
                $nav.css('margin-left', `${perfectMargin}px`);

                const navHelperY = svgH / 2 - scaleKTNE(closestLine.e.__data__[scenario]) - 2;
                navHelper.transition()
                    .duration(150)
                    .ease(d3.easeLinear)
                    .attr('d', `M${closestLine.x}
                             ${(navHelperY > 0) ? navHelperY : 0}
                            V 0
                           `);
            });

        // const legend = d3.select('#general figure #labels_gen')
        //     .style('top', `${d3.max(lines.data(), d => svgH / 2 + scaleKTNE(d[scenario])) + fontSize *1.5}px`);
        //
        // legend.selectAll('p.lab')
        //     .data(nested[0].values)
        //     .enter()
        //     .append('p')
        //     .classed('lab_gen', true)
        //     .attr('data-source', d => d.source)
        //     .text(d => d.source);
        //
        // const svgBCR = svg.node().getBoundingClientRect(),
        //     linesOnWay = lines.nodes().filter(e => e.getBBox().x < legend.node().getBoundingClientRect().width),
        //     curveYStart = scaleKTNE(d3.max(linesOnWay, e => e.__data__[scenario])) + svgH / 2 + fontSize*0.375;
        //
        // const labArrows = svg.append('g')
        //     .attr('id', 'lab_arrows')
        //     .selectAll('path.lab_arrow')
        //     .data(nested[0].values)
        //     .enter()
        //     .append('path')
        //     .classed('lab_arrow', true)
        //     .attr('d', function (d, i) {
        //         const pBCR = $(`#general p.lab_gen[data-source="${d.source}"]`).get(0).getBoundingClientRect();
        //         const x0 = scaleYear(d.year) + scaleSource(d.source),
        //             x1 = (pBCR.x > x0)
        //                 ? pBCR.x - svgBCR.left + fontSize
        //                 : pBCR.x + pBCR.width - svgBCR.left,
        //             y0 = scaleKTNE(d[scenario]) + svgH / 2 + fontSize,
        //             y1 = pBCR.y - svgBCR.y,
        //             curveY = curveYStart + fontSize * 0.15 * (8 - i);
        //             // linesOnWay = lines.nodes().filter(e => (e.getBBox().x > x0 && e.getBBox().x < x1)
        //             //                                     || (e.getBBox().x < x0 && e.getBBox().x > x1)),
        //             // curveY = scaleKTNE(d3.max(linesOnWay, e => e.__data__[scenario])) + svgH / 2 + fontSize*0.375 + fontSize * 0.2 * (8 - i);
        //
        //         return `M${x0} ${y0}
        //                 L${x0} ${curveY}
        //                 L${x1} ${curveY}
        //                 L${x1} ${y1}`;
        //     });
        //
        const updClip = function () {
            areas.transition()
                .duration(1000)
                .attr('d', d => area([d.values[0]].concat(d.values)));
        };

        // // clippath checker
        // const areas = svg.selectAll('path.clip_gen')
        //     .data(nested)
        //     .enter()
        //     .append('path')
        //     .attr('d', d => area([d.values[0]].concat(d.values)).concat([d.values[d.values.length - 1]]))
        //     .style('fill', '#000')
        //     .style('fill-opacity', 0.5);
        
        $('#general .switch_scenario').click(function (e) {
            const $t = $(this);
            if ($t.hasClass('active')) { return; }
            $('#general, #general #x_helper').toggleClass('dark');
            $('main').toggleClass('dark');
            $('#general .switch_scenario').removeClass('active');
            $t.addClass('active');
            scenario = $.trim($t.text());
            updClip();
            
        });

        const scroller = scrollama();
        scroller.setup({
            step: '#general figure',
            container: '#general',
            graphic: '#general svg',
            offset: 0.8,
        })
            .onContainerExit(function () {
                if ($('main').hasClass('dark')) {
                    $('#general').toggleClass('dark');
                    $('main').toggleClass('dark');
                    $('#general .switch_scenario').removeClass('active');
                    const $t = $('#general .switch_scenario').first()
                    $t.addClass('active');
                    scenario = $.trim($t.text());
                    updClip();
                }
            });
    });

// Promise.all([
//     d3.csv('data/eresources_wide.csv', numericalize),
// ])
//     .then(function ([data]) {
//         const nested = d3.nest()
//             .key(d => d.scenario)
//             .entries(data)
//             .reduce((res, d) => {
//                 res[d.key] = d.values;
//                 return res;
//             }, {});;
//
//         const maxKTNE = {
//                 'Революційний': 105000, //46899
//                 'Базовий': 170000, //90027
//             },
//
//             svgW = $('#general2 figure').width(),
//             svgH = $('#general2 figure').height(),
//             svgM = {
//                 top: fontSize,
//                 right: svgW*0.15,
//                 bottom: fontSize * 3,
//                 left: svgW * 0.15,
//             };
//
//         let scenario = 'Революційний';
//
//         const svg = d3.select('#general2 figure svg')
//             .attr('width', svgW)
//             .attr('height', svgH);
//
//         const scaleYear = d3.scaleLinear()
//             .domain([2015, 2050])
//             .range([svgM.left, svgW - svgM.right]);
//
//         const scaleKTNE = d3.scaleLinear()
//             .domain([0.0, maxKTNE[scenario]])
//             .range([svgH - svgM.top, svgM.bottom]);
//
//         const stack = d3.stack()
//             .keys(['Вугілля', 'Газ', 'Ресурс для АЕС', 'Нафта', 'Біопаливо та відходи', 'Гідро', 'Вітер', 'Сонце',]);
//
//         const area = d3.area()
//             .x(d => scaleYear(d.data.year))
//             .y0(d => scaleKTNE(d[0]))
//             .y1(d => scaleKTNE(d[1]))
//             .curve(d3.curveCatmullRom);
//         //
//         // const line = d3.line()
//         //     .x(d => scaleYear(d.values[0].year))
//         //     .y(d => scaleKTNE(d.values[0][scenario]))
//         //     .curve(d3.curveCatmullRom);
//
//         // const area = d3.area()
//         //     .x(d => scaleYear(d.values[0].year))
//         //     .y0(scaleKTNE(0))
//         //     .y1(d => scaleKTNE(d.values[0][scenario]))
//         //     .curve(d3.curveCatmullRom);
//
//         const xAxis = d3.axisBottom(scaleYear)
//             .ticks(8)
//             .tickFormat(d => d.toString());
//
//         const yAxis = d3.axisRight(scaleKTNE)
//             .ticks(10)
//             .tickFormat(d => nform(d));
//
//         const gXAxis = svg.append('g')
//             .attr('id', 'x_ax_gen')
//             .call(xAxis)
//             .attr('transform', `translate(0 ${scaleKTNE(0)})`);
//
//         gXAxis.selectAll('.tick line')
//             .attr('y1', -1 * (svgH - svgM.top - svgM.bottom))
//             .attr('y2', 0)
//             .attr('stroke', chroma(cols.black).alpha(0.4))
//             .attr('stroke-dasharray', '2 2');
//
//         const gYAxis = svg.append('g')
//             .attr('id', 'y_ax_gen')
//             .call(yAxis)
//             .attr('transform', `translate(${scaleYear.range()[1]} 0)`);
//
//         const scaleColor = d3.scaleOrdinal()
//             .domain(['Вугілля', 'Газ', 'Ресурс для АЕС', 'Нафта', 'Біопаливо та відходи', 'Гідро', 'Вітер', 'Сонце', 'Всього', 'Імпорт',])
//             .range(['#CE73E9','#B766CF','#ff554e','#9654A9','#3BDF14','#3EEC15','#34C512','#2A9F0E', '#686868', '#909192', ]);
//
//         // const lines = svg.selectAll('path.line_gen')
//         //     .data(nested)
//         //     .enter()
//         //     .append('path')
//         //     .attr('data-source', d => d.key)
//         //     .classed('line_gen', true)
//         //     .classed('nosource', d => ['Всього', 'Імпорт'].indexOf(d.key) !== -1)
//         //     .attr('d', d => line(d.values))
//         //     .style('stroke', d => scaleColor(d.key));
//
//         const areas = svg.selectAll('path.area_gen1')
//             .data(stack(nested[scenario]))
//             .enter()
//             .append('path')
//             .classed('area_stack', true)
//             .attr('data-source', d => d.key)
//             .attr('d', area)
//             .style('fill', d => scaleColor(d.key))
//             .style('stroke', d => scaleColor(d.key));
//     });
//
//
//
$(document).ready(function () {
    window.addEventListener('scroll', function () {
        tippy.hideAllPoppers();
    });
});