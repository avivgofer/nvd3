
nv.models.historicalBarChart = function(bar_model, bar2_model) {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var bars = bar_model || nv.models.historicalBar()
        , bars2 = bar2_model || nv.models.historicalBar()
        , xAxis = nv.models.axis()
        , yAxis = nv.models.axis()
        , legend = nv.models.legend()
        , interactiveLayer = nv.interactiveGuideline()
        , tooltip = nv.models.tooltip()
        , brush = d3.svg.brush()
        , hasBar2 = false
        ;


    var margin = {top: 30, right: 90, bottom: 50, left: 90}
        , color = nv.utils.defaultColor()
        , width = null
        , height = null
        , showLegend = false
        , showChecks = true
        , showXAxis = true
        , showYAxis = true
        , rightAlignYAxis = false
        , useInteractiveGuideline = false
        , x
        , y
        , focusEnable = false
        , negateTrend = false
        , brushExtent = null
        , state = {}
        , defaultState = null
        , noData = null
        , dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'brush', 'stateChange', 'changeState', 'renderEnd', 'selectChange', 'drill')
        , transitionDuration = 0
        , headerFormat = function(d){ return d3.time.format('%b %d %H:%M')(new Date(d)); }
        , footerFormat = function(d){ }
        ;

    xAxis.orient('bottom').tickPadding(7);
    yAxis.orient( (rightAlignYAxis) ? 'right' : 'left');
    tooltip
        .duration(0)
        .headerEnabled(true)
        .valueFormatter(function(d, i) {
            return yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function(d, i) {
            return headerFormat(chart.x()(d.data), d, i);
        });


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, 0);

    function chart(selection) {
        selection.each(function(data) {
            renderWatch.reset();
            renderWatch.models(bars);
            renderWatch.models(bars2);

            if (showXAxis) renderWatch.models(xAxis);
            if (showYAxis) renderWatch.models(yAxis);

            var container = d3.select(this),
                that = this;
            nv.utils.initSVG(container);
            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            chart.update = function() {
                if (transitionDuration === 0) {
                    container.call(chart);
                } else {
                    container.transition().duration(transitionDuration).call(chart);
                }
            };
            chart.container = this;

            //set state.disabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            // Display noData message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container)
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Setup Scales
            x = bars.xScale();

            var xDomain = d3.extent(d3.merge(data.map(function(d, idx) {
                return d.values.map(function(d,i) {
                    return chart.x()(d,i);
                });
            })));

            var yDomain = d3.extent(d3.merge(data.map(function(d, idx) {
                return d.values.map(function(d,i) {
                    return Math.max(chart.y()(d,i) || 0, chart.y2()(d,i) || 0.0);
                }).concat(chart.forceY());
            })));

            bars.xDomain(xDomain).yDomain(yDomain);
            bars2.xDomain(xDomain).yDomain(yDomain);

            y = bars.yScale();

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-historicalBarChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-historicalBarChart').append('g');
            var g = wrap.select('g');

            var focusEnter = gEnter.append('g').attr('class', 'nv-focus');
            focusEnter.append('g').attr('class', 'nv-background').append('rect');
            focusEnter.append('g').attr('class', 'nv-x nv-axis');
            focusEnter.append('g').attr('class', 'nv-y nv-axis');
            focusEnter.append('g').attr('class', 'nv-bars2Wrap');
            focusEnter.append('g').attr('class', 'nv-barsWrap');
            focusEnter.append('g').attr('class', 'nv-legendWrap');
            focusEnter.append('g').attr('class', 'nv-interactive');

            var contextEnter = gEnter.append('g').attr('class', 'nv-context');

            // Legend
            if (showLegend) {
                legend.width(availableWidth)
                    .updateState(!showChecks);

                g.select('.nv-legendWrap')
                    .datum(data)
                    .call(legend);

                if ( margin.top != legend.height()) {
                    margin.top = legend.height();
                    availableHeight = nv.utils.availableHeight(height, container, margin);
                }

                wrap.select('.nv-legendWrap')
                    .attr('transform', 'translate(0,' + (-margin.top) +')')
            }
            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            if (rightAlignYAxis) {
                g.select(".nv-y.nv-axis")
                    .attr("transform", "translate(" + availableWidth + ",0)");
            }

            //Set up interactive layer
            if (useInteractiveGuideline) {
                interactiveLayer
                    .width(availableWidth)
                    .height(availableHeight)
                    .margin({left:margin.left, top:margin.top})
                    .svgContainer(container)
                    .xScale(x);
                wrap.select(".nv-interactive").call(interactiveLayer);
            }

            g.select('.nv-focus .nv-background rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            bars
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled }));

            var barsWrap = g.select('.nv-barsWrap')
                .datum(data.filter(function(d) { return !d.disabled }));
            barsWrap.transition().call(bars);

            if ( hasBar2 ) {
                bars2
                    .width(availableWidth)
                    .height(availableHeight)
                    .color(data.map(function(d,i) {
                        return d.color || color(d, i);
                    }).filter(function(d,i) { return !data[i].disabled }));

                var bars2Wrap = g.select('.nv-bars2Wrap')
                    .datum(data.filter(function (d) {
                        return !d.disabled
                    }));
                bars2Wrap.transition().call(bars2);
            }

            // Setup Axes
            if (showXAxis) {
                xAxis
                    .scale(x)
                    ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                    .tickSize(-availableHeight, 0);

                g.select('.nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + y.range()[0] + ')');
                g.select('.nv-x.nv-axis')
                    .transition()
                    .call(xAxis);
            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                    .tickSize( -availableWidth, 0);

                g.select('.nv-y.nv-axis')
                    .transition()
                    .call(yAxis);
            }

            if (focusEnable) {
                // Setup Brush
                brush
                    .x(x)
                    .clear()
                    .on('brushend', function () {
                        onBrushEnd();
                    });

                var gBrush = g.select('.nv-context')
                    .call(brush)
                    .selectAll('rect')
                    .attr('height', availableHeight);

                onBrush();
            }

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            interactiveLayer.dispatch.on('elementMousemove', function(e) {
                bars.clearHighlights();

                var singlePoint, pointIndex, pointXLocation, allData = [];
                data
                    .filter(function(series, i) {
                        series.seriesIndex = i;
                        return !series.disabled;
                    })
                    .forEach(function(series,i) {
                        pointIndex = nv.interactiveBisect(series.values, e.pointXValue, chart.x());
                        bars.highlightPoint(pointIndex,true);
                        var point = series.values[pointIndex];
                        if (point === undefined) return;
                        if (singlePoint === undefined) singlePoint = point;
                        if (pointXLocation === undefined) pointXLocation = chart.xScale()(chart.x()(point,pointIndex));
                        allData.push({
                            key: series.key,
                            value: chart.y()(point, pointIndex),
                            color: color(series,series.seriesIndex),
                            data: series.values[pointIndex]
                        });
                    });

                var xValue = xAxis.tickFormat()(chart.x()(singlePoint,pointIndex));
                interactiveLayer.tooltip
                    .chartContainer(that.parentNode)
                    .valueFormatter(function(d,i) {
                        return yAxis.tickFormat()(d);
                    })
                    .data({
                        negateTrend: chart.negateTrend(),
                        value: xValue,
                        index: pointIndex,
                        series: allData
                    })();

                interactiveLayer.renderGuideLine(pointXLocation);

            });

            interactiveLayer.dispatch.on("elementMouseout",function(e) {
                dispatch.tooltipHide();
                bars.clearHighlights();
            });

            legend.dispatch
                .on('stateChange', function (newState) {
                    for (var key in newState)
                        state[key] = newState[key];
                    dispatch.stateChange(state);
                    chart.update();
                })
                .on('legendClick', function (d, i) {
                    d.selected = !d.selected;
                    dispatch.selectChange(d);
                    // chart.update();
                });


            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });

                    state.disabled = e.disabled;
                }

                chart.update();
            });

            //============================================================
            // Functions
            //------------------------------------------------------------

            function onBrushEnd() {
                if (brush.empty()) {
                    dispatch.brush({extent: null, brush: brush});
                }
                else {
                    dispatch.brush({extent: brush.extent(), brush: brush});
                }
            }

            function onBrush() {

            }

        });

        renderWatch.renderEnd('historicalBarChart immediate');
        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    bars.dispatch.on('elementMouseover.tooltip', function(evt) {
        evt['series'] = {
            key: evt.data.key,
            value: chart.y()(evt.data),
            refValue: hasBar2 ? chart.y2()(evt.data) : null,
            color: evt.color
        };

        evt = {...evt, negateTrend: chart.negateTrend()};

        tooltip.data(evt)
            .footerFormatter(footerFormat)
            .chartContainer(chart.container.parentNode)
            .hidden(false);
    });

    bars.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true);
    });

    bars.dispatch.on('elementMousemove.tooltip', function(evt) {
        tooltip();
    });

    bars2.dispatch.on('elementMouseover.tooltip', function(evt) {
        evt['series'] = {
            y2: true,
            key: evt.data.key,
            value: chart.y2()(evt.data),
            color: evt.color
        };

        tooltip.data(evt)
            .footerFormatter(function () {})
            .chartContainer(chart.container.parentNode)
            .hidden(false);
    });

    bars2.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true);
    });

    bars2.dispatch.on('elementMousemove.tooltip', function(evt) {
        tooltip();
    });


    bars.dispatch.on('elementClick.drill', function(evt) {
        dispatch.drill({drill: [evt.data[0], evt.data[0] + evt.step], result: evt.series});
    });

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.bars = bars;
    chart.legend = legend;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.interactiveLayer = interactiveLayer;
    chart.tooltip = tooltip;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        negateTrend: {get: function(){return negateTrend;}, set: function(_){negateTrend=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        showChecks: {get: function(){return showChecks;}, set: function(_){showChecks=_;}},
        showXAxis: {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis: {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        focusEnable: { get: function () { return focusEnable; }, set: function (_) { focusEnable = _; }},
        brushExtent: { get: function () { return brushExtent; }, set: function (_) { brushExtent = _; }},

        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            legend.color(color);
            bars.color(color);
        }},
        duration:    {get: function(){return transitionDuration;}, set: function(_){
            transitionDuration=_;
            renderWatch.reset(transitionDuration);
            bars.duration(transitionDuration);
            yAxis.duration(transitionDuration);
            xAxis.duration(transitionDuration);
        }},
        xTickFormat: {
            get: function () {
                return xAxis.tickFormat();
            }, set: function (_) {
                xAxis.tickFormat(_);
                //x2Axis.tickFormat(_);
            }
        },
        yTickFormat: {
            get: function () {
                return yAxis.tickFormat();
            }, set: function (_) {
                yAxis.tickFormat(_);
                //y2Axis.tickFormat(_);
            }
        },
        headerFormat: {
            get: function () {
                return headerFormat;
            }, set: function (_) {
                headerFormat = d3.functor(_);
            }
        },
        footerFormat: {
            get: function () {
                return tooltip.footerFormatter();
            }, set: function (_) {
                footerFormat = d3.functor(_);
                tooltip.footerFormatter(_);
            }
        },
        valueFormat: {
            get: function () {
                return interactiveLayer.tooltip.valueFormatter();
            }, set: function (_) {
                interactiveLayer.tooltip.valueFormatter(_);
                tooltip.valueFormatter(_);
            }
        },
        keyFormat: {
            get: function () {
                return legend.keyFormat();
            }, set: function (_) {
                legend.keyFormat(_);
            }
        },

        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( (_) ? 'right' : 'left');
        }},
        useInteractiveGuideline: {get: function(){return useInteractiveGuideline;}, set: function(_){
            useInteractiveGuideline = _;
            bars.interactive(!useInteractiveGuideline);
            bars2.interactive(!useInteractiveGuideline);
        }},
        x: {
            get: function () {
                return bars.x();
            }, set: function (_) {
                bars.x(_);
                bars2.x(_);
            }
        },
        y: {
            get: function () {
                return bars.y();
            }, set: function (_) {
                bars.y(_);
            }
        },
        y2: {
            get: function () {
                return bars2.y();
            }, set: function (_) {
                hasBar2 = !!_;
                bars2.y(_);
            }
        }

    });

    nv.utils.inheritOptions(chart, bars);
    nv.utils.initOptions(chart);

    return chart;
};


