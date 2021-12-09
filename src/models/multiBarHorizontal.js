
nv.models.multiBarHorizontal = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = 960
        , height = 500
        , rectWidthMin = 50
        , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
        , container = null
        , x = d3.scale.ordinal()
        , y = d3.scale.linear()
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y }
        , getYerr = function(d) { return d.yErr }
        , forceY = [0] // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
        , color = nv.utils.defaultColor()
        , href = null
        , barWidth = null
        , barColor = null // adding the ability to set the color for each rather than the whole group
        , disabled // used in conjunction with barColor to communicate from multiBarHorizontalChart what series are disabled
        , stacked = false
        , showValues = false
        , negateTrend = false
        , showBarLabels = true
        , showChecks = false
        , valuePadding = 60
        , groupSpacing = 0.1
        , valueFormat = d3.format(',.2f')
        , refFormat = function(v){ return v ? d3.format('.1f')(100.0 * v) + '%' : ''; }
        , keyFormat = function(d){ return d; }
        , delay = 1200
        , xDomain
        , yDomain
        , xRange
        , yRange
        , duration = 250
        , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove', 'renderEnd')
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var x0, y0; //used to store previous scales
    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {
            var availableWidth = width - margin.left - margin.right,
                availableHeight = height - margin.top - margin.bottom;

            container = d3.select(this);
            nv.utils.initSVG(container);

            if (stacked)
                data = d3.layout.stack()
                    .offset('zero')
                    .values(function(d){ return d.values })
                    .y(getY)
                (data);

            //add series index and key to each data point for reference
            data.forEach(function(series, i) {
                series.values.forEach(function(point) {
                    point.series = i;
                    point.key = series.key;
                });
            });

            // HACK for negative value stacking
            if (stacked)
                data[0].values.map(function(d,i) {
                    var posBase = 0, negBase = 0;
                    data.map(function(d) {
                        var f = d.values[i]
                        f.size = Math.abs(f.y);
                        if (f.y<0)  {
                            f.y1 = negBase - f.size;
                            negBase = negBase - f.size;
                        } else
                        {
                            f.y1 = posBase;
                            posBase = posBase + f.size;
                        }
                    });
                });

            // Setup Scales
            // remap and flatten the data for use in calculating the scales' domains
            var seriesData = (xDomain && yDomain) ? [] : // if we know xDomain and yDomain, no need to calculate
                data.map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d,i), y: Math.max(getY(d,i), d.previous ? getY(d.previous,i) : 0), y0: d.y0, y1: d.y1 }
                    })
                });

            x.domain(xDomain || d3.merge(seriesData).map(function(d) { return d.x }))
                .rangeBands(xRange || [0, availableHeight], groupSpacing, 0);

            y.domain(yDomain || d3.extent(d3.merge(seriesData).map(function(d) { return stacked ? (d.y > 0 ? d.y1 + d.y : d.y1 ) : d.y }).concat(forceY)))

            if (showValues && !stacked)
                y.range(yRange || [(y.domain()[0] < 0 ? valuePadding : 0), availableWidth - (y.domain()[1] > 0 ? valuePadding : 0) ]);
            else
                y.range(yRange || [0, availableWidth]);

            x0 = x0 || x;
            y0 = y0 || d3.scale.linear().domain(y.domain()).range([y(0),y(0)]);

            // Setup containers and skeleton of chart
            var wrap = d3.select(this).selectAll('g.nv-wrap.nv-multibarHorizontal').data([data]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multibarHorizontal');
            var defsEnter = wrapEnter.append('defs');
            var gEnter = wrapEnter.append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-groups');
            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var groups = wrap.select('.nv-groups').selectAll('.nv-group')
                .data(function(d) { return d }, function(d,i) { return i });
            groups.enter().append('g')
                .style('stroke-opacity', 1e-6)
                .style('fill-opacity', 1e-6);
            groups.exit().watchTransition(renderWatch, 'multibarhorizontal: exit groups')
                .style('stroke-opacity', 1e-6)
                .style('fill-opacity', 1e-6)
                .remove();
            groups
                .attr('class', function(d,i) { return 'nv-group nv-series-' + i })
                .classed('hover', function(d) { return d.hover })
                .style('fill', function(d,i){ return color(d, i) })
                .style('stroke', function(d,i){ return color(d, i) });
            groups.watchTransition(renderWatch, 'multibarhorizontal: groups')
                .style('stroke-opacity', 1)
                .style('fill-opacity', .75);

            var barRefs = groups.selectAll('g.nv-bar-ref')
                .data(function(d) { return d.values });
            barRefs.exit().remove();

            var barRefsEnter = barRefs.enter()
                .append('g')
                .classed('nv-bar-ref', true)
                .attr('transform', function(d,i,j) {
                    return 'translate(' + y0(stacked ? d.y0 : 0) + ',' + (stacked ? 0 : ((j) * barWidth )/* + x(getX(d,i))*/) + ')'
                });

            barRefsEnter
                .filter(function(d){ return d.previous; })
                .append('rect')
                .attr('width', 0)
                .attr('y', barWidth - 6 )
                .attr('height', 6 );

            barRefsEnter
                .filter(function(d){ return d.previous; })
                .append('svg:title')
                .text(function(d,i) { return getY(d.previous,i); });

            if (barColor) {
                if (!disabled) disabled = data.map(function() { return true });
                barRefs
                    .style('fill', function(d,i,j) {
                        // return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString();
                        return '#c4ced4';
                    })
                    .style('stroke', function(d,i,j) {
                        // return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString();
                        return '#c4ced4';
                    });
            }

            if (showValues) {
                barRefsEnter.filter(function (d) { return d.previous; })
                    .append('text').classed('nv-bar-ref-value', true);

                barRefs.select('text.nv-bar-ref-value')
                    .attr('text-anchor', function (d, i) {
                        return getY(d, i) < 0 ? 'end' : 'start'
                    })
                    .attr('y', barWidth && barWidth/2 || 15)
                    .attr('dy', '0.32em')
                    .classed('positive', function (d, i) {
                        var v = getY(d, i),
                            b = getY(d.previous, i);

                        return negateTrend ? v < b : v > b;
                    })
                    .classed('negative', function (d, i) {
                        var v = getY(d, i),
                            b = getY(d.previous, i);

                        return negateTrend ? v > b : v < b;
                    })
                    .text(function (d, i) {
                        var v = getY(d, i),
                            b = getY(d.previous, i);

                        var t = refFormat(b > 0 ? (v - b) / b : null)
                            , yerr = getYerr(d, i);
                        if (yerr === undefined)
                            return t;
                        if (!yerr.length)
                            return t + '±' + valueFormat(Math.abs(yerr));
                        return t + '+' + valueFormat(Math.abs(yerr[1])) + '-' + valueFormat(Math.abs(yerr[0]));
                    });

                barRefs.watchTransition(renderWatch, 'multibarhorizontal: bars')
                    .select('text.nv-bar-ref-value')
                    .attr('x', function (d, i) {
                        return Math.max(50, y(getY(d, i))) + 4
                    });

            }


            var watch2 = barRefs.watchTransition(renderWatch, 'multibarhorizontal: bars')
                .filter(function(d){ return d.previous; })
                .attr('transform', function (d, i) {
                    //TODO: stacked must be all positive or all negative, not both?
                    return 'translate(' +
                        (getY(d.previous, i) < 0 ? y(getY(d.previous, i)) : y(0))
                        + ',' +
                        ((d.series) * barWidth + x(getX(d, i)) )
                        + ')'
                });

            watch2
                .select('rect')
                /*.attr('height', barWidth /!*|| x.rangeBand() / data.length*!/)*/
                .attr('width', function (d, i) {
                    return Math.max(Math.abs(y(getY(d.previous, i)) - y(0)), 1) || 0
                });


            var bars = groups.selectAll('g.nv-bar')
                .data(function(d) { return d.values });
            bars.exit().remove();

            var barsEnter = bars.enter().append('g')
                .attr('transform', function(d,i,j) {
                    return 'translate(' + y0(stacked ? d.y0 : 0) + ',' + (stacked ? 0 : (j * 3.33 * barWidth )/* + x(getX(d,i))*/) + ')'
                });

            barsEnter.append('rect')
                .attr('width', 0)
                .attr('height', barWidth || x.rangeBand() / (stacked ? 1 : data.length) );

            barsEnter.append('svg:title')
                .text(function(d,i) { return getX(d,i); });

            if ( showChecks ) {
                barsEnter.filter(function(d,i,j){
                    return j === 0;
                }).append('path')
                    .attr('class', 'nv-check')
                    .attr('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z');
            }

            bars
                .on('mouseover', function(d,i) { //TODO: figure out why j works above, but not here
                    d3.select(this).classed('hover', true);
                    dispatch.elementMouseover({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mouseout', function(d,i) {
                    d3.select(this).classed('hover', false);
                    dispatch.elementMouseout({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mouseout', function(d,i) {
                    dispatch.elementMouseout({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mousemove', function(d,i) {
                    dispatch.elementMousemove({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('click', function(d,i) {
                    d.selected = !d.selected;
                    d3.select(this).classed('selected', d.selected);
                    dispatch.elementClick({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                    d3.event.stopPropagation();
                })
                .on('dblclick', function(d,i) {
                    dispatch.elementDblClick({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                    d3.event.stopPropagation();
                });

            if (getYerr(data[0],0)) {
                barsEnter.append('polyline');

                bars.select('polyline')
                    .attr('fill', 'none')
                    .attr('points', function(d,i) {
                        var xerr = getYerr(d,i)
                            , mid = 0.8 * x.rangeBand() / ((stacked ? 1 : data.length) * 2);
                        xerr = xerr.length ? xerr : [-Math.abs(xerr), Math.abs(xerr)];
                        xerr = xerr.map(function(e) { return y(e) - y(0); });
                        var a = [[xerr[0],-mid], [xerr[0],mid], [xerr[0],0], [xerr[1],0], [xerr[1],-mid], [xerr[1],mid]];
                        return a.map(function (path) { return path.join(',') }).join(' ');
                    })
                    .attr('transform', function(d,i) {
                        var mid = x.rangeBand() / ((stacked ? 1 : data.length) * 2);
                        return 'translate(' + (getY(d,i) < 0 ? 0 : y(getY(d,i)) - y(0)) + ', ' + mid + ')'
                    });
            }



            if (showValues /*&& !stacked*/) {
                barsEnter.append('text').classed('nv-bar-value', true);
                bars.select('text.nv-bar-value')
                    .attr('text-anchor', function(d,i) { return getY(d,i) < 0 ? 'end' : 'start' })
                    .attr('y', barWidth && barWidth/2 || x.rangeBand() / (data.length * 2))
                    .attr('dy', '.32em')
                    .text(function(d,i) {
                        var t = valueFormat(getY(d,i))
                            , yerr = getYerr(d,i);
                        if (yerr === undefined)
                            return t;
                        if (!yerr.length)
                            return t + '±' + valueFormat(Math.abs(yerr));
                        return t + '+' + valueFormat(Math.abs(yerr[1])) + '-' + valueFormat(Math.abs(yerr[0]));
                    });
                bars.watchTransition(renderWatch, 'multibarhorizontal: bars')
                    .select('text.nv-bar-value')
                    .attr('x', function(d,i) { return getY(d,i) < 0 ? y(0) -y(getY(d,i)) - 4 : + 4 });



            } else {
                bars.selectAll('text.nv-bar-value').remove();
                bars.selectAll('text.nv-bar-ref-value').remove();
            }

            if (showBarLabels /*&& !stacked*/) {

                if (href && typeof href === 'function') {
                    var a = barsEnter.filter(function(d,i,j){
                        return j === 0;
                    }).append('a').attr('class', 'nv-href').attr('xlink:href', function (d) {
                            return href(d);
                        });

                    a.append('text').classed('nv-bar-label', true);

                    a.on('mouseover', function (d, i) {
                        d3.event.stopPropagation();
                        d3.event.preventDefault();

                        //d3.select(this).classed('hover', true).style('opacity', 0.8);
                        dispatch.elementMouseout({
                            data: d
                        });

                    });

                    /*a.append('path').attr('d', 'M 10 6 L 8.59 7.41 L 13.17 12 l -4.58 4.59 L 10 18 l 6 -6 Z');*/
                }
                else {
                    barsEnter.filter(function(d,i,j){
                        return j === 0;
                    }).append('text').classed('nv-bar-label', true);
                }

                bars.select('text.nv-bar-label')
                    .attr('text-anchor', function(d,i) { return (getY(d,i) > 0) ? 'start' : 'end' })
                    .attr('y', /*(stacked? 1.33 : 0.5)*/ (data.length + 0.33) * barWidth /*|| x.rangeBand() / (data.length * 2)*/)
                    .attr('dy', '.32em')
                    .text(function(d,i) { return keyFormat(getX(d,i)) });

                {
                    bars
                        .watchTransition(renderWatch, 'multibarhorizontal: bars')
                        .select('text.nv-bar-label')
                        .attr('x', function (d, i) {
                            if ( stacked ) {
                                return getY(d, i) < 0 ? Math.abs(y(getY(d,i) + d.y0) - y(d.y0)) || 0 : 0;
                            }

                            return 0; // getY(d, i) < 0 ? y(0) - y(getY(d, i)) + 4 : -4;
                        });
                }


                if ( stacked ) {
                    bars.filter(function (d) {
                        return d.series > 0;
                    }).select('text.nv-bar-label').remove();
                }
            }
            else {
                bars.selectAll('text.nv-bar-label').remove();
            }

            bars
                .attr('class', function(d,i) { return (negateTrend ? getY(d,i) > 0 : getY(d,i) < 0)  ? 'nv-bar negative' : 'nv-bar positive'});

            bars.classed('selected', function(d,i){ return d.selected; });

            if (barColor) {
                if (!disabled) disabled = data.map(function() { return true });
                bars
                    .style('fill', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString(); })
                    .style('stroke', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString(); });
            }

            if (stacked) {
                var watch = bars.watchTransition(renderWatch, 'multibarhorizontal: bars')
                    .attr('transform', function (d, i) {
                        return 'translate(' + y(d.y1) + ',' + x(getX(d, i)) + ')'
                    });

                watch.select('rect')
                    .attr('width', _rectWidthStacked)
                    .attr('height', barWidth || x.rangeBand());

                watch.select('rect.nv-ref')
                    .attr('width', _rectWidthStacked)
                    .attr('height', barWidth || x.rangeBand());

                if ( showChecks ) {
                    watch.select('path.nv-check')
                        .attr('transform', function (d, i) {
                            var width = Math.abs(y(getY(d, i) + d.y0) - y(d.y0)),
                                height = barWidth || x.rangeBand();
                            return 'translate(' + (width - 27) + ',' + (height - 24) / 2 + ' )';
                        });
                }
            }
            else {

                var watch = bars.watchTransition(renderWatch, 'multibarhorizontal: bars')
                    .attr('transform', function (d, i) {
                        //TODO: stacked must be all positive or all negative, not both?
                        return 'translate(' +
                            (getY(d, i) < 0 ? y(getY(d, i)) : y(0))
                            + ',' +
                            (d.series * barWidth + x(getX(d, i)) )
                            + ')'
                    });

                watch
                    .select('rect')
                    .attr('height', barWidth /*|| x.rangeBand() / data.length*/)
                    .attr('width', _rectWidth);

                if ( showChecks ) {
                    watch.select('path.nv-check')
                        .attr('transform', function (d, i) {
                            var width = _rectWidth(d,i),
                                height = barWidth || x.rangeBand() / data.length;
                            return 'translate(' + (width - 20) + ',' + (height - 20) / 2 + ' )';
                        });
                }

            }

            //store old scales for use in transitions on update
            x0 = x.copy();
            y0 = y.copy();

        });

        renderWatch.renderEnd('multibarHorizontal immediate');
        return chart;
    }

    function _rectWidth(d, i) {
        return Math.max(Math.abs(y(getY(d, i)) - y(0)), rectWidthMin) || 0;
    }

    function _rectWidthStacked(d, i) {
        return Math.max(Math.abs(y(getY(d, i) + d.y0) - y(d.y0)), rectWidthMin) || 0;
    }


    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:   {get: function(){return width;}, set: function(_){width=_;}},
        height:  {get: function(){return height;}, set: function(_){height=_;}},
        x:       {get: function(){return getX;}, set: function(_){getX=_;}},
        y:       {get: function(){return getY;}, set: function(_){getY=_;}},
        yErr:       {get: function(){return getYerr;}, set: function(_){getYerr=_;}},
        xScale:  {get: function(){return x;}, set: function(_){x=_;}},
        yScale:  {get: function(){return y;}, set: function(_){y=_;}},
        xDomain: {get: function(){return xDomain;}, set: function(_){xDomain=_;}},
        yDomain: {get: function(){return yDomain;}, set: function(_){yDomain=_;}},
        xRange:  {get: function(){return xRange;}, set: function(_){xRange=_;}},
        yRange:  {get: function(){return yRange;}, set: function(_){yRange=_;}},
        forceY:  {get: function(){return forceY;}, set: function(_){forceY=_;}},
        stacked: {get: function(){return stacked;}, set: function(_){stacked=_;}},
        showValues: {get: function(){return showValues;}, set: function(_){showValues=_;}},
        negateTrend: {get: function(){return negateTrend;}, set: function(_){negateTrend=_;}},
        // this shows the group name, seems pointless?
        showBarLabels:    {get: function(){return showBarLabels;}, set: function(_){showBarLabels=_;}},
        showChecks:    {get: function(){return showChecks;}, set: function(_){showChecks=_;}},
        disabled:     {get: function(){return disabled;}, set: function(_){disabled=_;}},
        id:           {get: function(){return id;}, set: function(_){id=_;}},
        valueFormat:  {get: function(){return valueFormat;}, set: function(_){valueFormat=_;}},
        keyFormat:  {get: function(){return keyFormat;}, set: function(_){keyFormat=_;}},
        valuePadding: {get: function(){return valuePadding;}, set: function(_){valuePadding=_;}},
        groupSpacing:{get: function(){return groupSpacing;}, set: function(_){groupSpacing=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }},
        href:  {get: function(){return href;}, set: function(_){
            href = d3.functor(_);
        }},
        barColor:  {get: function(){return barColor;}, set: function(_){
            barColor = _ ? nv.utils.getColor(_) : null;
        }},
        barWidth: {get: function(){return barWidth;}, set: function(_){ barWidth = _; }}
    });

    nv.utils.initOptions(chart);

    return chart;
};
