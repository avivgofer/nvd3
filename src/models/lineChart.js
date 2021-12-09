nv.models.lineChart = function () {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var lines = nv.models.line()
        , lines2 = nv.models.line()
        , hasLine2 = false
        , xAxis = nv.models.axis()
        , yAxis = nv.models.axis()
        , legend = nv.models.legend()
        , interactiveLayer = nv.interactiveGuideline()
        , tooltip = nv.models.tooltip()
        , brush = d3.svg.brush()
        ;

    var margin = {top: 30, right: 20, bottom: 50, left: 60}
        , color = nv.utils.defaultColor()
        , width = null
        , height = null
        , showLegend = true
        , showChecks = false
        , showXAxis = true
        , showYAxis = true
        , rightAlignYAxis = false
        , useInteractiveGuideline = false
        , x
        , y
        , focusEnable = false
        , negateTrend = false
        , brushExtent = null
        , state = nv.utils.state()
        , defaultState = null
        , noData = null
        , dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'brush', 'stateChange', 'changeState', 'renderEnd', 'selectChange')
        , transitionDuration = 250
        , headerFormat = function(d){ return d3.time.format('%b %d %H:%M')(new Date(lines.x(d))); }
        ;

    // set options on sub-objects for this chart
    xAxis.orient('bottom')/*.tickValues()*/;
    yAxis.orient(rightAlignYAxis ? 'right' : 'left');

    lines.clipEdge(true).duration(0);
    lines2.isArea(true);
    // We don't want any points emitted for the focus chart's scatter graph.


    tooltip.valueFormatter(function (d, i) {
        return yAxis.tickFormat()(d, i);
    }).headerFormatter(function (d, i) {
        return headerFormat/* xAxis.tickFormat()*/(d, i);
    });

    interactiveLayer.tooltip.valueFormatter(function (d, i) {
        return yAxis.tickFormat()(d, i);
    }).headerFormatter(function (d, i) {
        return headerFormat/* xAxis.tickFormat()*/(d, i);
    });


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, transitionDuration);

    var stateGetter = function (data) {
        return function () {
            return {
                active: data.map(function (d) {
                    return !d.disabled;
                })
            };
        };
    };

    var stateSetter = function (data) {
        return function (state) {
            if (state.active !== undefined)
                data.forEach(function (series, i) {
                    series.disabled = !state.active[i];
                });
        };
    };

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(lines);
        renderWatch.models(lines2);

        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);

        selection.each(function (data) {
            var container = d3.select(this);
            nv.utils.initSVG(container);
            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            chart.update = function () {
                if (transitionDuration === 0) {
                    container.call(chart);
                } else {
                    container.transition().duration(transitionDuration).call(chart);
                }
            };
            chart.container = this;

            state
                .setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            // DEPRECATED set state.disabled
            state.disabled = data.map(function (d) {
                return !!d.disabled;
            });

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
            if (!data || !data.length || !data.filter(function (d) {
                    return d.values && d.values.length;
                }).length) {
                nv.utils.noData(chart, container);
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();

                if ( hasLine2) {
                    var forceY = d3.extent(
                        d3.merge(
                            [ data[0].values.map(lines.y()), data[0].values.map(lines2.y())])
                    );

                    lines.forceY(forceY);
                    lines2.forceY(forceY);
                }
            }


            // Setup Scales
            x = lines.xScale();
            y = lines.yScale();


            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-lineChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-lineChart').append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-legendWrap');

            var focusEnter = gEnter.append('g').attr('class', 'nv-focus');
            focusEnter.append('g').attr('class', 'nv-background').append('rect');
            focusEnter.append('g').attr('class', 'nv-x nv-axis');
            focusEnter.append('g').attr('class', 'nv-y nv-axis');
            focusEnter.append('g').attr('class', 'nv-lines2Wrap');
            focusEnter.append('g').attr('class', 'nv-linesWrap');
            focusEnter.append('g').attr('class', 'nv-interactive');

            var contextEnter = gEnter.append('g').attr('class', 'nv-context');

            // Legend
            if (showLegend) {
                legend
                    .width(availableWidth)
                    .updateState(!showChecks);

                g.select('.nv-legendWrap')
                    .datum(data)
                    .call(legend);

                if (margin.top != legend.height()) {
                    margin.top = legend.height();
                    availableHeight = nv.utils.availableHeight(height, container, margin);
                }

                wrap.select('.nv-legendWrap')
                    .attr('transform', 'translate(0,' + (-margin.top) + ')');
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
                    .margin({left: margin.left, top: margin.top})
                    .svgContainer(container)
                    .xScale(x);
                wrap.select(".nv-interactive").call(interactiveLayer);
            }

            g.select('.nv-focus .nv-background rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            lines
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function (d, i) {
                    return d.color || color(d, i);

                }).filter(function (d, i) {
                    return !data[i].disabled;
                }));

            if ( hasLine2 ) {
                lines2
                    .interpolate('cardinal')
                    .clipEdge(true)
                    .width(availableWidth)
                    .height(availableHeight)
                    .color(data.map(function (d, i) {
                        return d.color || color(d, i);

                    }).filter(function (d, i) {
                        return !data[i].disabled;
                    }));
            }

            var linesWrap = g.select('.nv-linesWrap')
                .datum(data.filter(function (d) {
                    return !d.disabled;
                }));

            var lines2Wrap;

            if ( hasLine2 ) {
                lines2Wrap = g.select('.nv-lines2Wrap')
                    .datum(data.filter(function (d) {
                        return !d.disabled;
                    }));
            }

            // Setup Main (Focus) Axes
            if (showXAxis) {

                xAxis
                    .scale(x)
                    ._ticks(nv.utils.calcTicksX(availableWidth / 100, data))
                    .tickSize(-availableHeight, 0);

            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    ._ticks(nv.utils.calcTicksY(availableHeight / 36, data))
                    .tickSize(-availableWidth, 0);
            }

            //============================================================
            // Update Axes
            //============================================================
            function updateXAxis() {
                if (showXAxis) {
                    g.select('.nv-focus .nv-x.nv-axis')
                        .transition()
                        .duration(transitionDuration)
                        .call(xAxis)
                    ;
                }
            }

            function updateYAxis() {
                if (showYAxis) {
                    g.select('.nv-focus .nv-y.nv-axis')
                        .transition()
                        .duration(transitionDuration)
                        .call(yAxis)
                    ;
                }
            }

            g.select('.nv-focus .nv-x.nv-axis')
                .attr('transform', 'translate(0,' + availableHeight + ')');

            if ( hasLine2 ) {
                lines2Wrap.call(lines2);
            }
            linesWrap.call(lines);
            updateXAxis();
            updateYAxis();

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

            interactiveLayer.dispatch.on('elementMousemove', function (e) {
                lines.clearHighlights();
                var singlePoint, pointIndex, pointXLocation, allData = [];
                data
                    .filter(function (series, i) {
                        series.seriesIndex = i;
                        return !series.disabled && !series.disableTooltip;
                    })
                    .forEach(function (series, i) {
                        var extent = x.domain();
                        var currentValues = series.values.filter(function (d, i) {
                            return lines.x()(d, i) >= extent[0] && lines.x()(d, i) <= extent[1];
                        });

                        pointIndex = nv.interactiveBisect(currentValues, e.pointXValue, lines.x());
                        var point = currentValues[pointIndex];
                        var pointYValue = chart.y()(point, pointIndex);
                        var pointYRefValue = chart.y2()(point, pointIndex);
                        if (pointYValue !== null) {
                            lines.highlightPoint(series.seriesIndex, pointIndex, true);
                        }
                        if (point === undefined) return;
                        if (singlePoint === undefined) singlePoint = point;
                        if (pointXLocation === undefined) pointXLocation = chart.xScale()(chart.x()(point, pointIndex));
                        allData.push({
                            key: series.key,
                            value: pointYValue,
                            refValue: pointYRefValue,
                            pointAlert: chart.pointAlert && chart.pointAlert(),
                            color: (function (d, i) {
                                return d.color || color(d, i);
                            })(series, series.seriesIndex),
                            data: point
                        });
                    });
                //Highlight the tooltip entry based on which point the mouse is closest to.
                if (allData.length > 2) {
                    var yValue = chart.yScale().invert(e.mouseY);
                    var domainExtent = Math.abs(chart.yScale().domain()[0] - chart.yScale().domain()[1]);
                    var threshold = 0.03 * domainExtent;
                    var indexToHighlight = nv.nearestValueIndex(allData.map(function (d) {
                        return d.value;
                    }), yValue, threshold);
                    if (indexToHighlight !== null)
                        allData[indexToHighlight].highlight = true;
                }

                interactiveLayer.tooltip
                    .chartContainer(chart.container.parentNode)
                    .data({
                        negateTrend: chart.negateTrend(),
                        value: chart.x()(singlePoint, pointIndex),
                        index: pointIndex,
                        series: allData
                    })();

                interactiveLayer.renderGuideLine(pointXLocation);

            });

            interactiveLayer.dispatch.on('elementClick', function (e) {
                var pointXLocation, allData = [];

                data.filter(function (series, i) {
                    series.seriesIndex = i;
                    return !series.disabled;
                }).forEach(function (series) {
                    var pointIndex = nv.interactiveBisect(series.values, e.pointXValue, chart.x());
                    var point = series.values[pointIndex];
                    if (typeof point === 'undefined') return;
                    if (typeof pointXLocation === 'undefined') pointXLocation = chart.xScale()(chart.x()(point, pointIndex));
                    var yPos = chart.yScale()(chart.y()(point, pointIndex));
                    allData.push({
                        point: point,
                        pointIndex: pointIndex,
                        pos: [pointXLocation, yPos],
                        seriesIndex: series.seriesIndex,
                        series: series
                    });
                });

                lines.dispatch.elementClick(allData);
            });

            interactiveLayer.dispatch.on("elementMouseout", function (e) {
                lines.clearHighlights();
            });

            dispatch.on('changeState', function (e) {
                if (typeof e.disabled !== 'undefined' && data.length === e.disabled.length) {
                    data.forEach(function (series, i) {
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

        renderWatch.renderEnd('lineChart immediate');
        return chart;
    }


    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines.dispatch.on('elementMouseover.tooltip', function (evt) {
        if (!evt.series.disableTooltip) {
            tooltip.data(evt).hidden(false);
        }
    });

    lines.dispatch.on('elementMouseout.tooltip', function (evt) {
        tooltip.hidden(true);
    });

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.lines = lines;
    chart.lines2 = lines2;
    chart.legend = legend;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.interactiveLayer = interactiveLayer;
    chart.tooltip = tooltip;
    chart.state = state;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width: {
            get: function () {
                return width;
            }, set: function (_) {
                width = _;
            }
        },
        height: {
            get: function () {
                return height;
            }, set: function (_) {
                height = _;
            }
        },
        showChecks: {
            get: function () {
                return showChecks;
            }, set: function (_) {
                showChecks = _;
            }
        },
        showLegend: {
            get: function () {
                return showLegend;
            }, set: function (_) {
                showLegend = _;
            }
        },
        showXAxis: {
            get: function () {
                return showXAxis;
            }, set: function (_) {
                showXAxis = _;
            }
        },
        showYAxis: {
            get: function () {
                return showYAxis;
            }, set: function (_) {
                showYAxis = _;
            }
        },
        focusEnable: {
            get: function () {
                return focusEnable;
            }, set: function (_) {
                focusEnable = _;
            }
        },
        brushExtent: {
            get: function () {
                return brushExtent;
            }, set: function (_) {
                brushExtent = _;
            }
        },
        defaultState: {
            get: function () {
                return defaultState;
            }, set: function (_) {
                defaultState = _;
            }
        },
        noData: {
            get: function () {
                return noData;
            }, set: function (_) {
                noData = _;
            }
        },

        // options that require extra logic in the setter
        margin: {
            get: function () {
                return margin;
            }, set: function (_) {
                margin.top = _.top !== undefined ? _.top : margin.top;
                margin.right = _.right !== undefined ? _.right : margin.right;
                margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
                margin.left = _.left !== undefined ? _.left : margin.left;
            }
        },
        duration: {
            get: function () {
                return transitionDuration;
            }, set: function (_) {
                transitionDuration = _;
                renderWatch.reset(transitionDuration);
                lines.duration(transitionDuration);
                xAxis.duration(transitionDuration);
                yAxis.duration(transitionDuration);
            }
        },
        color: {
            get: function () {
                return color;
            }, set: function (_) {
                color = nv.utils.getColor(_);
                legend.color(color);
                lines.color(color);
                lines2.color(color);
            }
        },
        interpolate: {
            get: function () {
                return lines.interpolate();
            }, set: function (_) {
                lines.interpolate(_);
            }
        },
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
        valueFormat: {
            get: function () {
                return interactiveLayer.tooltip.valueFormatter();
            }, set: function (_) {
                interactiveLayer.tooltip.valueFormatter(_);
            }
        },
        keyFormat: {
            get: function () {
                return legend.keyFormat();
            }, set: function (_) {
                legend.keyFormat(_);
            }
        },
        x: {
            get: function () {
                return lines.x();
            }, set: function (_) {
                lines.x(_);
                lines2.x(_);
            }
        },
        y: {
            get: function () {
                return lines.y();
            }, set: function (_) {
                lines.y(_);
            }
        },
        y2: {
            get: function () {
                return lines2.y();
            }, set: function (_) {
                hasLine2 = !!_;
                lines2.y(_);
            }
        },
        threshold: {
            get: function () {
                return lines.threshold();
            }, set: function (_) {
                lines.threshold(_);
            }
        },
        pointAlert: {
            get: function () {
                return lines.scatter.pointAlert();
            }, set: function (_) {
                lines.scatter.pointAlert(_);
            }
        },
        activeSince: {
            get: function () {
                return lines.activeSince();
            }, set: function (_) {
                lines.activeSince(_);
            }
        },
        rightAlignYAxis: {
            get: function () {
                return rightAlignYAxis;
            }, set: function (_) {
                rightAlignYAxis = _;
                yAxis.orient(rightAlignYAxis ? 'right' : 'left');
            }
        },
        useInteractiveGuideline: {
            get: function () {
                return useInteractiveGuideline;
            }, set: function (_) {
                useInteractiveGuideline = _;
                if (useInteractiveGuideline) {
                    lines.interactive(false);
                    lines.useVoronoi(false);
                }
            }
        }
    });

    nv.utils.inheritOptions(chart, lines);
    nv.utils.initOptions(chart);

    return chart;
};