// ohlcChart is just a historical chart with ohlc bars and some tweaks
nv.models.ohlcBarChart = function() {
    var chart = nv.models.historicalBarChart(nv.models.ohlcBar());

    // special default tooltip since we show multiple values per x
    chart.useInteractiveGuideline(true);
    chart.interactiveLayer.tooltip.contentGenerator(function(data) {
        // we assume only one series exists for this chart
        var d = data.series[0].data;
        // match line colors as defined in nv.d3.css
        var color = d.open < d.close ? "2ca02c" : "d62728";
        return '' +
            '<h3 style="color: #' + color + '">' + data.value + '</h3>' +
            '<table>' +
            '<tr><td>open:</td><td>' + chart.yAxis.tickFormat()(d.open) + '</td></tr>' +
            '<tr><td>close:</td><td>' + chart.yAxis.tickFormat()(d.close) + '</td></tr>' +
            '<tr><td>high</td><td>' + chart.yAxis.tickFormat()(d.high) + '</td></tr>' +
            '<tr><td>low:</td><td>' + chart.yAxis.tickFormat()(d.low) + '</td></tr>' +
            '</table>';
    });
    return chart;
};

// candlestickChart is just a historical chart with candlestick bars and some tweaks
nv.models.candlestickBarChart = function() {
    var chart = nv.models.historicalBarChart(nv.models.candlestickBar());

    // special default tooltip since we show multiple values per x
    chart.useInteractiveGuideline(true);
    chart.interactiveLayer.tooltip.contentGenerator(function(data) {
        // we assume only one series exists for this chart
        var d = data.series[0].data;
        // match line colors as defined in nv.d3.css
        var color = d.open < d.close ? "2ca02c" : "d62728";
        return '' +
            '<h3 style="color: #' + color + '">' + data.value + '</h3>' +
            '<table>' +
            '<tr><td>open:</td><td>' + chart.yAxis.tickFormat()(d.open) + '</td></tr>' +
            '<tr><td>close:</td><td>' + chart.yAxis.tickFormat()(d.close) + '</td></tr>' +
            '<tr><td>high</td><td>' + chart.yAxis.tickFormat()(d.high) + '</td></tr>' +
            '<tr><td>low:</td><td>' + chart.yAxis.tickFormat()(d.low) + '</td></tr>' +
            '</table>';
    });
    return chart;
};

nv.models.multiHistoricalBarChart = function () {
    var chart = nv.models.historicalBarChart(
        nv.models.multiBar().xScale(d3.scale.linear()).stacked(false),
        nv.models.multiBar().xScale(d3.scale.linear()).stacked(false).refBars(true).barColor(function(){ return '#c4ced4'})
    );

    // special default tooltip since we show multiple values per x
    chart.useInteractiveGuideline(false);

    return chart;
};
